import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaSliders } from 'react-icons/fa6';
import {
  loadMarketplaceBootstrap,
  fetchMarketplaceProducts,
  openMarketplaceProduct,
  setMarketplaceCompanyId,
  setMarketplaceFilters,
  resetMarketplaceFilters,
  setMarketplaceLimit,
  setMarketplaceViewMode,
  closeMarketplaceDetail,
  duplicateMarketplaceProduct,
  clearDuplicateStatus,
  deleteFetchedMarketplaceProduct,
  clearDeleteFetchedStatus,
  resetFetchedMarketplaceProduct,
  clearResetFetchedStatus,
  loadAlreadyMeTooIds,
  selectBigCommerce,
} from '../../features/bigCommerce/bigCommerceSlice.js';
import {
  ECOMMERCE_PRODUCT_SEARCH_FIELDS,
  fetchMarketplaceProductByIdRequest,
  fetchReceivedStoreRequestsRequest,
  fetchSentStoreRequestsRequest,
  normalizeConnectionSyncSettings,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import {
  excludeChildProducts,
  getProductName,
  getProductPrice,
  isAlreadyMeTooProduct,
  isMarketplaceChildProduct,
  parentProductTotal,
  productIdFromRecord,
  resolveSortParams,
} from '../../features/bigCommerce/marketplaceUtils.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { showToast } from '../../utils/toast.js';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import '../common/devApiSources.css';
import CompanyProfileHeader from './CompanyProfileHeader.jsx';
import ConnectedStoreSettingsModal from './ConnectedStoreSettingsModal.jsx';
import MarketplaceFilters from './MarketplaceFilters.jsx';
import MarketplaceListingTabs from './MarketplaceListingTabs.jsx';
import ProductToolbar from './ProductToolbar.jsx';
import ProductCard, { ProductCardSkeleton } from './ProductCard.jsx';
import ProductDetailModal from './ProductDetailModal.jsx';
import MeTooPriceModal from './MeTooPriceModal.jsx';

const LISTING_TAB_ALL = 'all';
const LISTING_TAB_ME_TOO = 'me-too';

const mapLoadStatus = (status) => {
  if (status === 'loading' || status === 'loadingMore') return 'loading';
  if (status === 'failed') return 'error';
  if (status === 'succeeded') return 'success';
  return 'pending';
};

function companyIdFromTarget(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return String(value._id ?? value.id ?? '').trim();
  }
  return String(value).trim();
}

function connectionMatchesStore(partner, store) {
  const storeId = String(store?.id || '').trim();
  const storeSlug = String(store?.slug || '').trim();
  const partnerId = companyIdFromTarget(partner);
  if (storeId && partnerId && storeId === partnerId) return true;
  if (storeSlug && partner && typeof partner === 'object') {
    const slug = String(
      partner.company_slug ?? partner.companySlug ?? partner.slug ?? ''
    ).trim();
    if (slug && slug === storeSlug) return true;
  }
  return false;
}

function findApprovedConnection(sentRows, receivedRows, store) {
  const fromSent = (sentRows || []).find(
    (row) =>
      row?.status === 'approved' && connectionMatchesStore(row?.target_company_id, store)
  );
  if (fromSent) return fromSent;
  return (
    (receivedRows || []).find(
      (row) =>
        row?.status === 'approved' &&
        connectionMatchesStore(row?.sender_company || row?.company_id, store)
    ) || null
  );
}

/**
 * Reusable Facebook-style product marketplace.
 * Pass `companyId` to load that company's profile + catalog.
 * Product pagination loads more on page scroll.
 */
