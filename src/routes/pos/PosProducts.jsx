import { useState, useEffect, useCallback } from 'react';
import { FaBarcode, FaCreditCard, FaFloppyDisk, FaMoneyBill1 } from 'react-icons/fa6';
import {
  fetchProductsRequest,
  fetchProductActiveRequest,
} from '../../features/products/productsAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import NavIcon from '../../components/NavIcon.jsx';
import { withBase } from '../../config/appBase.js';
import PosPaymentModal, { openPosPaymentModal } from './PosPaymentModal.jsx';

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
  orderTotal = 0,
  onPaymentComplete,
  onPaymentCompletePrint,
}) => {
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [productsError, setProductsError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

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
            searchFields: 'product_name,sku,barcode',
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

  return (
    <div className="col-lg-7 col-xl-8">
      <PosPaymentModal
        orderTotal={orderTotal}
        onPayNow={onPaymentComplete}
        onPayNowPrint={onPaymentCompletePrint}
      />
      <div className="card shadow-sm pos-panel-card h-100 d-flex flex-column">
        <div className="pos-panel-header">
          <h5>Products</h5>
          <p>Search, filter, and add items to the order</p>
        </div>
        <div className="pos-panel-body flex-grow-1 d-flex flex-column">
          <div className="row g-2 mb-3 pos-search-bar">
            <div className="col">
              <div className="input-group">
                <span className="input-group-text">
                  <NavIcon icon={FaBarcode} size={14} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter product name, code, or scan barcode"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
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
            {productsStatus !== 'loading' && !productsError && products.length === 0 && (
              <div className="text-center text-muted py-5">No products found</div>
            )}
            {productsStatus !== 'loading' && products.length > 0 && (
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-5 g-3">
                {products.map((p, index) => {
                  const id = getProductId(p) || `idx-${index}`;
                  const name = getProductName(p);
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
                        <div className="text-center pos-product-name flex-grow-1">{name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pos-footer-actions">
            
            <button type="button" className="btn btn-pay" onClick={() => openPosPaymentModal()}>
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
