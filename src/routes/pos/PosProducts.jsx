import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaBarcode, FaFloppyDisk, FaMicrophone, FaMoneyBill1 } from 'react-icons/fa6';
import {
  fetchProductActiveRequest,
  POS_PRODUCT_SEARCH_FIELDS,
} from '../../features/products/productsAPI.js';
import {
  getProductListingImage,
  getParentProductId,
} from '../../features/bigCommerce/marketplaceUtils.js';
import NavIcon from '../../components/NavIcon.jsx';
import FetchRetryStatus from '../../components/list/FetchRetryStatus.jsx';
import { withBase } from '../../config/appBase.js';
import {
  formatProductNameWithStock,
  getProductAvailableStock,
  isProductStockBelowMinimum,
} from '../../utils/productStock.js';
import { isVariableParentProduct, sellablePosProductId, isProductInactive } from '../../components/product/productVariationUtils.js';
import { toast } from '../../utils/toast.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { useFetchRetryCountdown } from '../../hooks/useFetchRetryCountdown.js';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js';
import {
  countProducts,
  lookupProductsForScan,
  searchProducts,
} from '../../offline/repositories/productsRepo.js';
import { OFFLINE_CATALOG_EMPTY_MESSAGE } from '../../offline/catalogRead.js';
import { DEBUG } from '../../config/env.js';
import PosPaymentModal from './PosPaymentModal.jsx';
import PosContinuousScanModal from './PosContinuousScanModal.jsx';
import { parsePosVoiceCommand } from './posVoiceCommands.js';

