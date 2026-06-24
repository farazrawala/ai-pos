import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaBarcode, FaCreditCard, FaFloppyDisk, FaMoneyBill1 } from 'react-icons/fa6';
import {
  fetchProductsRequest,
  fetchProductActiveRequest,
  POS_PRODUCT_SEARCH_FIELDS,
} from '../../features/products/productsAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import NavIcon from '../../components/NavIcon.jsx';
import { withBase } from '../../config/appBase.js';
import {
  formatProductNameWithStock,
  getProductAvailableStock,
  isProductStockBelowMinimum,
} from '../../utils/productStock.js';
import { toast } from '../../utils/toast.js';
import PosPaymentModal from './PosPaymentModal.jsx';

const getProductId = (p) => String(p._id ?? p.id ?? p.product_id ?? '');

const getProductName = (p) => p.name || p.product_name || 'Product';

const getProductMainImageRaw = (p) =>
  p.product_image ||
  (Array.isArray(p.multi_images) && p.multi_images.length > 0 ? p.multi_images[0] : null) ||
  (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null) ||
  p.image ||
  null;

const getProductImageUrl = (p) => {
  const raw = getProductMainImageRaw(p);
  if (raw == null || raw === '') return '';
  return resolveCategoryMediaUrl(raw);
};

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

function pickScannedProduct(products, query) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const exact = products.filter((p) => productMatchesExactQuery(p, query));
  if (exact.length === 1) return exact[0];
  if (products.length === 1) return products[0];
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
  orderTotal = 0,
  onPaymentComplete,
  onPaymentCompletePrint,
}) => {
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [productsError, setProductsError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hideLowStock, setHideLowStock] = useState(true);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(productQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [productQuery]);

  const loadProducts = useCallback(async () => {
    setProductsStatus('loading');
    setProductsError(null);
    try {
      const categoryId = categoryFilter !== 'All' ? categoryFilter : undefined;
      const result = debouncedQuery
        ? await fetchProductActiveRequest({
            search: debouncedQuery,
            searchFields: POS_PRODUCT_SEARCH_FIELDS,
            page: 1,
            limit: 2000,
            ...(categoryId ? { categoryId } : {}),
          })
        : await fetchProductsRequest({
            page: 1,
            limit: 2000,
            ...(categoryId ? { categoryId } : {}),
          });
      const arr = Array.isArray(result?.data) ? result.data : [];
      setProducts(arr);
      setProductsStatus('succeeded');
    } catch (err) {
      console.error('[POS] Failed to load products', err);
      setProducts([]);
      setProductsError(err?.message || 'Could not load products');
      setProductsStatus('failed');
    }
  }, [debouncedQuery, categoryFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    if (!hideLowStock) return products;
    return products.filter(
      (p) => !isProductStockBelowMinimum(p, { warehouseId, minimum: 1 })
    );
  }, [products, hideLowStock, warehouseId]);

  const clearSearchAndRefocus = useCallback(() => {
    setProductQuery('');
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [setProductQuery]);

  const tryAddProductFromQuery = useCallback(
    async (query) => {
      const q = String(query ?? '').trim();
      if (!q) return false;

      const tryAdd = (product) => {
        if (
          hideLowStock &&
          isProductStockBelowMinimum(product, { warehouseId, minimum: 1 })
        ) {
          toast.info('Product hidden — stock is less than 1.');
          return false;
        }
        onAddToCart?.(product);
        clearSearchAndRefocus();
        return true;
      };

      const fromList = pickScannedProduct(products, q);
      if (fromList) {
        return tryAdd(fromList);
      }

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
        if (picked) {
          return tryAdd(picked);
        }
      } catch (err) {
        console.error('[POS] Barcode lookup failed', err);
      }
      return false;
    },
    [products, categoryFilter, onAddToCart, clearSearchAndRefocus, hideLowStock, warehouseId]
  );

  const handleSearchKeyDown = useCallback(
    async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = productQuery.trim();
      if (!q) return;
      await tryAddProductFromQuery(q);
    },
    [productQuery, tryAddProductFromQuery]
  );

  return (
    <div className="col-lg-6 col-xl-7">
      <PosPaymentModal
        orderTotal={orderTotal}
        onPayNow={onPaymentComplete}
        onPayNowPrint={onPaymentCompletePrint}
      />
      <div className="card shadow-sm pos-panel-card h-100 d-flex flex-column">
        <div className="pos-panel-header">
          <h5>Products</h5>
          <p>Search by name, code, SKU, or barcode — scan and press Enter to add</p>
        </div>
        <div className="pos-panel-body flex-grow-1 d-flex flex-column">
          <div className="row g-2 mb-3 pos-search-bar">
            <div className="col">
              <div className="input-group">
                <span className="input-group-text">
                  <NavIcon icon={FaBarcode} size={14} className="text-muted" />
                </span>
                <input
                  ref={searchInputRef}
                  type="search"
                  className="form-control"
                  placeholder="Product name, code, SKU, or barcode — scan + Enter"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Search products by name, code, SKU, or barcode"
                />
              </div>
            </div>
            <div className="col-auto" style={{ minWidth: 160 }}>
              <select
                className="form-select"
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
            </div>
          </div>

          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="posHideLowStock"
              checked={hideLowStock}
              onChange={(e) => setHideLowStock(e.target.checked)}
            />
            <label className="form-check-label text-sm" htmlFor="posHideLowStock">
              Remove stock with less than 1
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
            {productsStatus !== 'loading' && productsError && (
              <div className="alert alert-warning py-2 small mb-2" role="alert">
                {productsError}
              </div>
            )}
            {productsStatus !== 'loading' && !productsError && visibleProducts.length === 0 && (
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
                  const imgUrl = getProductImageUrl(p);
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
