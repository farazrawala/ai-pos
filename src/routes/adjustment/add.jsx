import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createAdjustment } from '../../features/adjustments/adjustmentsSlice.js';
import { ADJUSTMENT_TYPE_OPTIONS } from '../../features/adjustments/adjustmentsAPI.js';
import { fetchProductActiveRequest, updateProductRequest } from '../../features/products/productsAPI.js';
import {
  createInventoryMovementRequest,
  fetchStockByProductRequest,
} from '../../features/stockMovement/stockMovementAPI.js';
import { getWarehouseIdFromCompany } from '../../features/company/companyAPI.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { formatMoney } from '../../utils/formatMoney.js';
import { toast } from '../../utils/toast.js';
import './adjustment-form-module.css';

const getProductLabel = (p) =>
  p?.product_name || p?.name || p?.sku || p?.product_code || 'Product';

const getProductSku = (p) => String(p?.sku ?? p?.product_code ?? '').trim();

const getProductBarcode = (p) => String(p?.barcode ?? '').trim();

const getProductWholesale = (p) => {
  const raw = p?.wholesale_price ?? p?.wholesalePrice;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const ADJUSTMENT_QTY_MIN = 0.01;

function roundAdjustmentQty(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function parseAdjustmentQty(raw) {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? roundAdjustmentQty(n) : 0;
}

function sanitizeAdjustmentQtyInput(value) {
  const s = String(value ?? '').replace(/,/g, '');
  let out = '';
  let sawDot = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !sawDot) {
      out += ch;
      sawDot = true;
    }
  }
  const dot = out.indexOf('.');
  if (dot !== -1 && out.length - dot - 1 > 2) {
    out = out.slice(0, dot + 3);
  }
  return out;
}

function isPartialAdjustmentQtyInput(value) {
  const s = String(value ?? '').trim();
  if (!s) return true;
  if (s === '.') return true;
  if (s.endsWith('.')) return true;
  return false;
}

function pickWarehouseId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return String(raw._id ?? raw.id ?? '').trim();
  }
  return String(raw).trim();
}

/** Build IN/OUT lines that bring each warehouse net qty to 0. */
function buildZeroStockMovements(stockPayload, fallbackWarehouseId = '') {
  const root =
    stockPayload?.data && typeof stockPayload.data === 'object' && !Array.isArray(stockPayload.data)
      ? stockPayload.data
      : stockPayload;
  const warehouses = Array.isArray(root?.warehouses) ? root.warehouses : [];
  const lines = [];

  for (const row of warehouses) {
    const warehouseId = pickWarehouseId(row?.warehouse_id ?? row?.warehouseId);
    const net = Number(row?.net_qty ?? row?.quantity ?? row?.qty);
    if (!warehouseId || !Number.isFinite(net) || net === 0) continue;
    const qty = roundAdjustmentQty(Math.abs(net));
    if (qty < ADJUSTMENT_QTY_MIN) continue;
    lines.push({
      warehouse_id: warehouseId,
      quantity: qty,
      movement_type: net < 0 ? 'in' : 'out',
    });
  }

  if (lines.length > 0) return lines;

  const netTotal = Number(root?.net_qty);
  const fallbackWid = String(fallbackWarehouseId || '').trim();
  if (fallbackWid && Number.isFinite(netTotal) && netTotal !== 0) {
    const qty = roundAdjustmentQty(Math.abs(netTotal));
    if (qty >= ADJUSTMENT_QTY_MIN) {
      lines.push({
        warehouse_id: fallbackWid,
        quantity: qty,
        movement_type: netTotal < 0 ? 'in' : 'out',
      });
    }
  }
  return lines;
}

const AdjustmentAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authCompany = useSelector((state) => state.user.company);
  const defaultWarehouseId = useMemo(
    () => getWarehouseIdFromCompany(authCompany),
    [authCompany]
  );

  const [form, setForm] = useState({
    product_id: '',
    productLabel: '',
    productSku: '',
    productBarcode: '',
    wholesalePrice: null,
    quantity: '1',
    type: 'add',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isZeroingStock, setIsZeroingStock] = useState(false);
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

  const missingCost = useMemo(() => {
    if (!form.product_id) return false;
    return form.wholesalePrice == null || Number(form.wholesalePrice) === 0;
  }, [form.product_id, form.wholesalePrice]);

  const selectProduct = useCallback((product) => {
    const id = String(product?._id ?? product?.id ?? '').trim();
    if (!id) return;
    setForm((prev) => ({
      ...prev,
      product_id: id,
      productLabel: getProductLabel(product),
      productSku: getProductSku(product),
      productBarcode: getProductBarcode(product),
      wholesalePrice: getProductWholesale(product),
    }));
    setProductQuery('');
    setProductResults([]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.product_id;
      return next;
    });
  }, []);

  const clearProduct = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      product_id: '',
      productLabel: '',
      productSku: '',
      productBarcode: '',
      wholesalePrice: null,
    }));
  }, []);

  const handleZeroStockAndCost = useCallback(async () => {
    const productId = String(form.product_id || '').trim();
    if (!productId) {
      toast.error('Select a product first.');
      return;
    }
    const label = form.productLabel || 'this product';
    const confirmed = window.confirm(
      `Bring stock to 0 (IN if negative, OUT if positive) and set wholesale cost to 0 for "${label}"?`
    );
    if (!confirmed) return;

    setIsZeroingStock(true);
    try {
      const stockPayload = await fetchStockByProductRequest(productId);
      const movements = buildZeroStockMovements(stockPayload, defaultWarehouseId);
      const unitCostRaw = Number(form.wholesalePrice);
      const unit_cost =
        Number.isFinite(unitCostRaw) && unitCostRaw >= 0 ? unitCostRaw : 0;

      for (const line of movements) {
        await createInventoryMovementRequest({
          product_id: productId,
          warehouse_id: line.warehouse_id,
          quantity: line.quantity,
          movement_type: line.movement_type,
          unit_cost,
          reference_type: 'adjustment',
          reference_name: 'Zero stock',
        });
      }

      await updateProductRequest(productId, { wholesale_price: 0 });
      setForm((prev) => ({ ...prev, wholesalePrice: 0 }));

      if (movements.length === 0) {
        toast.success('Stock already 0. Wholesale cost set to 0.');
      } else {
        const summary = movements
          .map((m) => `${m.movement_type.toUpperCase()} ${m.quantity}`)
          .join(', ');
        toast.success(`Stock cleared (${summary}). Wholesale cost set to 0.`);
      }
    } catch (error) {
      toast.error(
        error?.message || (error && String(error)) || 'Could not zero stock and cost.'
      );
    } finally {
      setIsZeroingStock(false);
    }
  }, [form.product_id, form.productLabel, form.wholesalePrice, defaultWarehouseId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleQuantityChange = (e) => {
    const sanitized = sanitizeAdjustmentQtyInput(e.target.value);
    setForm((prev) => ({ ...prev, quantity: sanitized }));
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };

  const handleQuantityBlur = () => {
    if (isPartialAdjustmentQtyInput(form.quantity)) return;
    const qty = parseAdjustmentQty(form.quantity);
    if (qty >= ADJUSTMENT_QTY_MIN) {
      setForm((prev) => ({
        ...prev,
        quantity: Number.isInteger(qty) ? String(qty) : qty.toFixed(2),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!String(form.product_id || '').trim()) {
      newErrors.product_id = 'Product is required';
    }
    const qty = parseAdjustmentQty(form.quantity);
    if (!Number.isFinite(qty) || qty < ADJUSTMENT_QTY_MIN) {
      newErrors.quantity = `Enter a valid quantity of at least ${ADJUSTMENT_QTY_MIN}`;
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

    if (missingCost) {
      toast.error(
        'This product has no wholesale cost. Set wholesale price on the product, or receive stock via a purchase order first.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const qty = parseAdjustmentQty(form.quantity);
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

  const selectedMetaParts = [
    form.productSku ? `SKU ${form.productSku}` : '',
    form.productBarcode ? `Barcode ${form.productBarcode}` : '',
  ].filter(Boolean);

  return (
    <div className="adj-form-page container-fluid py-4 px-3 px-lg-4">
      <div className="card adj-form-card">
        <div className="card-header pb-3">
          <button
            type="button"
            className="adj-form-back"
            onClick={() => navigate('/adjustments')}
          >
            ← Back to adjustments
          </button>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h5 className="adj-form-header-title">Add stock adjustment</h5>
              <p className="adj-form-header-hint">
                Increase or decrease on-hand quantity for a single product.
              </p>
            </div>
          </div>
        </div>

        <div className="card-body pt-3">
          <form onSubmit={handleSubmit} noValidate>
            <div className="adj-form-section">
              <div className="adj-form-section-title">Product</div>
              <label className="form-label" htmlFor="adjustment-product">
                Select product <span className="text-danger">*</span>
              </label>

              {form.product_id ? (
                <>
                  <div className="adj-form-selected-product">
                    <div className="min-w-0">
                      <p className="adj-form-selected-name">{form.productLabel}</p>
                      {selectedMetaParts.length > 0 ? (
                        <p className="adj-form-selected-meta">{selectedMetaParts.join(' · ')}</p>
                      ) : null}
                      <p className="adj-form-selected-meta mb-0">
                        Wholesale cost:{' '}
                        {missingCost ? (
                          <span className="adj-form-cost-warn">Not set (0)</span>
                        ) : (
                          <span className="adj-form-cost-ok">
                            {formatMoney(form.wholesalePrice)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="adj-form-selected-actions flex-shrink-0">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={handleZeroStockAndCost}
                        disabled={isSubmitting || isZeroingStock}
                        title="Set warehouse inventory and wholesale cost to 0"
                      >
                        {isZeroingStock ? 'Zeroing…' : 'Zero stock & cost'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearProduct}
                        disabled={isSubmitting || isZeroingStock}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  {missingCost ? (
                    <div className="alert alert-warning adj-form-alert" role="status">
                      This product needs a wholesale cost before stock can be adjusted. Set the
                      wholesale price on the product, or receive stock through a purchase order.
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="adj-form-product-search">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">
                      <SearchInputIcon />
                    </span>
                    <input
                      id="adjustment-product"
                      type="search"
                      className={`form-control ${errors.product_id ? 'is-invalid' : ''}`}
                      placeholder="Search by name, SKU, or barcode…"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                  </div>
                  {productSearchLoading ? (
                    <div className="small text-muted mt-1">Searching…</div>
                  ) : (
                    <div className="small text-muted mt-1">Type at least 2 characters</div>
                  )}
                  {productSearchError ? (
                    <div className="small text-danger mt-1" role="alert">
                      {productSearchError}
                    </div>
                  ) : null}
                  {productResults.length > 0 ? (
                    <div className="adj-form-product-results position-relative mt-2">
                      {productResults.map((p) => {
                        const wholesale = getProductWholesale(p);
                        const sku = getProductSku(p);
                        const barcode = getProductBarcode(p);
                        const meta = [
                          sku ? `SKU ${sku}` : '',
                          barcode ? `Barcode ${barcode}` : '',
                          wholesale != null && wholesale !== 0
                            ? `Cost ${formatMoney(wholesale)}`
                            : 'Cost not set',
                        ]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <button
                            key={String(p._id ?? p.id)}
                            type="button"
                            className="adj-form-product-result"
                            onClick={() => selectProduct(p)}
                          >
                            <span className="adj-form-product-result-name">
                              {getProductLabel(p)}
                            </span>
                            <span className="adj-form-product-result-meta">{meta}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
              {errors.product_id ? (
                <div className="invalid-feedback d-block">{errors.product_id}</div>
              ) : null}
            </div>

            <div className="adj-form-section">
              <div className="adj-form-section-title">Adjustment details</div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="adjustment-quantity">
                    Quantity <span className="text-danger">*</span>
                  </label>
                  <input
                    id="adjustment-quantity"
                    type="text"
                    name="quantity"
                    inputMode="decimal"
                    className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
                    value={form.quantity}
                    onChange={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    disabled={isSubmitting}
                    placeholder="e.g. 1 or 0.5"
                  />
                  {errors.quantity ? (
                    <div className="invalid-feedback">{errors.quantity}</div>
                  ) : (
                    <div className="form-text">Supports decimals (e.g. 0.5, 2.45)</div>
                  )}
                </div>
                <div className="col-md-6">
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
                  {errors.type ? <div className="invalid-feedback">{errors.type}</div> : null}
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="adjustment-description">
                    Notes
                  </label>
                  <textarea
                    id="adjustment-description"
                    name="description"
                    className="form-control"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="Optional reason for this adjustment"
                  />
                </div>
              </div>
            </div>

            <div className="adj-form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSubmitting || isZeroingStock || missingCost}
              >
                {isSubmitting ? 'Saving…' : 'Create adjustment'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
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
  );
};

export default AdjustmentAdd;
