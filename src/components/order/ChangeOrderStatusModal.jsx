import { useEffect, useState } from 'react';
import { updateOrderStatusRequest } from '../../features/orders/ordersAPI.js';
import { queueOrderPushToStore } from '../../utils/orderStoreSync.js';

/** Matches backend `order_status` enum. */
export const OMS_ORDER_STATUS_OPTIONS = [
  'active', // Live / open POS-style order
  'placed', // Order placed
  'confirmed', // Confirmed for fulfillment
  'duplicate', // Marked duplicate
  'packed', // Packed
  'delivered', // Delivered
  'draft', // Draft / not finalized
  'pending', // Pending
  'on_hold', // Awaiting payment confirmation (e.g. bank transfer)
  'cancelled', // Cancelled by admin or customer
  'failed', // Payment failed or declined
  'processing', // Payment received, awaiting fulfillment
  'return', // Return in progress / recorded
  'return_received', // Return received
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
  orderRow = null,
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
      const fromStatus = normalizeStatusValue(currentStatus);
      const result = await updateOrderStatusRequest(orderId, {
        order_status: next,
        ...(fromStatus ? { from_status: fromStatus } : {}),
      });
      const savedStatus =
        normalizeStatusValue(result?.data?.order?.order_status) || next;
      setSaveStatus('succeeded');

      let storeSyncQueued = false;
      let storeSyncError = null;
      try {
        const pushResult = await queueOrderPushToStore(orderRow, orderId, {
          orderStatus: savedStatus,
        });
        storeSyncQueued = Boolean(pushResult?.queued);
      } catch (err) {
        storeSyncError = err?.message || 'Failed to queue store status sync.';
        console.error('[ChangeOrderStatusModal] store push failed', err);
      }

      onSaved?.({
        orderId,
        orderNo,
        orderStatus: savedStatus,
        previousStatus: result?.data?.previous_status,
        stockAction: result?.data?.stock_action,
        storeSyncQueued,
        storeSyncError,
      });
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to update order status.');
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';
  const currentNormalized = normalizeStatusValue(currentStatus);
  const displayOrderNo =
    orderNo && String(orderNo).trim() !== '' && String(orderNo).trim() !== '—'
      ? String(orderNo).trim()
      : orderId
        ? String(orderId).trim()
        : '';
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
              <div className="min-width-0">
                <h5 className="modal-title mb-0" id="changeOrderStatusModalLabel">
                  Change order status
                </h5>
                {displayOrderNo ? (
                  <p className="text-sm text-primary fw-semibold mb-0 mt-1" title={displayOrderNo}>
                    {displayOrderNo}
                  </p>
                ) : null}
              </div>
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
                {displayOrderNo
                  ? `Update status for order ${displayOrderNo}.`
                  : 'Select a new status for this order.'}
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