export default function MarketplacePage({ companyId }) {
  const dispatch = useDispatch();
  const state = useSelector(selectBigCommerce);
  const sessionCompanyId = useSelector(selectCompanyId);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(state.filters.search || '');
  const [listingTab, setListingTab] = useState(LISTING_TAB_ALL);
  /** Partner products resolved by id for the Already Me too tab (not yet in the scroll list). */
  const [meTooResolved, setMeTooResolved] = useState([]);
  const [meTooResolveStatus, setMeTooResolveStatus] = useState('idle');
  const [meTooTargets, setMeTooTargets] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMeTooBusy, setBulkMeTooBusy] = useState(false);
  const [bulkMeTooProgress, setBulkMeTooProgress] = useState('');
  const [outgoingConnection, setOutgoingConnection] = useState(null);
  const [connectionReady, setConnectionReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const meTooResolveGenRef = useRef(0);
  const bulkMeTooRef = useRef(false);

  const resolvedStoreId = String(state.company?.id || state.companyId || '').trim();
  const isOwnStore =
    Boolean(sessionCompanyId) &&
    (String(sessionCompanyId) === String(companyId || '').trim() ||
      (resolvedStoreId && String(sessionCompanyId) === resolvedStoreId));
  const meTooBusy = state.duplicateStatus === 'loading' || bulkMeTooBusy;
  const deleteMeTooBusy = state.deleteFetchedStatus === 'loading';
  const resetMeTooBusy = state.resetFetchedStatus === 'loading';
  const isConnected = Boolean(
    String(outgoingConnection?._id || outgoingConnection?.id || '').trim()
  );
  const canManageSettings = !isOwnStore && isConnected;
  const meTooLocked = !isOwnStore && (!connectionReady || !isConnected);

  const initialLoading =
    state.productsStatus === 'loading' && state.products.length === 0;
  const loadingMore = state.productsStatus === 'loadingMore';
  const isBusy =
    state.productsStatus === 'loading' || state.productsStatus === 'loadingMore';

  useEffect(() => {
    loadingRef.current = isBusy;
  }, [isBusy]);

  const loadedStoreId = String(state.company?.id || '').trim();
  const loadedStoreSlug = String(state.company?.slug || '').trim();
  const bootstrapReady = state.bootstrapStatus === 'succeeded';

  useEffect(() => {
    const id = String(companyId || '').trim();
    if (!id) return;
    const alreadyThisStore =
      bootstrapReady &&
      ((loadedStoreId && id === loadedStoreId) || (loadedStoreSlug && id === loadedStoreSlug));
    if (alreadyThisStore) {
      dispatch(setMarketplaceCompanyId(id));
      return;
    }
    setSearchDraft('');
    setListingTab(LISTING_TAB_ALL);
    setMeTooResolved([]);
    setMeTooResolveStatus('idle');
    setMeTooTargets([]);
    setSelectedIds(new Set());
    setOutgoingConnection(null);
    setConnectionReady(false);
    setSettingsOpen(false);
    meTooResolveGenRef.current += 1;
    dispatch(setMarketplaceCompanyId(id));
    dispatch(loadMarketplaceBootstrap({ companyId: id }));
  }, [companyId, dispatch, bootstrapReady, loadedStoreId, loadedStoreSlug]);

  useEffect(() => {
    if (isOwnStore) {
      setOutgoingConnection(null);
      setConnectionReady(true);
      setSettingsOpen(false);
      return undefined;
    }
    if (state.bootstrapStatus !== 'succeeded') {
      setConnectionReady(false);
      return undefined;
    }
    const storeId = String(state.company?.id || '').trim();
    const storeSlug = String(state.company?.slug || '').trim();
    if (!storeId && !storeSlug) {
      setOutgoingConnection(null);
      setConnectionReady(true);
      return undefined;
    }

    let cancelled = false;
    setConnectionReady(false);
    Promise.all([fetchSentStoreRequestsRequest(), fetchReceivedStoreRequestsRequest()])
      .then(([sent, received]) => {
        if (cancelled) return;
        setOutgoingConnection(
          findApprovedConnection(sent.rows, received.rows, {
            id: storeId,
            slug: storeSlug,
          })
        );
        setConnectionReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOutgoingConnection(null);
        setConnectionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOwnStore, state.bootstrapStatus, loadedStoreId, loadedStoreSlug]);

  useEffect(() => {
    if (listingTab !== LISTING_TAB_ME_TOO) return;
    if (isOwnStore || (connectionReady && !isConnected)) {
      setListingTab(LISTING_TAB_ALL);
    }
  }, [isOwnStore, connectionReady, isConnected, listingTab]);

  useEffect(() => {
    if (meTooLocked && meTooTargets.length > 0 && !meTooBusy) {
      setMeTooTargets([]);
    }
  }, [meTooLocked, meTooTargets, meTooBusy]);

  useEffect(() => {
    const sourceId = String(companyId || '').trim();
    const ownId = String(sessionCompanyId || '').trim();
    if (!sourceId || !ownId || sourceId === ownId) return;
    // Load after bootstrap so store id is stable; also retries when session company arrives late.
    if (state.bootstrapStatus === 'loading' || state.bootstrapStatus === 'idle') return;
    dispatch(
      loadAlreadyMeTooIds({
        sourceCompanyId: sourceId,
        ownCompanyId: ownId,
      })
    );
  }, [companyId, sessionCompanyId, state.bootstrapStatus, dispatch]);

  // Debounced search → filters (All products tab only; Me too filters client-side).
  useEffect(() => {
    if (listingTab === LISTING_TAB_ME_TOO) return undefined;
    const t = setTimeout(() => {
      if (searchDraft !== state.filters.search) {
        dispatch(setMarketplaceFilters({ search: searchDraft }));
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, state.filters.search, dispatch, listingTab]);

  const handleListingTabChange = useCallback(
    (tab) => {
      if (tab === LISTING_TAB_ALL && searchDraft !== state.filters.search) {
        dispatch(setMarketplaceFilters({ search: searchDraft }));
      }
      setListingTab(tab);
    },
    [dispatch, searchDraft, state.filters.search]
  );

  // Fetch page 1 when filters / company / limit / bootstrap change
  useEffect(() => {
    if (state.bootstrapStatus === 'idle' || state.bootstrapStatus === 'loading') return;
    dispatch(
      fetchMarketplaceProducts({
        companyId: String(companyId || '').trim(),
        page: 1,
        limit: state.pagination.limit,
        append: false,
      })
    );
  }, [
    companyId,
    state.filters,
    state.pagination.limit,
    state.bootstrapStatus,
    dispatch,
  ]);

  const loadNextPage = useCallback(() => {
    if (loadingRef.current) return;
    // No products → do not keep requesting; page-1 failures use the Retry button.
    if (state.products.length === 0) return;

    const isFailureRetry = state.productsStatus === 'failed';
    if (!isFailureRetry && !state.productsHasMore) return;
    if (!isFailureRetry && state.productsStatus !== 'succeeded') return;

    dispatch(
      fetchMarketplaceProducts({
        companyId: String(companyId || '').trim(),
        skip: state.products.length,
        limit: state.pagination.limit,
        append: true,
      })
    );
  }, [
    dispatch,
    companyId,
    state.productsHasMore,
    state.productsStatus,
    state.products.length,
    state.pagination.limit,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    // Scroll-load only while we have items and more pages — never auto-retry failures.
    if (
      state.products.length === 0 ||
      !state.productsHasMore ||
      state.productsStatus !== 'succeeded'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadNextPage();
      },
      { root: null, rootMargin: '480px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage, state.products.length, state.productsHasMore, state.productsStatus]);

  const onFilterChange = useCallback(
    (patch) => {
      if (Object.prototype.hasOwnProperty.call(patch, 'search')) {
        setSearchDraft(patch.search);
      }
      dispatch(setMarketplaceFilters(patch));
      const onlySearch = Object.keys(patch).length === 1 && 'search' in patch;
      if (!onlySearch) setFiltersOpen(false);
    },
    [dispatch]
  );

  const onReset = useCallback(() => {
    setSearchDraft('');
    dispatch(resetMarketplaceFilters());
  }, [dispatch]);

  useEffect(() => {
    if (bulkMeTooRef.current) return;
    if (state.duplicateStatus === 'succeeded') {
      const name = state.duplicateProductName || getProductName(state.selectedProduct) || 'Product';
      showToast({
        message: state.duplicateAlreadyFetched
          ? `"${name}" selling price was updated.`
          : `"${name}" was added to your catalog.`,
        variant: 'success',
      });
      dispatch(clearDuplicateStatus());
      setMeTooTargets([]);
    } else if (state.duplicateStatus === 'failed' && state.duplicateError) {
      showToast({ message: state.duplicateError, variant: 'error' });
      dispatch(clearDuplicateStatus());
    }
  }, [
    state.duplicateStatus,
    state.duplicateError,
    state.duplicateAlreadyFetched,
    state.duplicateProductName,
    state.selectedProduct,
    dispatch,
  ]);

  useEffect(() => {
    if (state.deleteFetchedStatus === 'succeeded') {
      const name =
        state.deleteFetchedProductName || getProductName(state.selectedProduct) || 'Product';
      showToast({
        message: `"${name}" was removed from your catalog.`,
        variant: 'success',
      });
      const removedId = String(state.deleteFetchedProductId || '');
      if (removedId) {
        setMeTooResolved((prev) =>
          prev.filter((item) => productIdFromRecord(item) !== removedId)
        );
      }
      dispatch(clearDeleteFetchedStatus());
    } else if (state.deleteFetchedStatus === 'failed' && state.deleteFetchedError) {
      showToast({ message: state.deleteFetchedError, variant: 'error' });
      dispatch(clearDeleteFetchedStatus());
    }
  }, [
    state.deleteFetchedStatus,
    state.deleteFetchedError,
    state.deleteFetchedProductId,
    state.deleteFetchedProductName,
    state.selectedProduct,
    dispatch,
  ]);

  useEffect(() => {
    if (state.resetFetchedStatus === 'succeeded') {
      const name =
        state.resetFetchedProductName || getProductName(state.selectedProduct) || 'Product';
      showToast({
        message: `"${name}" was reset from the origin product.`,
        variant: 'success',
      });
      dispatch(clearResetFetchedStatus());
    } else if (state.resetFetchedStatus === 'failed' && state.resetFetchedError) {
      showToast({ message: state.resetFetchedError, variant: 'error' });
      dispatch(clearResetFetchedStatus());
    }
  }, [
    state.resetFetchedStatus,
    state.resetFetchedError,
    state.resetFetchedProductName,
    state.selectedProduct,
    dispatch,
  ]);

  const denyMeTooUnlessConnected = useCallback(() => {
    if (isOwnStore) return true;
    if (!connectionReady) return true;
    if (isConnected) return false;
    showToast({
      message: 'Connect to this store first to use Me too.',
      variant: 'warning',
    });
    return true;
  }, [isOwnStore, connectionReady, isConnected]);

  const handleMeToo = useCallback(
    (item) => {
      if (meTooBusy || deleteMeTooBusy || resetMeTooBusy) return;
      if (denyMeTooUnlessConnected()) return;
      const id = productIdFromRecord(item);
      if (!id) {
        showToast({ message: 'Product id is missing.', variant: 'error' });
        return;
      }
      setMeTooTargets([item]);
    },
    [denyMeTooUnlessConnected, meTooBusy, deleteMeTooBusy, resetMeTooBusy]
  );

  const roundMeTooPrice = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  };

  const handleConfirmMeToo = useCallback(
    async ({ price, multiplier } = {}) => {
      if (meTooBusy || deleteMeTooBusy || resetMeTooBusy) return;
      if (denyMeTooUnlessConnected()) return;
      const targets = Array.isArray(meTooTargets) ? meTooTargets.filter(Boolean) : [];
      if (targets.length === 0) {
        showToast({ message: 'Product id is missing.', variant: 'error' });
        return;
      }

      if (targets.length === 1) {
        const id = productIdFromRecord(targets[0]);
        if (!id) {
          showToast({ message: 'Product id is missing.', variant: 'error' });
          return;
        }
        dispatch(
          duplicateMarketplaceProduct({
            productId: id,
            productName: getProductName(targets[0]) || 'Product',
            price,
            multiplier,
          })
        );
        return;
      }

      bulkMeTooRef.current = true;
      setBulkMeTooBusy(true);
      let copied = 0;
      let updated = 0;
      let failed = 0;
      const finishedIds = [];
      try {
        for (let i = 0; i < targets.length; i += 1) {
          const item = targets[i];
          const id = productIdFromRecord(item);
          setBulkMeTooProgress(`Copying ${i + 1} of ${targets.length}…`);
          if (!id) {
            failed += 1;
            continue;
          }
          const origin = getProductPrice(item);
          const itemPrice =
            multiplier != null && Number(multiplier) > 0
              ? roundMeTooPrice(origin * Number(multiplier))
              : roundMeTooPrice(price);
          try {
            const result = await dispatch(
              duplicateMarketplaceProduct({
                productId: id,
                productName: getProductName(item) || 'Product',
                price: itemPrice,
                multiplier,
              })
            ).unwrap();
            if (result?.alreadyFetched) updated += 1;
            else copied += 1;
            finishedIds.push(id);
          } catch {
            failed += 1;
          }
        }
      } finally {
        bulkMeTooRef.current = false;
        setBulkMeTooBusy(false);
        setBulkMeTooProgress('');
        dispatch(clearDuplicateStatus());
        setMeTooTargets([]);
        if (finishedIds.length > 0) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            finishedIds.forEach((id) => next.delete(id));
            return next;
          });
        }
      }

      const parts = [];
      if (copied) parts.push(`${copied} added to your catalog`);
      if (updated) parts.push(`${updated} price updated`);
      if (failed) parts.push(`${failed} failed`);
      showToast({
        message: parts.join('. ') || 'Me too finished.',
        variant: failed && !copied && !updated ? 'error' : failed ? 'warning' : 'success',
      });
    },
    [
      dispatch,
      denyMeTooUnlessConnected,
      meTooBusy,
      deleteMeTooBusy,
      resetMeTooBusy,
      meTooTargets,
    ]
  );

  const handleDeleteMeToo = useCallback(
    (item) => {
      if (deleteMeTooBusy || meTooBusy || resetMeTooBusy) return;
      if (denyMeTooUnlessConnected()) return;
      const sourceId = productIdFromRecord(item);
      if (!sourceId) {
        showToast({ message: 'Product id is missing.', variant: 'error' });
        return;
      }
      const localProductId = state.alreadyMeTooLocalBySource?.[sourceId] || '';
      dispatch(
        deleteFetchedMarketplaceProduct({
          productId: sourceId,
          localProductId,
          productName: getProductName(item) || 'Product',
        })
      );
    },
    [
      dispatch,
      denyMeTooUnlessConnected,
      deleteMeTooBusy,
      meTooBusy,
      resetMeTooBusy,
      state.alreadyMeTooLocalBySource,
    ]
  );

  const handleResetMeToo = useCallback(
    (item) => {
      if (resetMeTooBusy || deleteMeTooBusy || meTooBusy) return;
      if (denyMeTooUnlessConnected()) return;
      const sourceId = productIdFromRecord(item);
      if (!sourceId) {
        showToast({ message: 'Product id is missing.', variant: 'error' });
        return;
      }
      const confirmed = window.confirm(
        'Reset this Me too product from the origin? Brand, category, and stock stay local; other details and variants are overwritten.'
      );
      if (!confirmed) return;
      const localProductId = state.alreadyMeTooLocalBySource?.[sourceId] || '';
      dispatch(
        resetFetchedMarketplaceProduct({
          productId: sourceId,
          localProductId,
          productName: getProductName(item) || 'Product',
        })
      );
    },
    [
      dispatch,
      denyMeTooUnlessConnected,
      resetMeTooBusy,
      deleteMeTooBusy,
      meTooBusy,
      state.alreadyMeTooLocalBySource,
    ]
  );

  // Children stay in Redux for variation lookup / skip pagination; hide them as cards.
  const visibleProducts = useMemo(
    () => excludeChildProducts(state.products),
    [state.products]
  );

  const productById = useMemo(() => {
    const map = new Map();
    for (const item of state.products || []) {
      const id = productIdFromRecord(item);
      if (id) map.set(id, item);
    }
    for (const item of meTooResolved || []) {
      const id = productIdFromRecord(item);
      if (id && !map.has(id)) map.set(id, item);
    }
    return map;
  }, [state.products, meTooResolved]);

  const alreadyMeTooIdSet = useMemo(
    () => new Set((state.alreadyMeTooIds || []).map(String).filter(Boolean)),
    [state.alreadyMeTooIds]
  );

  // Parent listing products only — fetched-product-ids also includes variation rows.
  const alreadyMeTooCount = useMemo(() => {
    const ids = [...alreadyMeTooIdSet];
    if (ids.length === 0) return 0;
    const listingComplete =
      state.productsStatus === 'succeeded' && !state.productsHasMore;
    return ids.filter((id) => {
      const item = productById.get(id);
      if (item) return !isMarketplaceChildProduct(item);
      return !listingComplete;
    }).length;
  }, [alreadyMeTooIdSet, productById, state.productsStatus, state.productsHasMore]);

  const meTooFromCatalog = useMemo(
    () =>
      visibleProducts.filter((item) =>
        isAlreadyMeTooProduct(item, state.alreadyMeTooIds)
      ),
    [visibleProducts, state.alreadyMeTooIds]
  );

  // Merge catalog matches + id-resolved rows (dedupe by partner product id).
  const meTooProducts = useMemo(() => {
    const ids = new Set((state.alreadyMeTooIds || []).map(String).filter(Boolean));
    const byId = new Map();
    [...meTooFromCatalog, ...meTooResolved].forEach((item) => {
      const id = productIdFromRecord(item);
      if (!id || byId.has(id)) return;
      if (ids.has(id) || isAlreadyMeTooProduct(item, ids)) {
        byId.set(id, item);
      }
    });
    return excludeChildProducts([...byId.values()]);
  }, [meTooFromCatalog, meTooResolved, state.alreadyMeTooIds]);

  const meTooCatalogIdKey = useMemo(
    () =>
      meTooFromCatalog
        .map(productIdFromRecord)
        .filter(Boolean)
        .sort()
        .join(','),
    [meTooFromCatalog]
  );

  const alreadyMeTooIdKey = useMemo(
    () =>
      [...new Set((state.alreadyMeTooIds || []).map(String).filter(Boolean))]
        .sort()
        .join(','),
    [state.alreadyMeTooIds]
  );

  // Resolve missing me-too products by id when that tab is open.
  useEffect(() => {
    if (isOwnStore || listingTab !== LISTING_TAB_ME_TOO) return undefined;

    const ids = alreadyMeTooIdKey ? alreadyMeTooIdKey.split(',') : [];
    if (ids.length === 0) {
      setMeTooResolved([]);
      setMeTooResolveStatus('succeeded');
      return undefined;
    }

    const haveFromCatalog = new Set(meTooCatalogIdKey ? meTooCatalogIdKey.split(',') : []);
    const missing = ids.filter((id) => {
      if (haveFromCatalog.has(id)) return false;
      const item = productById.get(id);
      if (item && isMarketplaceChildProduct(item)) return false;
      return true;
    });
    if (missing.length === 0) {
      setMeTooResolveStatus('succeeded');
      return undefined;
    }

    const gen = ++meTooResolveGenRef.current;
    let cancelled = false;
    setMeTooResolveStatus('loading');

    (async () => {
      const settled = await Promise.allSettled(
        missing.map((id) => fetchMarketplaceProductByIdRequest(id))
      );
      if (cancelled || gen !== meTooResolveGenRef.current) return;

      const next = [];
      settled.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const record = result.value;
        if (!record || typeof record !== 'object' || Array.isArray(record)) return;
        const id = productIdFromRecord(record) || missing[index];
        if (!id) return;
        next.push({ ...record, _id: record._id ?? record.id ?? id });
      });

      setMeTooResolved(next);
      setMeTooResolveStatus('succeeded');
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwnStore, listingTab, alreadyMeTooIdKey, meTooCatalogIdKey, productById]);

  const isMeTooTab = !isOwnStore && listingTab === LISTING_TAB_ME_TOO;

  const displayProducts = useMemo(() => {
    if (!isMeTooTab) {
      // Already Me too products first (from fetched-product-ids).
      if (alreadyMeTooIdSet.size === 0) return visibleProducts;
      const done = [];
      const rest = [];
      for (const item of visibleProducts) {
        if (isAlreadyMeTooProduct(item, alreadyMeTooIdSet)) done.push(item);
        else rest.push(item);
      }
      return [...done, ...rest];
    }
    const q = String(searchDraft || '')
      .trim()
      .toLowerCase();
    if (!q) return meTooProducts;
    return meTooProducts.filter((item) => {
      const hay = [
        getProductName(item),
        item?.sku,
        item?.product_code,
        item?.barcode,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [isMeTooTab, visibleProducts, meTooProducts, searchDraft, alreadyMeTooIdSet]);

  const canSelectProducts = !isOwnStore && !isMeTooTab;
  const displaySelectableIds = useMemo(
    () =>
      displayProducts
        .filter((item) => !isAlreadyMeTooProduct(item, alreadyMeTooIdSet))
        .map(productIdFromRecord)
        .filter(Boolean),
    [displayProducts, alreadyMeTooIdSet]
  );
  const allDisplayedSelected =
    displaySelectableIds.length > 0 &&
    displaySelectableIds.every((id) => selectedIds.has(id));
  const someDisplayedSelected = displaySelectableIds.some((id) => selectedIds.has(id));

  const handleToggleSelect = useCallback(
    (id) => {
      const key = String(id || '').trim();
      if (!key) return;
      const item = productById.get(key);
      if (item && isAlreadyMeTooProduct(item, alreadyMeTooIdSet)) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [productById, alreadyMeTooIdSet]
  );

  useEffect(() => {
    if (alreadyMeTooIdSet.size === 0) return;
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (alreadyMeTooIdSet.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [alreadyMeTooIdSet]);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = displayProducts
        .filter((item) => !isAlreadyMeTooProduct(item, alreadyMeTooIdSet))
        .map(productIdFromRecord)
        .filter(Boolean);
      if (ids.length === 0) return prev;
      const allOn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [displayProducts, alreadyMeTooIdSet]);

  const handleBulkMeToo = useCallback(() => {
    if (meTooBusy || deleteMeTooBusy || resetMeTooBusy) return;
    if (denyMeTooUnlessConnected()) return;
    const targets = [];
    const seen = new Set();
    selectedIds.forEach((id) => {
      const item = productById.get(id);
      if (!item || seen.has(id)) return;
      if (isAlreadyMeTooProduct(item, alreadyMeTooIdSet)) return;
      seen.add(id);
      targets.push(item);
    });
    if (targets.length === 0) {
      showToast({ message: 'Select at least one product.', variant: 'warning' });
      return;
    }
    setMeTooTargets(targets);
  }, [
    denyMeTooUnlessConnected,
    meTooBusy,
    deleteMeTooBusy,
    resetMeTooBusy,
    selectedIds,
    productById,
    alreadyMeTooIdSet,
  ]);

  const priceBounds = useMemo(() => {
    let max = 1000;
    for (const p of visibleProducts) {
      const price = Number(p?.price ?? p?.product_price ?? 0);
      if (price > max) max = price;
    }
    return { min: 0, max: Math.ceil(max / 100) * 100 || 100000 };
  }, [visibleProducts]);

  const parentTotal = useMemo(
    () => parentProductTotal(state.products, state.pagination.total),
    [state.products, state.pagination.total]
  );

  const showing = displayProducts.length;
  const showingTotal = isMeTooTab
    ? String(searchDraft || '').trim()
      ? displayProducts.length
      : alreadyMeTooCount
    : parentTotal;
  const meTooInitialLoading =
    isMeTooTab &&
    displayProducts.length === 0 &&
    !String(searchDraft || '').trim() &&
    (state.alreadyMeTooStatus === 'loading' || meTooResolveStatus === 'loading');

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const storeId = String(companyId || state.companyId || '').trim();
    if (!storeId) return [];

    const encodedId = encodeURIComponent(storeId);
    const limit = Math.max(1, Number(state.pagination.limit) || 20);
    const skip = Math.max(0, (Number(state.pagination.page) || 1) - 1) * limit;
    const sort = resolveSortParams(state.filters.sortBy || 'latest');
    const productQuery = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
      status: 'active',
      searchFields: ECOMMERCE_PRODUCT_SEARCH_FIELDS,
    });
    const search = String(state.filters.search || '').trim();
    if (search) productQuery.set('search', search);
    const categoryIds = Array.isArray(state.filters.categoryIds)
      ? state.filters.categoryIds.filter(Boolean)
      : [];
    if (categoryIds.length === 1) productQuery.set('category_id', String(categoryIds[0]));
    const brandIds = Array.isArray(state.filters.brandIds)
      ? state.filters.brandIds.filter(Boolean)
      : [];
    if (brandIds.length === 1) productQuery.set('brand_id', String(brandIds[0]));
    const stock = String(state.filters.stock || '').trim();
    if (stock) productQuery.set('stock_status', stock);
    if (sort.sortBy) productQuery.set('sortBy', sort.sortBy);
    if (sort.sortOrder) productQuery.set('sortOrder', sort.sortOrder);

    const sources = [
      {
        key: 'store-profile',
        label: 'Company profile',
        url: buildApiUrl(`big-commerce/company/${encodedId}`),
        status: mapLoadStatus(state.bootstrapStatus),
        durationMs: null,
        error: state.bootstrapStatus === 'failed' ? state.error : null,
      },
      {
        key: 'store-categories',
        label: 'Categories',
        url: buildApiUrl(`big-commerce/categories/${encodedId}`),
        status: mapLoadStatus(state.bootstrapStatus),
        durationMs: null,
        error: null,
      },
      {
        key: 'store-brands',
        label: 'Brands',
        url: buildApiUrl(`big-commerce/brands/${encodedId}`),
        status: mapLoadStatus(state.bootstrapStatus),
        durationMs: null,
        error: null,
      },
      {
        key: 'store-products',
        label: 'Store products',
        url: buildApiUrl(
          `big-commerce/get-all-active-ecommerce-products/${encodedId}?${productQuery}`
        ),
        status: mapLoadStatus(state.productsStatus),
        durationMs: null,
        error: state.productsStatus === 'failed' ? state.error : null,
      },
      {
        key: 'profile-fallback-listing',
        label: 'Profile fallback (listing)',
        url: buildApiUrl(
          `company/get-all-for-listing?limit=5&skip=0&include_id=${encodedId}`
        ),
        status: 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'profile-fallback-get',
        label: 'Profile fallback (tenant get)',
        url: buildApiUrl(`company/get/${encodedId}`),
        status: 'pending',
        durationMs: null,
        error: null,
      },
    ];

    if (!isOwnStore) {
      sources.push({
        key: 'already-me-too',
        label: 'Already Me too ids',
        url: buildApiUrl(`big-commerce/fetched-product-ids/${encodedId}`),
        status: mapLoadStatus(state.alreadyMeTooStatus),
        durationMs: null,
        error: state.alreadyMeTooStatus === 'failed' ? 'Failed to load fetched product ids' : null,
      });
      sources.push({
        key: 'me-too-duplicate',
        label: 'Me too (duplicate)',
        url: buildApiUrl('big-commerce/products/{productId}/duplicate'),
        status: mapLoadStatus(state.duplicateStatus),
        durationMs: null,
        error: state.duplicateStatus === 'failed' ? state.duplicateError : null,
      });
      sources.push({
        key: 'me-too-delete',
        label: 'Delete Me too',
        url: buildApiUrl('big-commerce/fetched-products/{productId}/delete'),
        status: mapLoadStatus(state.deleteFetchedStatus),
        durationMs: null,
        error:
          state.deleteFetchedStatus === 'failed' ? state.deleteFetchedError : null,
      });
      sources.push({
        key: 'me-too-reset',
        label: 'Reset Me too',
        url: buildApiUrl('big-commerce/fetched-products/{productId}/reset'),
        status: mapLoadStatus(state.resetFetchedStatus),
        durationMs: null,
        error: state.resetFetchedStatus === 'failed' ? state.resetFetchedError : null,
      });
    }

    if (state.detailOpen && state.selectedProduct) {
      const productId = productIdFromRecord(state.selectedProduct);
      if (productId) {
        const encodedProductId = encodeURIComponent(productId);
        sources.push({
          key: 'product-detail',
          label: 'Product detail',
          url: buildApiUrl(`product/get/${encodedProductId}`),
          status: mapLoadStatus(state.detailStatus),
          durationMs: null,
          error: state.detailStatus === 'failed' ? state.error : null,
        });
        sources.push({
          key: 'product-variation',
          label: 'Product variations',
          url: buildApiUrl(`product/get-product-variation/${encodedProductId}`),
          status: mapLoadStatus(state.detailStatus),
          durationMs: null,
          error: null,
        });
      }
    }

    return sources;
  }, [
    companyId,
    isOwnStore,
    state.companyId,
    state.bootstrapStatus,
    state.productsStatus,
    state.alreadyMeTooStatus,
    state.duplicateStatus,
    state.duplicateError,
    state.deleteFetchedStatus,
    state.deleteFetchedError,
    state.resetFetchedStatus,
    state.resetFetchedError,
    state.detailOpen,
    state.detailStatus,
    state.selectedProduct,
    state.pagination.page,
    state.pagination.limit,
    state.filters,
    state.error,
  ]);

  return (
    <div className="bc-marketplace">
      <CompanyProfileHeader
        company={state.company}
        loading={state.bootstrapStatus === 'loading'}
        showSettings={canManageSettings}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="bc-layout">
        <button
          type="button"
          className="bc-filter-open bc-btn bc-btn-ghost"
          onClick={() => setFiltersOpen(true)}
        >
          <FaSliders aria-hidden="true" /> Filters
        </button>

        <div className={`bc-filters-drawer ${filtersOpen ? 'is-open' : ''}`}>
          <div
            className="bc-filters-backdrop"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <MarketplaceFilters
            filters={state.filters}
            categories={state.categories}
            brands={state.brands}
            onChange={onFilterChange}
            onReset={onReset}
            priceBounds={priceBounds}
          />
        </div>

        <div className="bc-filters-desktop">
          <MarketplaceFilters
            filters={state.filters}
            categories={state.categories}
            brands={state.brands}
            onChange={onFilterChange}
            onReset={onReset}
            priceBounds={priceBounds}
          />
        </div>

        <section className="bc-listing">
          <MarketplaceListingTabs
            activeTab={listingTab}
            onChange={handleListingTabChange}
            allCount={parentTotal}
            meTooCount={alreadyMeTooCount}
            showMeTooTab={!isOwnStore && isConnected}
          />

          <ProductToolbar
            search={searchDraft}
            onSearchChange={setSearchDraft}
            showing={showing}
            total={showingTotal}
            viewMode={state.viewMode}
            onViewModeChange={(mode) => dispatch(setMarketplaceViewMode(mode))}
            pageSize={state.pagination.limit}
            onPageSizeChange={(limit) => dispatch(setMarketplaceLimit(limit))}
            showBulkSelect={canSelectProducts && displaySelectableIds.length > 0}
            selectedCount={selectedIds.size}
            allSelected={allDisplayedSelected}
            someSelected={someDisplayedSelected}
            onToggleSelectAll={handleToggleSelectAll}
            onBulkMeToo={handleBulkMeToo}
            bulkDisabled={meTooBusy || deleteMeTooBusy || resetMeTooBusy}
          />

          {!isMeTooTab &&
          state.error &&
          state.productsStatus === 'failed' &&
          state.products.length === 0 ? (
            <div className="bc-error" role="alert">
              {state.error}
              <button
                type="button"
                className="bc-btn bc-btn-ghost bc-btn-sm ms-2"
                onClick={() =>
                  dispatch(
                    fetchMarketplaceProducts({
                      companyId: String(companyId || '').trim(),
                      page: 1,
                      append: false,
                    })
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className={`bc-products bc-products--${state.viewMode}`}>
            {(initialLoading && !isMeTooTab) || meTooInitialLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={`sk-${i}`} viewMode={state.viewMode} />
                ))
              : null}

            {!initialLoading &&
            !meTooInitialLoading &&
            displayProducts.length === 0 &&
            (isMeTooTab
              ? state.alreadyMeTooStatus !== 'loading' && meTooResolveStatus !== 'loading'
              : state.productsStatus === 'succeeded') ? (
              <div className="bc-empty">
                <h3>{isMeTooTab ? 'No Me too products yet' : 'No products found'}</h3>
                <p>
                  {isMeTooTab
                    ? 'Products you copy with Me too will appear here.'
                    : 'Try adjusting filters or search terms.'}
                </p>
                {!isMeTooTab ? (
                  <button type="button" className="bc-btn bc-btn-primary" onClick={onReset}>
                    Reset filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bc-btn bc-btn-primary"
                    onClick={() => setListingTab(LISTING_TAB_ALL)}
                  >
                    Browse all products
                  </button>
                )}
              </div>
            ) : null}

            {!initialLoading && !meTooInitialLoading
              ? displayProducts.map((product) => (
                  <ProductCard
                    key={product._id || product.id}
                    product={product}
                    viewMode={state.viewMode}
                    onViewDetails={(id) =>
                      dispatch(openMarketplaceProduct({ productId: id, product }))
                    }
                    onMeToo={isOwnStore ? undefined : handleMeToo}
                    onDeleteMeToo={isOwnStore ? undefined : handleDeleteMeToo}
                    onResetMeToo={isOwnStore ? undefined : handleResetMeToo}
                    meTooLocked={meTooLocked}
                    meTooLoading={
                      meTooBusy &&
                      state.duplicateProductId === productIdFromRecord(product)
                    }
                    deleteMeTooLoading={
                      deleteMeTooBusy &&
                      state.deleteFetchedProductId === productIdFromRecord(product)
                    }
                    resetMeTooLoading={
                      resetMeTooBusy &&
                      state.resetFetchedProductId === productIdFromRecord(product)
                    }
                    hideMeToo={isOwnStore}
                    alreadyMeTooIds={alreadyMeTooIdSet}
                    placeholderLogoUrl={state.company?.logoUrl || ''}
                    selectable={canSelectProducts}
                    selected={selectedIds.has(productIdFromRecord(product))}
                    onToggleSelect={handleToggleSelect}
                    selectDisabled={meTooBusy || deleteMeTooBusy || resetMeTooBusy}
                  />
                ))
              : null}
          </div>

          {!isMeTooTab ? (
            <div ref={sentinelRef} className="bc-scroll-sentinel" aria-hidden="true" />
          ) : null}

          {!isMeTooTab && loadingMore ? (
            <div className="bc-scroll-loading text-center py-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading more…</span>
              </div>
              <span className="text-muted text-sm ms-2">Loading more products…</span>
            </div>
          ) : null}

          {!isMeTooTab &&
          !initialLoading &&
          !loadingMore &&
          state.products.length > 0 &&
          !state.productsHasMore ? (
            <p className="bc-scroll-end text-center text-muted text-sm mb-0 py-3">
              You&apos;ve reached the end of the list
            </p>
          ) : null}

          {!isMeTooTab && state.productsStatus === 'failed' && state.products.length > 0 ? (
            <div className="text-center py-3">
              <p className="text-danger text-sm mb-2">{state.error}</p>
              <button type="button" className="bc-btn bc-btn-ghost bc-btn-sm" onClick={loadNextPage}>
                Try again
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <ProductDetailModal
        open={state.detailOpen}
        onClose={() => dispatch(closeMarketplaceDetail())}
        product={state.selectedProduct}
        variations={state.selectedVariations}
        related={state.relatedProducts}
        loading={state.detailStatus === 'loading'}
        onOpenRelated={(id) => dispatch(openMarketplaceProduct(id))}
        onMeToo={isOwnStore ? undefined : handleMeToo}
        onDeleteMeToo={isOwnStore ? undefined : handleDeleteMeToo}
        onResetMeToo={isOwnStore ? undefined : handleResetMeToo}
        meTooLocked={meTooLocked}
        meTooLoading={meTooBusy}
        meTooProductId={state.duplicateProductId}
        deleteMeTooLoading={deleteMeTooBusy}
        deleteMeTooProductId={state.deleteFetchedProductId}
        resetMeTooLoading={resetMeTooBusy}
        resetMeTooProductId={state.resetFetchedProductId}
        hideMeToo={isOwnStore}
        alreadyMeTooIds={alreadyMeTooIdSet}
        placeholderLogoUrl={state.company?.logoUrl || ''}
      />

      <MeTooPriceModal
        open={meTooTargets.length > 0}
        product={meTooTargets[0] || null}
        products={meTooTargets}
        loading={meTooBusy}
        progressText={bulkMeTooProgress}
        onClose={() => {
          if (!meTooBusy) setMeTooTargets([]);
        }}
        onConfirm={handleConfirmMeToo}
      />

      <ConnectedStoreSettingsModal
        open={settingsOpen && canManageSettings}
        connection={
          outgoingConnection
            ? {
                ...outgoingConnection,
                _id: String(outgoingConnection._id || outgoingConnection.id || '').trim(),
                ...normalizeConnectionSyncSettings(outgoingConnection),
              }
            : null
        }
        partnerName={state.company?.name || 'store'}
        onClose={() => setSettingsOpen(false)}
        onSaved={(nextSettings) => {
          const sync = normalizeConnectionSyncSettings(nextSettings || {});
          setOutgoingConnection((prev) => (prev ? { ...prev, ...sync } : prev));
        }}
      />

      <DevApiSourcesFooter sources={apiSources} className="mt-3" />
    </div>
  );
}
