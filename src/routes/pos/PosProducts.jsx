import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaBarcode, FaFloppyDisk, FaMicrophone, FaMoneyBill1, FaPenToSquare } from 'react-icons/fa6';
import {
  fetchProductActiveRequest,
  fetchProductVariationRequest,
  POS_PRODUCT_SEARCH_FIELDS,
} from '../../features/products/productsAPI.js';
import {
  getProductListingImage,
  getParentProductId,
  getProductVariations,
} from '../../features/bigCommerce/marketplaceUtils.js';
import NavIcon from '../../components/NavIcon.jsx';
import FetchRetryStatus from '../../components/list/FetchRetryStatus.jsx';
import { withBase, openAppPathInNewTab } from '../../config/appBase.js';
import {
  formatProductNameWithStock,
  getProductAvailableStock,
  isProductStockBelowMinimum,
} from '../../utils/productStock.js';
import {
  isVariableParentProduct,
  sellablePosProductId,
  isProductInactive,
  parentProductIdFromRecord,
} from '../../components/product/productVariationUtils.js';
import { toast } from '../../utils/toast.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { useFetchRetryCountdown } from '../../hooks/useFetchRetryCountdown.js';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js';
import {
  countProducts,
  searchProducts,
  upsertProducts,
} from '../../offline/repositories/productsRepo.js';
import { OFFLINE_CATALOG_EMPTY_MESSAGE } from '../../offline/catalogRead.js';
import { isMasterSyncStale } from '../../offline/masterSync.js';
import { DEBUG } from '../../config/env.js';
import { playPosScanBeep, unlockPosScanAudio } from '../../utils/posScanBeep.js';
import PosPaymentModal from './PosPaymentModal.jsx';
import PosContinuousScanModal from './PosContinuousScanModal.jsx';
import { parsePosVoiceCommand } from './posVoiceCommands.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

/** USB scanners dump keys faster than a person types. */
const SCANNER_INTER_KEY_MS = 60;
const SCANNER_MIN_BURST = 6;
const SCANNER_IDLE_SUBMIT_MS = 90;

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function barcodesMatch(stored, scanned) {
  const a = normalizeSearchToken(stored);
  const b = normalizeSearchToken(scanned);
  if (!a || !b) return false;
  if (a === b) return true;
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length >= 8 && db.length >= 8 && da === db) return true;
  if (da.length >= 12 && db.length >= 12 && (da === `0${db}` || db === `0${da}`)) return true;
  return false;
}

function looksLikeBarcode(value) {
  const s = String(value ?? '').trim();
  if (s.length < 6 || s.length > 64) return false;
  if (/\s/.test(s)) return false;
  // Names like "Macaulay" are not scanner codes — require at least one digit.
  if (!/\d/.test(s)) return false;
  return /^[0-9A-Za-z\-._/]+$/.test(s);
}

const POS_HIDE_LOW_STOCK_STORAGE_KEY = 'pos.hideLowStock';
/** POS catalog page size for browse (empty search) and typed search. */
const POS_PRODUCT_BROWSE_LIMIT = 50;
const POS_PRODUCT_SEARCH_LIMIT = 50;

function posCatalogPageSize(query) {
  return String(query ?? '').trim() ? POS_PRODUCT_SEARCH_LIMIT : POS_PRODUCT_BROWSE_LIMIT;
}

function slicePosCatalogPage(rows, page, pageSize) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || POS_PRODUCT_BROWSE_LIMIT);
  const safePage = Math.max(1, Number(page) || 1);
  return list.slice(0, safePage * size);
}

function posStatusQueryParams(statusFilter) {
  if (statusFilter === 'all') return { includeInactive: true };
  if (statusFilter === 'inactive') return { status: 'inactive' };
  return { status: 'active' };
}

function apiListHasMore(result, pageSize) {
  const limit = Number(result?.limit) || pageSize || POS_PRODUCT_BROWSE_LIMIT;
  const page = Number(result?.page) || 1;
  const totalPages = Number(result?.totalPages);
  const total = Number(result?.total);
  const received = Array.isArray(result?.data) ? result.data.length : 0;
  if (received === 0) return false;
  if (Number.isFinite(totalPages) && totalPages > 0) return page < totalPages;
  if (Number.isFinite(total) && total >= 0) return page * limit < total;
  return received >= limit;
}

/** Load "Remove stock with less than 1" preference from localStorage cache. */
function readStoredHideLowStock() {
  if (typeof window === 'undefined') return true;
  try {
    const value = window.localStorage.getItem(POS_HIDE_LOW_STOCK_STORAGE_KEY);
    if (value === 'true') return true;
    if (value === 'false') return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Persist "Remove stock with less than 1" preference to localStorage cache. */
function persistHideLowStock(hide) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POS_HIDE_LOW_STOCK_STORAGE_KEY, hide ? 'true' : 'false');
  } catch {
    /* ignore quota / private mode */
  }
}

const getProductId = (p) => sellablePosProductId(p);

const getProductName = (p) => p.name || p.product_name || 'Product';

const getProductImageUrl = (p, parent = null) =>
  getProductListingImage(p, { parent }) || '';

function normalizeSearchToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** Match product by exact barcode, SKU, product code, or name (for scanner Enter). */
function productMatchesExactQuery(product, query) {
  const needle = normalizeSearchToken(query);
  if (!needle) return false;
  if (barcodesMatch(product?.barcode, query)) return true;
  const haystacks = [product?.sku, product?.product_code, product?.product_name, product?.name];
  return haystacks.some((v) => v != null && normalizeSearchToken(v) === needle);
}

