import { useCallback, useEffect, useState } from 'react';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import { stockTransferRequest } from '../../features/stockMovement/stockMovementAPI.js';
import { fetchWarehousesRequest } from '../../features/warehouse/warehouseAPI.js';
import { toast } from '../../utils/toast.js';

const getProductLabel = (p) => p?.product_name || p?.name || p?.sku || p?.product_code || 'Product';

const warehouseOptionValue = (w) => String(w?._id ?? w?.id ?? '').trim();
const warehouseOptionLabel = (w) => {
  const name = w?.name ?? w?.warehouse_name ?? '';
  const code = w?.code ?? w?.warehouse_code ?? '';
  if (name && code) return `${name} (${code})`;
  return name || code || warehouseOptionValue(w) || 'Warehouse';
};

const emptyForm = () => ({
  product_id: '',
  productLabel: '',
  qty: '1',
  from_warehouse_id: '',
  to_warehouse_id: '',
});

export default function StockTransferForm({ show, onClose, onSuccess }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesStatus, setWarehousesStatus] = useState('idle');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState('');

  useEffect(() => {
    if (!show) return undefined;
    let cancelled = false;
    setWarehousesStatus('loading');
    fetchWarehousesRequest({ page: 1, limit: 500 })
      .then((res) => {
        if (!cancelled) {
          setWarehouses(Array.isArray(res?.data) ? res.data : []);
          setWarehousesStatus('succeeded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWarehouses([]);
          setWarehousesStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [show]);

  useEffect(() => {
    if (!show) {
      setForm(emptyForm());
      setErrors({});
      setProductQuery('');
      setProductResults([]);
      setProductSearchError('');
    }
  }, [show]);

  useEffect(() => {
    const q = productQuery.trim();
    if (!show || q.length < 2) {
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
  }, [productQuery, show]);

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

  const validate = () => {
    const next = {};
    if (!String(form.product_id).trim()) next.product_id = 'Product is required';
    const qtyNum = parseInt(String(form.qty).replace(/,/g, ''), 10);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) next.qty = 'Enter a valid quantity';
    if (!String(form.from_warehouse_id).trim()) next.from_warehouse_id = 'From warehouse is required';
    if (!String(form.to_warehouse_id).trim()) next.to_warehouse_id = 'To warehouse is required';
    if (
      form.from_warehouse_id &&
      form.to_warehouse_id &&
      form.from_warehouse_id === form.to_warehouse_id
    ) {
      next.to_warehouse_id = 'To warehouse must differ from from warehouse';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await stockTransferRequest({
        product_id: form.product_id,
        qty: parseInt(String(form.qty).replace(/,/g, ''), 10),
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
      });
      toast.success('Stock moved successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Stock transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">Stock movement</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={isSubmitting} />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" htmlFor="stock-transfer-product">Product <span className="text-danger">*</span></label>
                {form.product_id ? (
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary">{form.productLabel}</span>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm((prev) => ({ ...prev, product_id: '', productLabel: '' }))}>Change</button>
                  </div>
                ) : (
                  <>
                    <input id="stock-transfer-product" type="search" className={`form-control form-control-sm ${errors.product_id ? 'is-invalid' : ''}`} placeholder="Search product…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} disabled={isSubmitting} autoComplete="off" />
                    {productSearchLoading && <div className="small text-muted mt-1">Searching…</div>}
                    {productSearchError && <div className="small text-danger mt-1">{productSearchError}</div>}
                    {productResults.length > 0 && (
                      <ul className="list-group mt-1 shadow-sm" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {productResults.map((p) => (
                          <li key={String(p._id ?? p.id)} className="list-group-item p-0">
                            <button type="button" className="list-group-item list-group-item-action border-0 py-2 px-3 text-start w-100" onClick={() => selectProduct(p)}>{getProductLabel(p)}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {errors.product_id && <div className="invalid-feedback d-block">{errors.product_id}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="stock-transfer-qty">Qty <span className="text-danger">*</span></label>
                <input id="stock-transfer-qty" type="number" min={1} step={1} className={`form-control form-control-sm ${errors.qty ? 'is-invalid' : ''}`} value={form.qty} onChange={(e) => setForm((prev) => ({ ...prev, qty: e.target.value }))} disabled={isSubmitting} />
                {errors.qty && <div className="invalid-feedback">{errors.qty}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="stock-transfer-from">From warehouse <span className="text-danger">*</span></label>
                <select id="stock-transfer-from" className={`form-select form-select-sm ${errors.from_warehouse_id ? 'is-invalid' : ''}`} value={form.from_warehouse_id} onChange={(e) => setForm((prev) => ({ ...prev, from_warehouse_id: e.target.value }))} disabled={isSubmitting || warehousesStatus === 'loading'}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => { const value = warehouseOptionValue(w); if (!value) return null; return <option key={value} value={value}>{warehouseOptionLabel(w)}</option>; })}
                </select>
                {errors.from_warehouse_id && <div className="invalid-feedback">{errors.from_warehouse_id}</div>}
              </div>
              <div className="mb-0">
                <label className="form-label" htmlFor="stock-transfer-to">To warehouse <span className="text-danger">*</span></label>
                <select id="stock-transfer-to" className={`form-select form-select-sm ${errors.to_warehouse_id ? 'is-invalid' : ''}`} value={form.to_warehouse_id} onChange={(e) => setForm((prev) => ({ ...prev, to_warehouse_id: e.target.value }))} disabled={isSubmitting || warehousesStatus === 'loading'}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => { const value = warehouseOptionValue(w); if (!value) return null; return <option key={value} value={value}>{warehouseOptionLabel(w)}</option>; })}
                </select>
                {errors.to_warehouse_id && <div className="invalid-feedback">{errors.to_warehouse_id}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Moving…' : 'Move'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}