import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createAdjustment } from '../../features/adjustments/adjustmentsSlice.js';
import { ADJUSTMENT_TYPE_OPTIONS } from '../../features/adjustments/adjustmentsAPI.js';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

const getProductLabel = (p) =>
  p?.product_name || p?.name || p?.sku || p?.product_code || 'Product';

const AdjustmentAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    product_id: '',
    productLabel: '',
    quantity: '1',
    type: 'add',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState('');

  useEffect(() => {
    const q = productQuery.trim();
    if (q.length < 2) {
      setProductResults([]);
      setProductSearchError('');
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setProductSearchLoading(true);
      setProductSearchError('');
      try {
        const res = await fetchProductActiveRequest({ search: q, page: 1, limit: 30 });
        if (!cancelled) setProductResults(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) {
          setProductResults([]);
          setProductSearchError(e?.message || 'Product search failed');
        }
      } finally {
        if (!cancelled) setProductSearchLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productQuery]);

  const selectProduct = useCallback((product) => {
    const id = String(product?._id ?? product?.id ?? '').trim();
    if (!id) return;
    setForm((prev) => ({
      ...prev,
      product_id: id,
      productLabel: getProductLabel(product),
    }));
    setProductQuery('');
    setProductResults([]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.product_id;
      return next;
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!String(form.product_id || '').trim()) {
      newErrors.product_id = 'Product is required';
    }
    const qty = parseInt(String(form.quantity).replace(/,/g, ''), 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      newErrors.quantity = 'Enter a valid quantity greater than zero';
    }
    if (!String(form.type || '').trim()) {
      newErrors.type = 'Type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const qty = parseInt(String(form.quantity).replace(/,/g, ''), 10);
      await dispatch(
        createAdjustment({
          adjustmentFields: {
            product_id: form.product_id.trim(),
            quantity: qty,
            type: form.type.trim(),
            description: form.description.trim(),
          },
        })
      ).unwrap();
      toast.success('Adjustment created successfully.');
      setTimeout(() => navigate('/adjustments'), 800);
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || (error && String(error)) || 'Could not create adjustment.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add adjustment</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      Saves via <code className="text-xs">POST /adjustment/save</code>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/adjustments')}
                >
                  Back to list
                </button>
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="adjustment-product">
                    Product <span className="text-danger">*</span>
                  </label>
                  {form.product_id ? (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-primary">{form.productLabel}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, product_id: '', productLabel: '' }))
                        }
                        disabled={isSubmitting}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="adjustment-product"
                        type="search"
                        className={`form-control ${errors.product_id ? 'is-invalid' : ''}`}
                        placeholder="Search product (min 2 characters)…"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        disabled={isSubmitting}
                        autoComplete="off"
                      />
                      {productSearchLoading && (
                        <div className="small text-muted mt-1">Searching…</div>
                      )}
                      {productSearchError && (
                        <div className="small text-danger mt-1">{productSearchError}</div>
                      )}
                      {productResults.length > 0 && (
                        <ul
                          className="list-group mt-1 shadow-sm"
                          style={{ maxHeight: '180px', overflowY: 'auto' }}
                        >
                          {productResults.map((p) => (
                            <li key={String(p._id ?? p.id)} className="list-group-item p-0">
                              <button
                                type="button"
                                className="list-group-item list-group-item-action border-0 py-2 px-3 text-start w-100"
                                onClick={() => selectProduct(p)}
                              >
                                {getProductLabel(p)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {errors.product_id && (
                    <div className="invalid-feedback d-block">{errors.product_id}</div>
                  )}
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="adjustment-quantity">
                      Quantity <span className="text-danger">*</span>
                    </label>
                    <input
                      id="adjustment-quantity"
                      type="number"
                      name="quantity"
                      min={1}
                      step={1}
                      className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
                      value={form.quantity}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    {errors.quantity && (
                      <div className="invalid-feedback">{errors.quantity}</div>
                    )}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="adjustment-type">
                      Type <span className="text-danger">*</span>
                    </label>
                    <select
                      id="adjustment-type"
                      name="type"
                      className={`form-select ${errors.type ? 'is-invalid' : ''}`}
                      value={form.type}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    >
                      {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {errors.type && <div className="invalid-feedback">{errors.type}</div>}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="adjustment-description">
                    Description
                  </label>
                  <textarea
                    id="adjustment-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="Optional notes for this adjustment"
                  />
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Create adjustment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/adjustments')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentAdd;
