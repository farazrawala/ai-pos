import { useState } from 'react';
import {
  TCS_LABEL_PRINT_TYPES,
  fetchCourierLabelRequest,
  openCourierLabelForPrint,
} from '../../features/courier/courierAPI.js';

/**
 * Print official TCS CN label (CNPrint PDF via backend → TCS /ecom/api/print/label).
 * @see https://devconnect.tcscourier.com/ecom/index.html
 */
export default function ParcelBarcodePrintModal({
  open,
  onClose,
  orderId = '',
  trackingId = '',
  orderNo = '',
  provider = '',
  customerName = '',
  city = '',
}) {
  const [printtype, setPrinttype] = useState(6);
  const [shipperDetails, setShipperDetails] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const cn = String(trackingId || '').trim();
  const oid = String(orderId || '').trim();
  const isLoading = status === 'loading';

  const handlePrint = async () => {
    if (!oid) {
      setError('Missing order id — book a shipment first, then print the TCS label.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const label = await fetchCourierLabelRequest(oid, {
        printtype,
        shipperDetails,
        accounttype: 1,
      });
      openCourierLabelForPrint(label);
      setStatus('succeeded');
    } catch (err) {
      setStatus('failed');
      setError(err?.message || 'Failed to fetch TCS label PDF');
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="parcelBarcodeModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="parcelBarcodeModalLabel">
                Print TCS label
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isLoading}
              />
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-3">
                Official TCS consignment label (CNPrint PDF) — stick on the parcel.
              </p>

              <div className="border rounded p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between gap-2 small mb-2">
                  <div>
                    <div className="text-muted">CN / Tracking</div>
                    <div className="fw-bold font-monospace">{cn || '—'}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted">Order</div>
                    <div className="fw-bold">{orderNo || '—'}</div>
                  </div>
                </div>
                <div className="d-flex justify-content-between gap-2 small">
                  <div>
                    <div className="text-muted">Courier</div>
                    <div className="fw-semibold">{provider || 'TCS'}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted">Destination</div>
                    <div className="fw-semibold text-uppercase">{city || customerName || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="tcsPrintType">
                  Label layout <span className="text-danger">*</span>
                </label>
                <select
                  id="tcsPrintType"
                  className="form-select"
                  value={printtype}
                  onChange={(e) => setPrinttype(Number(e.target.value))}
                  disabled={isLoading}
                >
                  {TCS_LABEL_PRINT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mb-0 mt-1">
                  From TCS CNPrint API (
                  <code>printtype</code>
                  ). Use <strong>6×4</strong> or <strong>Shipment Label</strong> for parcels.
                </p>
              </div>

              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="tcsShipperDetails"
                  checked={shipperDetails}
                  onChange={(e) => setShipperDetails(e.target.checked)}
                  disabled={isLoading}
                />
                <label className="form-check-label" htmlFor="tcsShipperDetails">
                  Include shipper details on label
                </label>
              </div>

              {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
              {status === 'succeeded' ? (
                <div className="alert alert-success py-2 mt-3 mb-0">
                  TCS label opened. Print from the PDF window and stick it on the parcel.
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary mb-0"
                onClick={onClose}
                disabled={isLoading}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary mb-0"
                onClick={handlePrint}
                disabled={isLoading || !oid}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Fetching TCS PDF…
                  </>
                ) : (
                  'Print TCS label'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />
    </>
  );
}