/**
 * Only exact barcode/SKU/code/name matches are allowed on scan Enter.
 * Never fall back to "only one search result" — that adds the wrong product when
 * the grid still shows a previous fuzzy search hit.
 */
function pickScannedProduct(products, query) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const exact = products.filter((p) => productMatchesExactQuery(p, query));
  if (exact.length === 1) return exact[0];
  return null;
}

/** Soft name/code match for voice — equality or contains, single unambiguous hit only. */
function productMatchesSoftQuery(product, query) {
  const needle = normalizeSearchToken(query);
  if (!needle || needle.length < 2) return false;
  const haystacks = [
    product?.barcode,
    product?.sku,
    product?.product_code,
    product?.product_name,
    product?.name,
  ]
    .map((v) => normalizeSearchToken(v))
    .filter(Boolean);
  return haystacks.some((h) => h === needle || h.includes(needle) || needle.includes(h));
}

function pickSoftMatchedProduct(products, query) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const matchingParentIds = new Set(
    products
      .filter((p) => isVariableParentProduct(p) && productMatchesSoftQuery(p, query))
      .map((p) => sellablePosProductId(p))
      .filter(Boolean)
  );
  const soft = products.filter((p) => {
    if (isVariableParentProduct(p) || isProductInactive(p)) return false;
    if (productMatchesSoftQuery(p, query)) return true;
    const parentId = parentProductIdFromRecord(p);
    return Boolean(parentId && matchingParentIds.has(parentId));
  });
  if (soft.length === 1) return soft[0];
  return null;
}

function nestedChildProducts(product) {
  const kids = product?.childproducts ?? product?.child_products ?? product?.variations;
  return Array.isArray(kids) ? kids : [];
}

function mergeProductRows(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const id = sellablePosProductId(row);
    if (id) byId.set(id, row);
  }
  return Array.from(byId.values());
}

/** POS hides variable parents, so search must surface their sellable children. */
function flattenWithNestedChildren(rows) {
  const out = [];
  for (const row of rows || []) {
    out.push(row);
    if (isVariableParentProduct(row)) {
      for (const child of nestedChildProducts(row)) {
        out.push(asSellableChild(child, row) || child);
      }
    }
  }
  return mergeProductRows(out);
}

function variationsFromApiBody(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body.filter(Boolean);
  const record = body.data ?? body.product ?? body;
  if (Array.isArray(record)) return record.filter(Boolean);
  return getProductVariations(record);
}

function asSellableChild(child, parent) {
  if (!child || typeof child !== 'object') return null;
  const id = sellablePosProductId(child);
  const parentId = sellablePosProductId(parent);
  if (!id || (parentId && id === parentId)) return null;
  const parentName = parent?.product_name || parent?.name || '';
  const childName = child.product_name || child.name || parentName;
  return {
    ...child,
    _id: child._id ?? child.id ?? id,
    product_type: 'Single',
    productType: 'Single',
    product_name: childName,
    name: childName,
    parent_product_id: parentProductIdFromRecord(child) || parentId,
    category_id: child.category_id ?? child.categoryId ?? parent?.category_id ?? parent?.categoryId,
  };
}

async function fetchMissingVariationChildren(rows, { categoryId, statusParams } = {}) {
  const flattened = flattenWithNestedChildren(rows);
  const byId = new Map(flattened.map((p) => [sellablePosProductId(p), p]));
  const childParentIds = new Set(
    flattened.map((p) => parentProductIdFromRecord(p)).filter(Boolean)
  );
  const parentsNeedingKids = flattened.filter((p) => {
    if (!isVariableParentProduct(p)) return false;
    const id = sellablePosProductId(p);
    return Boolean(id && !childParentIds.has(id));
  });
  if (!parentsNeedingKids.length) return flattened;

  const extraBatches = await Promise.all(
    parentsNeedingKids.map(async (parent) => {
      const parentId = sellablePosProductId(parent);
      try {
        const variationBody = await fetchProductVariationRequest(parentId);
        const kids = variationsFromApiBody(variationBody)
          .map((child) => asSellableChild(child, parent))
          .filter(Boolean);
        if (kids.length) return kids;
      } catch (err) {
        console.warn('[POS] Variation lookup failed', parentId, err);
      }
      try {
        const result = await fetchProductActiveRequest({
          search: parentId,
          searchFields: 'parent_product_id',
          page: 1,
          limit: 200,
          ...(categoryId ? { categoryId } : {}),
          ...(statusParams || {}),
        });
        return (Array.isArray(result?.data) ? result.data : [])
          .map((child) => asSellableChild(child, byId.get(parentId) || parent))
          .filter(Boolean);
      } catch (err) {
        console.warn('[POS] Failed to load variations for parent', parentId, err);
        return [];
      }
    })
  );
  return mergeProductRows([...flattened, ...extraBatches.flat()]);
}

/**
 * POS right column: product search, category filter, grid, and checkout actions.
 */
