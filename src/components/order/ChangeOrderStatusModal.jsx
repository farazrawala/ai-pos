import { useEffect, useState } from 'react';
import { updateOrderInvoiceRequest } from '../../features/orders/ordersAPI.js';

/** Matches backend `order_status` enum. */
export const OMS_ORDER_STATUS_OPTIONS = [
  'active',
  'placed',
  'confirmed',
  'shipped',
  'delivered',
  'drafted',
  'draft',
  'checkout_draft',
  'pending',
  'pending_payment',
  'on_hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
  'processing',
];

export const formatOrderStatusOptionLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const normalizeStatusValue = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');

/**
 * Modal to change an order's `order_status` from the OMS list.
 */
export default function ChangeOrderStatusModal({
  open,
  orderId,
  orderNo,
  currentStatus = '',
  onClose,
  onSaved,
}) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelectedStatus(normalizeStatusValue(currentStatus) || 'placed');
    setSaveStatus('idle');
    setSaveError(null);
  }, [open, currentStatus, orderId]);

  const handleSave = async () => {
    if (!orderId) {
      setSaveError('Missing order id.');
      return;
    }
    const next = normalizeStatusValue(selectedStatus);
    if (!next) {
      setSaveError('Please select a status.');
      return;
    }

    setSaveStatus('loading');
    setSaveError(null);

    try {
      await updateOrderInvoiceRequest(orderId, { order_status: next });
      setSaveStatus('succeeded');
      onSaved?.({ orderId, orderNo, orderStatus: next });
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to update order status.');
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';
  const currentNormalized = normalizeStatusValue(currentStatus);
  const options = [...OMS_ORDER_STATUS_OPTIONS];
  if (currentNormalized && !options.includes(currentNormalized)) {
    options.unshift(currentNormalized);
  }

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="changeOrderStatusModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="changeOrderStatusModalLabel">
                Change order status
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isSaving}
              />
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-3">
                {orderNo ? (
                  <>
                    Update status for order <strong>{orderNo}</strong>.
                  </>
                ) : (
                  'Select a new status for this order.'
                )}
              </p>

              <div className="mb-0">
                <label htmlFor="changeOrderStatusSelect" className="form-label">
                  Status <span className="text-danger">*</span>
                </label>
                <select
                  id="changeOrderStatusSelect"
                  className="form-select"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    if (saveError) setSaveError(null);
                  }}
                  disabled={isSaving}
                >
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {formatOrderStatusOptionLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              {saveError ? (
                <div className="alert alert-danger py-2 mt-3 mb-0">{saveError}</div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary mb-0"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary mb-0"
                onClick={handleSave}
                disabled={isSaving || !orderId || !selectedStatus}
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  'Update status'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
