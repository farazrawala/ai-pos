import { useState, useEffect, useCallback } from 'react';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';

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
      const params = {
        page: 1,
        limit: 2000,
        ...(debouncedQuery ? { search: debouncedQuery } : {}),
        ...(categoryFilter !== 'All' ? { categoryId: categoryFilter } : {}),
      };
      const result = await fetchProductsRequest(params);
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
      <div className="card shadow-sm border-0 h-100 d-flex flex-column">
        <div className="card-body p-3 flex-grow-1 d-flex flex-column">
          <div className="row g-2 mb-3">
            <div className="col">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="fas fa-barcode text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Product name, code or scan barcode"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-auto" style={{ minWidth: 140 }}>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                disabled={categoriesStatus === 'loading'}
                title={categoriesError || undefined}
                aria-label="Filter products by category"
              >
                <option value="All">All</option>
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
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-2">
                {products.map((p, index) => {
                  const id = getProductId(p) || `idx-${index}`;
                  const name = getProductName(p);
                  const imgUrl = getProductImageUrl(p);
                  return (
                    <div className="col" key={id}>
                      <div className="pos-product-card p-2 h-100 d-flex flex-column">
                        <div className="rounded overflow-hidden mb-2 flex-shrink-0">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt=""
                              className="pos-product-img w-100 d-block"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/assets/img/default.jpg';
                              }}
                            />
                          ) : (
                            <div className="pos-product-img w-100 d-flex align-items-center justify-content-center">
                              <i className="fas fa-image text-muted opacity-50 fa-2x"></i>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-center pos-product-name flex-grow-1">{name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pos-footer-actions border-top pt-3 mt-2 d-flex flex-wrap justify-content-end gap-2">
            <button type="button" className="btn btn-draft px-4 py-2">
              <i className="fas fa-save me-2"></i>
              Draft
            </button>
            <button type="button" className="btn btn-pay px-4 py-2">
              <i className="fas fa-money-bill-wave me-2"></i>
              Payment
            </button>
            <button type="button" className="btn btn-card px-4 py-2">
              <i className="far fa-credit-card me-2"></i>
              Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosProducts;