const PosProducts = ({
  productQuery,
  setProductQuery,
  categoryFilter,
  setCategoryFilter,
  categories,
  categoriesStatus,
  categoriesError,
  onAddToCart,
  warehouseId = '',
  companyLogoUrl = '',
  onPaymentClick,
  onSaveDraft,
  cartLineCount = 0,
  draftSaving = false,
  paymentBusy = false,
  orderSaving = false,
  orderTotal = 0,
  onPaymentComplete,
  onPaymentCompletePrint,
  cartLines = [],
  columnClassName = 'col-lg-6 col-xl-7',
  columnStyle,
  productCols = 4,
}) => {
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [productsError, setProductsError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hideLowStock, setHideLowStock] = useState(readStoredHideLowStock);
  const [statusFilter, setStatusFilter] = useState('active');
  const [continuousScanOpen, setContinuousScanOpen] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [catalogReadyForMore, setCatalogReadyForMore] = useState(false);
  const searchInputRef = useRef(null);
  const productGridRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  /** Latest search text — scanners fire Enter before React state catches up. */
  const productQueryRef = useRef(productQuery);
  /** Prevents double-Enter / overlapping async scans from adding the same (or stale) item twice. */
  const scanInFlightRef = useRef(false);
  const scannerBurstRef = useRef({ count: 0, lastAt: 0 });
  const autoScanTimerRef = useRef(null);
  const loadProductsGenRef = useRef(0);
  const catalogPageRef = useRef(1);
  const catalogSourceRef = useRef('api');
  const catalogAllCachedRef = useRef([]);
  const hasMoreProductsRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const catalogReadyForMoreRef = useRef(false);

  useEffect(() => {
    productQueryRef.current = productQuery;
  }, [productQuery]);

  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(productQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [productQuery]);

  const markCatalogReady = useCallback((hasMore) => {
    const more = Boolean(hasMore);
    hasMoreProductsRef.current = more;
    setHasMoreProducts(more);
    catalogReadyForMoreRef.current = true;
    setCatalogReadyForMore(true);
  }, []);

  const applyCachedCatalogPage = useCallback((rows, query) => {
    const all = flattenWithNestedChildren(rows);
    const pageSize = posCatalogPageSize(query);
    catalogAllCachedRef.current = all;
    catalogSourceRef.current = 'cache';
    catalogPageRef.current = 1;
    const first = slicePosCatalogPage(all, 1, pageSize);
    setProducts(first);
    const more = first.length < all.length;
    hasMoreProductsRef.current = more;
    setHasMoreProducts(more);
    return first;
  }, []);

  const loadProductsFromCache = useCallback(async () => {
    const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
    const cached = await searchProducts({
      query: debouncedQuery,
      categoryId,
      status: statusFilter,
    });
    const totalCached = await countProducts();
    if (totalCached === 0) {
      catalogAllCachedRef.current = [];
      catalogSourceRef.current = 'cache';
      catalogPageRef.current = 1;
      setProducts([]);
      markCatalogReady(false);
      setProductsError(OFFLINE_CATALOG_EMPTY_MESSAGE);
      setProductsStatus('failed');
      return false;
    }
    applyCachedCatalogPage(cached, debouncedQuery);
    markCatalogReady(hasMoreProductsRef.current);
    setProductsError(null);
    setProductsStatus('succeeded');
    return true;
  }, [debouncedQuery, categoryFilter, statusFilter, applyCachedCatalogPage, markCatalogReady]);

  const loadProducts = useCallback(async () => {
    const loadGen = ++loadProductsGenRef.current;
    const stillCurrent = () => loadGen === loadProductsGenRef.current;
    catalogReadyForMoreRef.current = false;
    loadMoreInFlightRef.current = false;
    hasMoreProductsRef.current = false;
    setHasMoreProducts(false);
    setLoadingMoreProducts(false);
    setCatalogReadyForMore(false);
    setProductsError(null);
    if (productGridRef.current) productGridRef.current.scrollTop = 0;
    const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
    const statusParams = posStatusQueryParams(statusFilter);
    const pageSize = posCatalogPageSize(debouncedQuery);

    if (!isOnline) {
      setProductsStatus('loading');
      await loadProductsFromCache();
      return;
    }

    // Online: search the local catalog first. get-all-active-pos is too slow
    // to run on every keystroke.
    let hadCache = false;
    let cachedRows = [];
    try {
      const cached = await searchProducts({
        query: debouncedQuery,
        categoryId,
        status: statusFilter,
      });
      const totalCached = await countProducts();
      if (totalCached > 0) {
        hadCache = true;
        if (!stillCurrent()) return;
        cachedRows = applyCachedCatalogPage(cached, debouncedQuery);
        setProductsError(null);
        setProductsStatus('succeeded');
        if (debouncedQuery) {
          markCatalogReady(hasMoreProductsRef.current);
          return;
        }
        try {
          const stale = await isMasterSyncStale();
          if (!stale) {
            markCatalogReady(hasMoreProductsRef.current);
            return;
          }
        } catch {
          /* fall through to a browse-only network refresh */
        }
      } else {
        setProductsStatus('loading');
      }
    } catch (err) {
      console.warn('[POS] Failed to read product cache', err);
      setProductsStatus('loading');
    }

    catalogReadyForMoreRef.current = false;
    try {
      const result = await fetchProductActiveRequest({
        search: debouncedQuery || undefined,
        searchFields: POS_PRODUCT_SEARCH_FIELDS,
        page: 1,
        limit: pageSize,
        ...(categoryId ? { categoryId } : {}),
        ...statusParams,
      });
      const raw = Array.isArray(result?.data) ? result.data : [];
      const arr = await fetchMissingVariationChildren(raw, { categoryId, statusParams });
      if (!stillCurrent()) return;
      catalogSourceRef.current = 'api';
      catalogAllCachedRef.current = [];
      catalogPageRef.current = 1;
      setProducts(arr);
      setProductsError(null);
      setProductsStatus('succeeded');
      markCatalogReady(apiListHasMore({ ...result, data: raw }, pageSize));
      upsertProducts(arr).catch((cacheErr) => {
        console.warn('[POS] Failed to cache products', cacheErr);
      });
    } catch (err) {
      console.warn('[POS] Failed to load products from API, trying offline cache', err);
      if (!stillCurrent()) return;
      if (hadCache && !debouncedQuery) {
        markCatalogReady(hasMoreProductsRef.current);
        return;
      }
      if (hadCache && cachedRows.length > 0) {
        setProducts(cachedRows);
        setProductsError(null);
        setProductsStatus('succeeded');
        markCatalogReady(hasMoreProductsRef.current);
        return;
      }
      const usedCache = await loadProductsFromCache();
      if (!usedCache) {
        setProducts([]);
        markCatalogReady(false);
        setProductsError(err?.message || 'Could not load products');
        setProductsStatus('failed');
      }
    }
  }, [
    debouncedQuery,
    categoryFilter,
    statusFilter,
    isOnline,
    loadProductsFromCache,
    applyCachedCatalogPage,
    markCatalogReady,
  ]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadMoreProducts = useCallback(async () => {
    if (!catalogReadyForMoreRef.current) return;
    if (!hasMoreProductsRef.current || loadMoreInFlightRef.current) return;
    if (productsStatus === 'loading') return;

    const loadGen = loadProductsGenRef.current;
    const stillCurrent = () => loadGen === loadProductsGenRef.current;
    const pageSize = posCatalogPageSize(debouncedQuery);
    const nextPage = catalogPageRef.current + 1;

    loadMoreInFlightRef.current = true;
    setLoadingMoreProducts(true);

    try {
      if (catalogSourceRef.current === 'cache') {
        const all = Array.isArray(catalogAllCachedRef.current) ? catalogAllCachedRef.current : [];
        const nextRows = slicePosCatalogPage(all, nextPage, pageSize);
        if (!stillCurrent()) return;
        catalogPageRef.current = nextPage;
        setProducts(nextRows);
        markCatalogReady(nextRows.length < all.length);
        return;
      }

      if (!isOnline) {
        markCatalogReady(false);
        return;
      }

      const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
      const statusParams = posStatusQueryParams(statusFilter);
      const result = await fetchProductActiveRequest({
        search: debouncedQuery || undefined,
        searchFields: POS_PRODUCT_SEARCH_FIELDS,
        page: nextPage,
        limit: pageSize,
        ...(categoryId ? { categoryId } : {}),
        ...statusParams,
      });
      const raw = Array.isArray(result?.data) ? result.data : [];
      const arr = await fetchMissingVariationChildren(raw, { categoryId, statusParams });
      if (!stillCurrent()) return;
      catalogPageRef.current = nextPage;
      setProducts((prev) => mergeProductRows([...prev, ...arr]));
      markCatalogReady(apiListHasMore({ ...result, data: raw }, pageSize));
      if (arr.length) {
        upsertProducts(arr).catch((cacheErr) => {
          console.warn('[POS] Failed to cache products', cacheErr);
        });
      }
    } catch (err) {
      console.warn('[POS] Failed to load more products', err);
    } finally {
      if (stillCurrent()) {
        loadMoreInFlightRef.current = false;
        setLoadingMoreProducts(false);
      }
    }
  }, [
    productsStatus,
    debouncedQuery,
    categoryFilter,
    statusFilter,
    isOnline,
    markCatalogReady,
  ]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const grid = productGridRef.current;
    if (!sentinel || !catalogReadyForMore || !hasMoreProducts || loadingMoreProducts || productsStatus === 'loading') {
      return undefined;
    }

    const style = grid ? window.getComputedStyle(grid) : null;
    const overflowY = style?.overflowY || '';
    const constrained =
      grid &&
      (overflowY === 'auto' || overflowY === 'scroll') &&
      style?.maxHeight !== 'none' &&
      style?.maxHeight !== '0px';
    const root = constrained ? grid : null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        loadMoreProducts();
      },
      { root, rootMargin: '160px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [catalogReadyForMore, hasMoreProducts, loadingMoreProducts, productsStatus, products.length, loadMoreProducts]);

  const handleRetryProducts = useCallback(() => {
    loadProducts();
  }, [loadProducts]);

  // Same as products list: 5→1 countdown then auto-retry while online.
  // Offline failures mean an empty local catalog — retrying can't fix that.
  const { countdown: productsRetryCountdown, isRetrying: isRetryingProducts } =
    useFetchRetryCountdown({
      isFailed: productsStatus === 'failed',
      onRetry: handleRetryProducts,
      seconds: 5,
      enabled: isOnline,
    });

  const visibleProducts = useMemo(() => {
    const sellable = products.filter((p) => !isVariableParentProduct(p));
    const sellableParentIds = new Set(
      sellable.map((p) => parentProductIdFromRecord(p)).filter(Boolean)
    );
    // Search hits a Variable parent (Products list row). POS cannot sell the
    // parent, but if variations did not load, still show the parent so the
    // match is not a blank grid.
    const unmatchedParents = debouncedQuery
      ? products.filter((p) => {
          if (!isVariableParentProduct(p)) return false;
          const id = sellablePosProductId(p);
          return Boolean(id && !sellableParentIds.has(id));
        })
      : [];
    let list = [...sellable, ...unmatchedParents];
    if (statusFilter === 'active') {
      list = list.filter((p) => !isProductInactive(p));
    } else if (statusFilter === 'inactive') {
      list = list.filter((p) => isProductInactive(p));
    }
    if (hideLowStock) {
      list = list.filter((p) => !isProductStockBelowMinimum(p, { warehouseId, minimum: 1 }));
    }
    return list;
  }, [products, hideLowStock, warehouseId, statusFilter, debouncedQuery]);

  /** Full catalog map so child cards can fall back to parent image even when parents are hidden. */
  const productsById = useMemo(() => {
    const map = new Map();
    for (const item of products) {
      const id = getProductId(item);
      if (id) map.set(id, item);
    }
    return map;
  }, [products]);

  const validateSellableProduct = useCallback(
    (product) => {
      if (isVariableParentProduct(product)) {
        toast.warning(
          'This is a variable product. Scan or select a size/color variation instead.'
        );
        return 'blocked';
      }
      if (
        hideLowStock &&
        isProductStockBelowMinimum(product, { warehouseId, minimum: 1 })
      ) {
        toast.info('Product hidden — stock is less than 1.');
        return 'blocked';
      }
      return 'ok';
    },
    [hideLowStock, warehouseId]
  );

  const tryAddSellableProduct = useCallback(
    (product) => {
      if (validateSellableProduct(product) !== 'ok') return 'blocked';
      onAddToCart?.(product);
      return 'added';
    },
    [validateSellableProduct, onAddToCart]
  );

  const findExactProductForQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return null;

      const fromList = pickScannedProduct(products, q);
      if (fromList) return fromList;

      const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
      try {
        const cached = await searchProducts({
          query: q,
          categoryId,
          status: statusFilter,
        });
        const picked = pickScannedProduct(flattenWithNestedChildren(cached), q);
        if (picked) return picked;
      } catch (err) {
        console.error('[POS] Catalog barcode lookup failed', err);
      }

      if (isOnline) {
        try {
          const result = await fetchProductActiveRequest({
            search: q,
            searchFields: POS_PRODUCT_SEARCH_FIELDS,
            page: 1,
            limit: 50,
            ...(categoryId ? { categoryId } : {}),
          });
          const arr = await fetchMissingVariationChildren(
            Array.isArray(result?.data) ? result.data : [],
            { categoryId }
          );
          const picked = pickScannedProduct(arr, q);
          if (picked) return picked;
        } catch (err) {
          console.warn('[POS] Barcode lookup failed', err);
        }
      }
      return null;
    },
    [products, categoryFilter, statusFilter, isOnline]
  );

  const findSoftProductForQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return null;

      const fromList = pickSoftMatchedProduct(products, q);
      if (fromList) return fromList;

      const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
      try {
        const cached = await searchProducts({
          query: q,
          categoryId,
          status: statusFilter,
        });
        const picked = pickSoftMatchedProduct(flattenWithNestedChildren(cached), q);
        if (picked) return picked;
      } catch (err) {
        console.error('[POS] Catalog voice lookup failed', err);
      }

      if (isOnline) {
        try {
          const result = await fetchProductActiveRequest({
            search: q,
            searchFields: POS_PRODUCT_SEARCH_FIELDS,
            page: 1,
            limit: 50,
            ...(categoryId ? { categoryId } : {}),
          });
          const arr = await fetchMissingVariationChildren(
            Array.isArray(result?.data) ? result.data : [],
            { categoryId }
          );
          return pickSoftMatchedProduct(arr, q);
        } catch (err) {
          console.warn('[POS] Voice soft lookup failed', err);
        }
      }
      return null;
    },
    [products, categoryFilter, statusFilter, isOnline]
  );

  const tryAddProductFromQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return 'not_found';
      const product = await findExactProductForQuery(q);
      if (!product) return 'not_found';
      return tryAddSellableProduct(product);
    },
    [findExactProductForQuery, tryAddSellableProduct]
  );

  const {
    supported: voiceSupported,
    listening: voiceListening,
    interimTranscript: voiceInterim,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition({ lang: 'en-US' });

  const handleVoiceFinal = useCallback(
    async (transcript) => {
      const { qty, query } = parsePosVoiceCommand(transcript);
      if (!query) {
        toast.info('Could not understand a product. Try again.');
        return;
      }
      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      try {
        let product = await findExactProductForQuery(query);
        if (!product) {
          product = await findSoftProductForQuery(query);
        }
        if (!product) {
          playPosScanBeep('error');
          productQueryRef.current = query;
          setProductQuery(query);
          toast.info(`No clear match for “${query}”. Pick from search results.`);
          requestAnimationFrame(() => searchInputRef.current?.focus());
          return;
        }

        let added = 0;
        for (let i = 0; i < qty; i += 1) {
          const result = tryAddSellableProduct(product);
          if (result !== 'added') break;
          added += 1;
        }
        if (added > 0) {
          playPosScanBeep('success');
          const name = getProductName(product);
          toast.success(
            added === 1 ? `Added ${name}` : `Added ${name} × ${added}`
          );
          productQueryRef.current = '';
          setProductQuery('');
        } else {
          playPosScanBeep('error');
        }
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [
      findExactProductForQuery,
      findSoftProductForQuery,
      tryAddSellableProduct,
      setProductQuery,
    ]
  );

  const handleVoiceClick = useCallback(() => {
    if (!voiceSupported) {
      toast.info('Voice input is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (voiceListening) {
      stopVoice();
      return;
    }
    const started = startVoice(handleVoiceFinal);
    if (!started) {
      toast.info('Could not start the microphone. Check browser permissions.');
    }
  }, [voiceSupported, voiceListening, stopVoice, startVoice, handleVoiceFinal]);

  const categoryOptions = useMemo(() => {
    const opts = [{ value: 'All', label: 'All categories' }];
    for (const c of categories || []) {
      const id = String(c._id ?? c.id ?? '').trim();
      if (!id) continue;
      opts.push({
        value: id,
        label: c.name || c.title || c.category_name || 'Category',
      });
    }
    return opts;
  }, [categories]);

  const clearAutoScanTimer = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
  }, []);

  const submitScannedCode = useCallback(
    async (rawQuery, { restoreOnMiss = true, notFoundMessage } = {}) => {
      const q = String(rawQuery ?? '').trim();
      if (!q || scanInFlightRef.current) return null;

      unlockPosScanAudio();
      scanInFlightRef.current = true;
      clearAutoScanTimer();
      scannerBurstRef.current = { count: 0, lastAt: 0 };
      productQueryRef.current = '';
      setProductQuery('');

      try {
        const result = await tryAddProductFromQuery(q);
        if (result === 'added') {
          playPosScanBeep('success');
        } else {
          playPosScanBeep('error');
          if (restoreOnMiss) {
            productQueryRef.current = q;
            setProductQuery(q);
          }
          if (result === 'not_found') {
            toast.info(notFoundMessage || 'No exact product match for that barcode or code.');
          }
        }
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return result;
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [tryAddProductFromQuery, setProductQuery, clearAutoScanTimer]
  );

  const submitNamedProductQuery = useCallback(
    async (rawQuery) => {
      const q = String(rawQuery ?? '').trim();
      if (!q || scanInFlightRef.current) return null;

      unlockPosScanAudio();
      scanInFlightRef.current = true;
      try {
        let product = await findExactProductForQuery(q);
        if (!product) product = await findSoftProductForQuery(q);
        if (product) {
          const result = tryAddSellableProduct(product);
          if (result === 'added') {
            playPosScanBeep('success');
            productQueryRef.current = '';
            setProductQuery('');
            toast.success(`Added ${getProductName(product)}`);
          } else {
            playPosScanBeep('error');
          }
          requestAnimationFrame(() => searchInputRef.current?.focus());
          return result;
        }
        // Keep the typed name so debounce/API search can fill the grid.
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return 'not_found';
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [findExactProductForQuery, findSoftProductForQuery, tryAddSellableProduct, setProductQuery]
  );

  const handleSearchKeyDown = useCallback(
    async (e) => {
      unlockPosScanAudio();
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = String(
          productQueryRef.current || e.currentTarget?.value || searchInputRef.current?.value || ''
        ).trim();
        if (!q) return;
        if (looksLikeBarcode(q)) {
          await submitScannedCode(q);
          return;
        }
        await submitNamedProductQuery(q);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        const burst = scannerBurstRef.current;
        burst.count = now - burst.lastAt <= SCANNER_INTER_KEY_MS ? burst.count + 1 : 1;
        burst.lastAt = now;
      }
    },
    [submitScannedCode, submitNamedProductQuery]
  );

  const handleSearchChange = useCallback(
    (e) => {
      const next = e.target.value;
      productQueryRef.current = next;
      setProductQuery(next);

      const burst = scannerBurstRef.current;
      if (burst.count < SCANNER_MIN_BURST || !looksLikeBarcode(next)) {
        clearAutoScanTimer();
        return;
      }
      clearAutoScanTimer();
      autoScanTimerRef.current = setTimeout(() => {
        const q = String(productQueryRef.current || '').trim();
        if (scannerBurstRef.current.count >= SCANNER_MIN_BURST && looksLikeBarcode(q)) {
          submitScannedCode(q);
        }
      }, SCANNER_IDLE_SUBMIT_MS);
    },
    [setProductQuery, clearAutoScanTimer, submitScannedCode]
  );

  const handleSearchPaste = useCallback(
    (e) => {
      const text = String(e.clipboardData?.getData('text') || '').trim();
      if (!looksLikeBarcode(text) || text.length < 8) return;
      e.preventDefault();
      submitScannedCode(text);
    },
    [submitScannedCode]
  );

  const handleContinuousScan = useCallback(
    async (code) => {
      unlockPosScanAudio();
      const q = String(code ?? '').trim();
      const product = await findExactProductForQuery(q);
      if (!product) {
        playPosScanBeep('error');
        return { status: 'not_found', code: q, product: null };
      }
      if (validateSellableProduct(product) !== 'ok') {
        playPosScanBeep('error');
        return { status: 'blocked', code: q, product };
      }
      playPosScanBeep('success');
      return { status: 'added', code: q, product };
    },
    [findExactProductForQuery, validateSellableProduct]
  );

  const handleConfirmScanDraft = useCallback(
    (lines, { silent = false } = {}) => {
      if (!Array.isArray(lines) || lines.length === 0) return false;
      let addedCount = 0;
      for (const line of lines) {
        const product = line?.product;
        if (!product) continue;
        const qty = parseFloat(String(line.quantity ?? '').replace(/,/g, '').trim());
        const ok = onAddToCart?.(product, Number.isFinite(qty) && qty > 0 ? qty : 1, {
          silent: true,
        });
        if (ok) addedCount += 1;
      }
      if (addedCount > 0) {
        playPosScanBeep('success');
        if (!silent) {
          toast.success(addedCount === 1 ? 'Added to cart' : `Added ${addedCount} items to cart`);
        }
        return true;
      }
      return false;
    },
    [onAddToCart]
  );

  const pendingSaveDraftAfterScanRef = useRef(false);
  const handleRequestSaveDraftFromScan = useCallback(() => {
    pendingSaveDraftAfterScanRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingSaveDraftAfterScanRef.current) return;
    if (continuousScanOpen) return;
    if (cartLineCount < 1) return;
    pendingSaveDraftAfterScanRef.current = false;
    onSaveDraft?.();
  }, [continuousScanOpen, cartLineCount, onSaveDraft]);

  return (
    <div className={columnClassName} style={columnStyle}>
      <PosPaymentModal
        orderTotal={orderTotal}
        saving={orderSaving}
        onPayNow={onPaymentComplete}
        onPayNowPrint={onPaymentCompletePrint}
      />
      <PosContinuousScanModal
        open={continuousScanOpen}
        onClose={() => setContinuousScanOpen(false)}
        onScan={handleContinuousScan}
        cartLines={cartLines}
        onConfirmDraft={handleConfirmScanDraft}
        onSaveDraft={handleRequestSaveDraftFromScan}
        onCheckout={onPaymentClick}
        checkoutBusy={paymentBusy || draftSaving}
        draftSaving={draftSaving}
        isOnline={isOnline}
        companyLogoUrl={companyLogoUrl}
      />
      <div className="card shadow-sm pos-panel-card h-100 d-flex flex-column">
        <div className="pos-panel-header">
          <div className="pos-panel-header__row">
            <div>
              <h5>Products</h5>
              <p>
                {voiceListening
                  ? voiceInterim
                    ? `Listening… “${voiceInterim}”`
                    : 'Listening… say a product name or barcode'
                  : 'Search, filter, scan, or speak a product into the cart'}
              </p>
            </div>
            <div className="pos-panel-header__actions">
              <button
                type="button"
                className={`pos-voice-btn${voiceListening ? ' is-listening' : ''}`}
                onClick={handleVoiceClick}
                title={
                  voiceSupported
                    ? voiceListening
                      ? 'Stop listening'
                      : 'Speak a product name or barcode to add to cart'
                    : 'Voice input not supported in this browser'
                }
                aria-label={
                  voiceListening ? 'Stop voice input' : 'Add product by voice'
                }
                aria-pressed={voiceListening}
              >
                <NavIcon icon={FaMicrophone} size={14} />
                <span>{voiceListening ? 'Listening' : 'Voice'}</span>
              </button>
              <button
                type="button"
                className="pos-scan-btn"
                onClick={() => {
                  unlockPosScanAudio();
                  setContinuousScanOpen(true);
                }}
                title="Open camera and keep scanning barcodes into the cart"
                aria-label="Open continuous barcode scanner"
              >
                <NavIcon icon={FaBarcode} size={14} />
                <span>Scan</span>
              </button>
            </div>
          </div>
          {DEBUG ? (
            <p className="pos-panel-header__debug mb-0">
              <code>
                {debouncedQuery
                  ? `IndexedDB catalog search=${JSON.stringify(debouncedQuery)} status=${statusFilter} page=${catalogPageRef.current} hasMore=${hasMoreProducts}`
                  : `catalog/API browse limit=${POS_PRODUCT_BROWSE_LIMIT} page=${catalogPageRef.current} hasMore=${hasMoreProducts} status=${statusFilter}`}
              </code>
            </p>
          ) : null}
        </div>
        <div className="pos-panel-body flex-grow-1 d-flex flex-column">
          <div className="pos-products-toolbar">
            <div className="pos-products-toolbar__search">
              <span className="pos-products-toolbar__icon" aria-hidden="true">
                <NavIcon icon={FaBarcode} size={14} />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                className="pos-products-toolbar__input"
                placeholder="Scan barcode or type name — Enter to add"
                value={productQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                onPaste={handleSearchPaste}
                onFocus={unlockPosScanAudio}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search products by name, code, SKU, or barcode"
              />
            </div>

            <div className="pos-products-toolbar__filters">
              <label className="pos-products-toolbar__field">
                <span>Category</span>
                <SearchableSelect
                  options={categoryOptions}
                  value={categoryFilter}
                  placeholder="All categories"
                  disabled={categoriesStatus === 'loading'}
                  loading={categoriesStatus === 'loading'}
                  onChange={setCategoryFilter}
                />
                {categoriesError ? (
                  <span className="pos-products-toolbar__field-error" title={categoriesError}>
                    {categoriesError}
                  </span>
                ) : null}
              </label>
              <label className="pos-products-toolbar__field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter products by status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>

            <label className="pos-products-toolbar__check" htmlFor="posHideLowStock">
              <input
                type="checkbox"
                id="posHideLowStock"
                checked={hideLowStock}
                onChange={(e) => {
                  const next = e.target.checked;
                  setHideLowStock(next);
                  persistHideLowStock(next);
                }}
              />
              <span>Hide stock below 1</span>
            </label>
          </div>

          <div className="pos-product-grid flex-grow-1" ref={productGridRef}>
            {productsStatus === 'loading' && products.length === 0 && (
              <div className="text-center text-muted py-5">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Loading products…
              </div>
            )}
            {!(productsStatus === 'loading' && products.length === 0) && isRetryingProducts && (
              <FetchRetryStatus countdown={productsRetryCountdown} />
            )}
            {!(productsStatus === 'loading' && products.length === 0) &&
              productsError &&
              !isRetryingProducts && (
              <div className="alert alert-warning py-2 small mb-2" role="alert">
                {productsError}
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning mb-0"
                    onClick={handleRetryProducts}
                  >
                    Retry now
                  </button>
                </div>
              </div>
            )}
            {!(productsStatus === 'loading' && products.length === 0) &&
              !productsError &&
              !isRetryingProducts &&
              visibleProducts.length === 0 &&
              !hasMoreProducts &&
              !loadingMoreProducts && (
              <div className="text-center text-muted py-5">
                No products found
                {hideLowStock &&
                products.some((p) => !isVariableParentProduct(p)) ? (
                  <div className="small mt-1">Try unchecking &quot;Remove stock with less than 1&quot;</div>
                ) : debouncedQuery ? (
                  <div className="small mt-1">Try a different name, SKU, or barcode</div>
                ) : (
                  <div className="small mt-1">Scan a barcode to add it to the cart</div>
                )}
              </div>
            )}
            {!(productsStatus === 'loading' && products.length === 0) && visibleProducts.length > 0 && (
              <div
                className="pos-product-grid__row"
                style={{ '--pos-product-cols': String(productCols) }}
              >
                {visibleProducts.map((p, index) => {
                  const productId = getProductId(p);
                  const id = productId || `idx-${index}`;
                  const name = getProductName(p);
                  const stock = getProductAvailableStock(p, { warehouseId });
                  const displayName = formatProductNameWithStock(name, stock);
                  const parentId = getParentProductId(p);
                  const parentProduct = parentId ? productsById.get(parentId) || null : null;
                  const productImgUrl = getProductImageUrl(p, parentProduct);
                  const imgUrl = productImgUrl || companyLogoUrl || '';
                  const usingCompanyLogo = !productImgUrl && Boolean(companyLogoUrl);
                  const editProductId = parentId || productId;
                  return (
                    <div className="pos-product-grid__item" key={id}>
                      <div
                        className={`pos-product-card p-2 h-100 d-flex flex-column pos-product-card--cols-${productCols}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onAddToCart?.(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onAddToCart?.(p);
                          }
                        }}
                      >
                        <div className="rounded overflow-hidden mb-2 flex-shrink-0">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt=""
                              data-using-logo={usingCompanyLogo ? '1' : '0'}
                              className={`pos-product-img w-100 d-block${
                                usingCompanyLogo ? ' pos-product-img--logo' : ''
                              }`}
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.onerror = null;
                                if (companyLogoUrl && img.dataset.usingLogo !== '1') {
                                  img.dataset.usingLogo = '1';
                                  img.src = companyLogoUrl;
                                  img.classList.add('pos-product-img--logo');
                                  return;
                                }
                                img.src = withBase('/assets/img/default.jpg');
                                img.classList.remove('pos-product-img--logo');
                              }}
                            />
                          ) : (
                            <div className="pos-product-img w-100 d-flex align-items-center justify-content-center text-muted opacity-50 small">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="pos-product-name-row flex-grow-1">
                          <div className="text-center pos-product-name" title={displayName}>
                            {displayName}
                          </div>
                          {editProductId ? (
                            <button
                              type="button"
                              className="pos-product-edit-btn"
                              title="Edit product (opens in browser)"
                              aria-label={`Edit ${name}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openAppPathInNewTab(`/products/edit/${editProductId}`);
                              }}
                            >
                              <NavIcon icon={FaPenToSquare} size={11} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!(productsStatus === 'loading' && products.length === 0) && hasMoreProducts ? (
              <div
                ref={loadMoreSentinelRef}
                className="pos-product-grid__more"
                aria-live="polite"
              >
                {loadingMoreProducts ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Loading more…
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pos-footer-actions d-none d-lg-flex">
            <button
              type="button"
              className="btn btn-draft"
              onClick={() => onSaveDraft?.()}
              disabled={draftSaving || cartLineCount < 1 || !isOnline}
              title={
                !isOnline
                  ? 'Connect to the internet to save drafts'
                  : cartLineCount < 1
                    ? 'Add items to the cart before saving a draft'
                    : 'Save current cart as a draft'
              }
            >
              <NavIcon icon={FaFloppyDisk} size={14} className="me-2" />
              {draftSaving ? 'Saving…' : 'Draft'}
            </button>
            <button
              type="button"
              className="btn btn-pay"
              onClick={() => onPaymentClick?.()}
              disabled={paymentBusy || draftSaving || cartLineCount < 1}
              title={
                paymentBusy
                  ? 'Processing payment…'
                  : cartLineCount < 1
                    ? 'Add items to the cart before payment'
                    : 'Proceed to payment'
              }
              aria-busy={paymentBusy ? 'true' : 'false'}
            >
              {paymentBusy && !orderSaving ? (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              ) : (
                <NavIcon icon={FaMoneyBill1} size={14} className="me-2" />
              )}
              {paymentBusy && !orderSaving ? 'Processing…' : 'Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosProducts;