const POS_HIDE_LOW_STOCK_STORAGE_KEY = 'pos.hideLowStock';

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
  const haystacks = [
    product?.barcode,
    product?.sku,
    product?.product_code,
    product?.product_name,
    product?.name,
  ];
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
  const soft = products.filter(
    (p) => !isVariableParentProduct(p) && !isProductInactive(p) && productMatchesSoftQuery(p, query)
  );
  if (soft.length === 1) return soft[0];
  return null;
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
  onPaymentClick,
  onSaveDraft,
  cartLineCount = 0,
  draftSaving = false,
  orderTotal = 0,
  onPaymentComplete,
  onPaymentCompletePrint,
}) => {
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [productsError, setProductsError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hideLowStock, setHideLowStock] = useState(readStoredHideLowStock);
  const [statusFilter, setStatusFilter] = useState('active');
  const [continuousScanOpen, setContinuousScanOpen] = useState(false);
  const searchInputRef = useRef(null);
  /** Latest search text — scanners fire Enter before React state catches up. */
  const productQueryRef = useRef(productQuery);
  /** Prevents double-Enter / overlapping async scans from adding the same (or stale) item twice. */
  const scanInFlightRef = useRef(false);

  useEffect(() => {
    productQueryRef.current = productQuery;
  }, [productQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(productQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [productQuery]);

  const loadProductsFromCache = useCallback(async () => {
    const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
    const cached = await searchProducts({
      query: debouncedQuery,
      categoryId,
      status: statusFilter,
    });
    const totalCached = await countProducts();
    if (totalCached === 0) {
      setProducts([]);
      setProductsError(OFFLINE_CATALOG_EMPTY_MESSAGE);
      setProductsStatus('failed');
      return false;
    }
    setProducts(cached);
    setProductsError(null);
    setProductsStatus('succeeded');
    return true;
  }, [debouncedQuery, categoryFilter, statusFilter]);

  const loadProducts = useCallback(async () => {
    setProductsStatus('loading');
    setProductsError(null);
    const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
    const statusParams =
      statusFilter === 'all'
        ? { includeInactive: true }
        : statusFilter === 'inactive'
          ? { status: 'inactive' }
          : { status: 'active' };

    if (!isOnline) {
      await loadProductsFromCache();
      return;
    }

    try {
      const result = await fetchProductActiveRequest({
        search: debouncedQuery || undefined,
        searchFields: POS_PRODUCT_SEARCH_FIELDS,
        page: 1,
        limit: 2000,
        ...(categoryId ? { categoryId } : {}),
        ...statusParams,
      });
      const arr = Array.isArray(result?.data) ? result.data : [];
      setProducts(arr);
      setProductsStatus('succeeded');
    } catch (err) {
      console.warn('[POS] Failed to load products from API, trying offline cache', err);
      const usedCache = await loadProductsFromCache();
      if (!usedCache) {
        setProducts([]);
        setProductsError(err?.message || 'Could not load products');
        setProductsStatus('failed');
      }
    }
  }, [debouncedQuery, categoryFilter, statusFilter, isOnline, loadProductsFromCache]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
    let list = products.filter((p) => !isVariableParentProduct(p));
    if (statusFilter === 'active') {
      list = list.filter((p) => !isProductInactive(p));
    } else if (statusFilter === 'inactive') {
      list = list.filter((p) => isProductInactive(p));
    }
    if (hideLowStock) {
      list = list.filter((p) => !isProductStockBelowMinimum(p, { warehouseId, minimum: 1 }));
    }
    return list;
  }, [products, hideLowStock, warehouseId, statusFilter]);

  /** Full catalog map so child cards can fall back to parent image even when parents are hidden. */
  const productsById = useMemo(() => {
    const map = new Map();
    for (const item of products) {
      const id = getProductId(item);
      if (id) map.set(id, item);
    }
    return map;
  }, [products]);

  const tryAddSellableProduct = useCallback(
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
      onAddToCart?.(product);
      return 'added';
    },
    [hideLowStock, warehouseId, onAddToCart]
  );

  const findExactProductForQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return null;

      const fromList = pickScannedProduct(products, q);
      if (fromList) return fromList;

      if (isOnline) {
        try {
          const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
          const result = await fetchProductActiveRequest({
            search: q,
            searchFields: POS_PRODUCT_SEARCH_FIELDS,
            page: 1,
            limit: 50,
            ...(categoryId ? { categoryId } : {}),
          });
          const arr = Array.isArray(result?.data) ? result.data : [];
          const picked = pickScannedProduct(arr, q);
          if (picked) return picked;
        } catch (err) {
          console.warn('[POS] Barcode lookup failed, trying offline cache', err);
        }
      }

      try {
        const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
        const cached = await lookupProductsForScan(q, categoryId);
        const picked = pickScannedProduct(cached, q);
        if (picked) return picked;
      } catch (err) {
        console.error('[POS] Offline barcode lookup failed', err);
      }
      return null;
    },
    [products, categoryFilter, isOnline]
  );

  const findSoftProductForQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return null;

      const fromList = pickSoftMatchedProduct(products, q);
      if (fromList) return fromList;

      if (isOnline) {
        try {
          const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
          const result = await fetchProductActiveRequest({
            search: q,
            searchFields: POS_PRODUCT_SEARCH_FIELDS,
            page: 1,
            limit: 50,
            ...(categoryId ? { categoryId } : {}),
          });
          const arr = Array.isArray(result?.data) ? result.data : [];
          const picked = pickSoftMatchedProduct(arr, q);
          if (picked) return picked;
        } catch (err) {
          console.warn('[POS] Voice soft lookup failed', err);
        }
      }

      try {
        const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
        const cached = await searchProducts({
          query: q,
          categoryId,
        });
        const arr = Array.isArray(cached) ? cached : [];
        return pickSoftMatchedProduct(arr, q);
      } catch (err) {
        console.error('[POS] Offline voice soft lookup failed', err);
      }
      return null;
    },
    [products, categoryFilter, isOnline]
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
          const name = getProductName(product);
          toast.success(
            added === 1 ? `Added ${name}` : `Added ${name} × ${added}`
          );
          productQueryRef.current = '';
          setProductQuery('');
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

  const handleSearchKeyDown = useCallback(
    async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // Prefer the ref (updated synchronously in onChange) over React state / DOM.
      // Scanners type + Enter faster than setState flushes, which used to re-add the previous barcode.
      const q = String(
        productQueryRef.current || e.currentTarget?.value || searchInputRef.current?.value || ''
      ).trim();
      if (!q || scanInFlightRef.current) return;

      scanInFlightRef.current = true;
      // Clear immediately so the next scan cannot append onto this barcode, and so a
      // second Enter cannot re-add the same code while the lookup is in flight.
      productQueryRef.current = '';
      setProductQuery('');

      try {
        const result = await tryAddProductFromQuery(q);
        if (result !== 'added') {
          productQueryRef.current = q;
          setProductQuery(q);
          if (result === 'not_found') {
            toast.info('No exact product match for that barcode or code.');
          }
        }
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [tryAddProductFromQuery, setProductQuery]
  );

  const handleContinuousScan = useCallback(
    async (code) => {
      const result = await tryAddProductFromQuery(code);
      if (result === 'not_found') {
        toast.info(`No product for “${code}”`);
      }
      return result;
    },
    [tryAddProductFromQuery]
  );

  return (
    <div className="col-lg-6 col-xl-7">
      <PosPaymentModal
        orderTotal={orderTotal}
        onPayNow={onPaymentComplete}
        onPayNowPrint={onPaymentCompletePrint}
      />
      <PosContinuousScanModal
        open={continuousScanOpen}
        onClose={() => setContinuousScanOpen(false)}
        onScan={handleContinuousScan}
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
                onClick={() => setContinuousScanOpen(true)}
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
                {`GET /product/get-all-active-pos?search=&searchFields=${POS_PRODUCT_SEARCH_FIELDS}&status=${statusFilter}&category_id=`}
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
                placeholder="Name, SKU, or barcode — Enter to add"
                value={productQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  productQueryRef.current = next;
                  setProductQuery(next);
                }}
                onKeyDown={handleSearchKeyDown}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search products by name, code, SKU, or barcode"
              />
            </div>

            <div className="pos-products-toolbar__filters">
              <label className="pos-products-toolbar__field">
                <span>Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  disabled={categoriesStatus === 'loading'}
                  title={categoriesError || undefined}
                  aria-label="Filter products by category"
                >
                  <option value="All">All categories</option>
                  {categories.map((c) => {
                    const id = String(c._id ?? c.id ?? '');
                    if (!id) return null;
                    const label = c.name || c.title || c.category_name || 'Category';
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
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

          <div className="pos-product-grid flex-grow-1">
            {productsStatus === 'loading' && (
              <div className="text-center text-muted py-5">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Loading products…
              </div>
            )}
            {productsStatus !== 'loading' && isRetryingProducts && (
              <FetchRetryStatus countdown={productsRetryCountdown} />
            )}
            {productsStatus !== 'loading' && productsError && !isRetryingProducts && (
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
            {productsStatus !== 'loading' && !productsError && !isRetryingProducts && visibleProducts.length === 0 && (
              <div className="text-center text-muted py-5">
                No products found
                {hideLowStock && products.length > 0 ? (
                  <div className="small mt-1">Try unchecking &quot;Remove stock with less than 1&quot;</div>
                ) : debouncedQuery ? (
                  <div className="small mt-1">Press Enter after scanning a barcode to add it</div>
                ) : null}
              </div>
            )}
            {productsStatus !== 'loading' && visibleProducts.length > 0 && (
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-4 g-3">
                {visibleProducts.map((p, index) => {
                  const id = getProductId(p) || `idx-${index}`;
                  const name = getProductName(p);
                  const stock = getProductAvailableStock(p, { warehouseId });
                  const displayName = formatProductNameWithStock(name, stock);
                  const parentId = getParentProductId(p);
                  const parentProduct = parentId ? productsById.get(parentId) || null : null;
                  const imgUrl = getProductImageUrl(p, parentProduct);
                  return (
                    <div className="col" key={id}>
                      <div
                        className="pos-product-card p-2 h-100 d-flex flex-column"
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
                              className="pos-product-img w-100 d-block"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = withBase('/assets/img/default.jpg');
                              }}
                            />
                          ) : (
                            <div className="pos-product-img w-100 d-flex align-items-center justify-content-center text-muted opacity-50 small">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="text-center pos-product-name flex-grow-1" title={displayName}>
                          {displayName}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pos-footer-actions">
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
            <button type="button" className="btn btn-pay" onClick={() => onPaymentClick?.()}>
              <NavIcon icon={FaMoneyBill1} size={14} className="me-2" />
              Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosProducts;
