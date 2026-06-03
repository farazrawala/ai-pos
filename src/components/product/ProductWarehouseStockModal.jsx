import { useEffect, useState } from 'react';
import { fetchStockByProductRequest } from '../../features/stockMovement/stockMovementAPI.js';

const formatQty = (n) => {
  if (n == null || n === '') return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString();
};

const mapWarehouseRows = (warehouses) => {
  if (!Array.isArray(warehouses)) return [];
  return warehouses.map((w, index) => ({
    key: String(w.warehouse_id ?? w.warehouseId ?? `wh-${index}`),
    warehouse: w.warehouse_name ?? w.name ?? '—',
    qtyIn: w.qty_in,
    qtyOut: w.qty_out,
    netQty: w.net_qty,
    availableQty: w.available_qty,
  }));
};

export default function ProductWarehouseStockModal({
  open,
  onClose,
  productId,
  productName,
}) {
  const [status, setStatus] = useState('idle');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [displayName, setDisplayName] = useState(productName || 'Product');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !productId) return undefined;

    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      setError(null);
      setRows([]);
      setSummary(null);
      setDisplayName(productName || 'Product');

      try {
        const result = await fetchStockByProductRequest(productId);
        if (cancelled) return;

        const apiName = result?.product?.product_name ?? result?.product?.name;
        if (apiName) setDisplayName(String(apiName));

        setSummary({
          qtyIn: result?.qty_in,
          qtyOut: result?.qty_out,
          netQty: result?.net_qty,
          availableQty: result?.available_qty,
          warehouseCount: result?.warehouse_count,
        });
        setRows(mapWarehouseRows(result?.warehouses));
        setStatus('succeeded');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load warehouse stock');
          setStatus('failed');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, productId, productName]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="productWarehouseStockModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="productWarehouseStockModalLabel">
                Stock by warehouse — {displayName}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {status === 'loading' && (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading warehouse stock…
                </div>
              )}
              {status === 'failed' && <p className="text-danger text-sm mb-0">{error}</p>}
              {status === 'succeeded' && summary && (
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-xs text-muted">Available</div>
                      <div className="font-weight-bold">{formatQty(summary.availableQty)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-xs text-muted">Net qty</div>
                      <div className="font-weight-bold">{formatQty(summary.netQty)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-xs text-muted">Qty in</div>
                      <div className="font-weight-bold text-success">{formatQty(summary.qtyIn)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-xs text-muted">Qty out</div>
                      <div className="font-weight-bold text-danger">{formatQty(summary.qtyOut)}</div>
                    </div>
                  </div>
                </div>
              )}
              {status === 'succeeded' && rows.length === 0 && (
                <p className="text-muted text-sm mb-0">No warehouse stock records found.</p>
              )}
              {status === 'succeeded' && rows.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>Warehouse</th>
                        <th className="text-end">Qty in</th>
                        <th className="text-end">Qty out</th>
                        <th className="text-end">Net qty</th>
                        <th className="text-end">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <td className="text-sm">{row.warehouse}</td>
                          <td className="text-sm text-end text-success">{formatQty(row.qtyIn)}</td>
                          <td className="text-sm text-end text-danger">{formatQty(row.qtyOut)}</td>
                          <td className="text-sm text-end">{formatQty(row.netQty)}</td>
                          <td className="text-sm text-end font-weight-bold">
                            {formatQty(row.availableQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
