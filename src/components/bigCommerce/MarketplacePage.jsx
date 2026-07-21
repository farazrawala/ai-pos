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
  loadAlreadyMeTooIds,
  selectBigCommerce,
} from '../../features/bigCommerce/bigCommerceSlice.js';
import { fetchMarketplaceProductByIdRequest } from '../../features/bigCommerce/bigCommerceAPI.js';
import {
  excludeChildProducts,
  getProductName,
  isAlreadyMeTooProduct,
  productIdFromRecord,
} from '../../features/bigCommerce/marketplaceUtils.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { showToast } from '../../utils/toast.js';
import CompanyProfileHeader from './CompanyProfileHeader.jsx';
import MarketplaceFilters from './MarketplaceFilters.jsx';
import MarketplaceListingTabs from './MarketplaceListingTabs.jsx';
import ProductToolbar from './ProductToolbar.jsx';
import ProductCard, { ProductCardSkeleton } from './ProductCard.jsx';
import ProductDetailModal from './ProductDetailModal.jsx';

const LISTING_TAB_ALL = 'all';
const LISTING_TAB_ME_TOO = 'me-too';

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
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const meTooResolveGenRef = useRef(0);

  const isOwnStore =
    Boolean(sessionCompanyId) &&
    String(sessionCompanyId) === String(companyId || state.companyId || '').trim();
  const meTooBusy = state.duplicateStatus === 'loading';
  const deleteMeTooBusy = state.deleteFetchedStatus === 'loading';

  const initialLoading =
    state.productsStatus === 'loading' && state.products.length === 0;
  const loadingMore = state.productsStatus === 'loadingMore';
  const isBusy =
    state.productsStatus === 'loading' || state.productsStatus === 'loadingMore';

  useEffect(() => {
    loadingRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    const id = String(companyId || '').trim();
    setSearchDraft('');
    setListingTab(LISTING_TAB_ALL);
    setMeTooResolved([]);
    setMeTooResolveStatus('idle');
    meTooResolveGenRef.current += 1;
    dispatch(setMarketplaceCompanyId(id));
    dispatch(loadMarketplaceBootstrap({ companyId: id }));
  }, [companyId, dispatch]);

  useEffect(() => {
    if (isOwnStore && listingTab === LISTING_TAB_ME_TOO) {
      setListingTab(LISTING_TAB_ALL);
    }
  }, [isOwnStore, listingTab]);

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
    if (state.duplicateStatus === 'succeeded') {
      const name = state.duplicateProductName || getProductName(state.selectedProduct) || 'Product';
      showToast({
        message: state.duplicateAlreadyFetched
          ? `"${name}" is already in your catalog.`
          : `"${name}" was added to your catalog.`,
        variant: 'success',
      });
      dispatch(clearDuplicateStatus());
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

  const handleMeToo = useCallback(
    (item) => {
      if (isOwnStore || meTooBusy || deleteMeTooBusy) return;
      const id = productIdFromRecord(item);
      if (!id) {
        showToast({ message: 'Product id is missing.', variant: 'error' });
        return;
      }
      dispatch(
        duplicateMarketplaceProduct({
          productId: id,
          productName: getProductName(item) || 'Product',
        })
      );
    },
    [dispatch, isOwnStore, meTooBusy, deleteMeTooBusy]
  );

  const handleDeleteMeToo = useCallback(
    (item) => {
      if (isOwnStore || deleteMeTooBusy || meTooBusy) return;
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
      isOwnStore,
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

  const alreadyMeTooCount = useMemo(
    () => new Set((state.alreadyMeTooIds || []).map(String).filter(Boolean)).size,
    [state.alreadyMeTooIds]
  );

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
    return [...byId.values()];
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
    const missing = ids.filter((id) => !haveFromCatalog.has(id));
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
  }, [isOwnStore, listingTab, alreadyMeTooIdKey, meTooCatalogIdKey]);

  const isMeTooTab = !isOwnStore && listingTab === LISTING_TAB_ME_TOO;

  const displayProducts = useMemo(() => {
    if (!isMeTooTab) return visibleProducts;
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
  }, [isMeTooTab, visibleProducts, meTooProducts, searchDraft]);

  const priceBounds = useMemo(() => {
    let max = 1000;
    for (const p of visibleProducts) {
      const price = Number(p?.price ?? p?.product_price ?? 0);
      if (price > max) max = price;
    }
    return { min: 0, max: Math.ceil(max / 100) * 100 || 100000 };
  }, [visibleProducts]);

  const showing = displayProducts.length;
  const showingTotal = isMeTooTab
    ? String(searchDraft || '').trim()
      ? displayProducts.length
      : alreadyMeTooCount
    : state.pagination.total;
  const meTooInitialLoading =
    isMeTooTab &&
    displayProducts.length === 0 &&
    !String(searchDraft || '').trim() &&
    (state.alreadyMeTooStatus === 'loading' || meTooResolveStatus === 'loading');

  return (
    <div className="bc-marketplace">
      <CompanyProfileHeader
        company={state.company}
        loading={state.bootstrapStatus === 'loading'}
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
            allCount={state.pagination.total}
            meTooCount={alreadyMeTooCount}
            showMeTooTab={!isOwnStore}
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
                    meTooLoading={
                      meTooBusy &&
                      state.duplicateProductId === productIdFromRecord(product)
                    }
                    deleteMeTooLoading={
                      deleteMeTooBusy &&
                      state.deleteFetchedProductId === productIdFromRecord(product)
                    }
                    hideMeToo={isOwnStore}
                    alreadyMeTooIds={alreadyMeTooIdSet}
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
        meTooLoading={meTooBusy}
        meTooProductId={state.duplicateProductId}
        deleteMeTooLoading={deleteMeTooBusy}
        deleteMeTooProductId={state.deleteFetchedProductId}
        hideMeToo={isOwnStore}
        alreadyMeTooIds={alreadyMeTooIdSet}
      />
    </div>
  );
}
