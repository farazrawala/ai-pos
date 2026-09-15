import { useEffect, useMemo, useState } from 'react';
import {
  TCS_LABEL_PRINT_TYPES,
  fetchCourierLabelRequest,
  openCourierLabelForPrint,
} from '../../features/courier/courierAPI.js';

/**
 * Print official courier label PDF (TCS CNPrint / PostEx airway bill).
 * Pass `orders` for bulk print; otherwise uses single order props.
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
  orders = null,
}) {
  const [printtype, setPrinttype] = useState(6);
  const [shipperDetails, setShipperDetails] = useState(true);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const orderList = useMemo(() => {
    if (Array.isArray(orders) && orders.length > 0) {
      return orders
        .map((item) => ({
          orderId: String(item?.orderId || item?.id || '').trim(),
          trackingId: String(item?.trackingId || item?.tracking_id || '').trim(),
          orderNo: String(item?.orderNo || item?.order_no || '').trim(),
          provider: String(item?.provider || item?.courier || '').trim(),
          customerName: String(item?.customerName || item?.name || '').trim(),
          city: String(item?.city || '').trim(),
        }))
        .filter((item) => item.orderId);
    }
    const id = String(orderId || '').trim();
    if (!id) return [];
    return [
      {
        orderId: id,
        trackingId: String(trackingId || '').trim(),
        orderNo: String(orderNo || '').trim(),
        provider: String(provider || '').trim(),
        customerName: String(customerName || '').trim(),
        city: String(city || '').trim(),
      },
    ];
  }, [orders, orderId, trackingId, orderNo, provider, customerName, city]);

  const isBulk = orderList.length > 1;
  const primary = orderList[0] || null;
  const isLoading = status === 'loading';
  const courierLabel = String(primary?.provider || 'TCS').trim() || 'TCS';
  const isPostex = /postex/i.test(courierLabel);
  const hasAnyTcs = orderList.some((item) => !/postex/i.test(String(item.provider || '')));

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setError('');
    setProgress('');
    setShipperDetails(true);
  }, [open, orderList]);

  const handlePrint = async () => {
    if (!orderList.length) {
      setError('Missing order id — book a shipment first, then print the label.');
      return;
    }
    setStatus('loading');
    setError('');
    setProgress('');

    const failures = [];
    let opened = 0;

    try {
      for (let i = 0; i < orderList.length; i += 1) {
        const order = orderList[i];
        if (isBulk) {
          setProgress(
            `Printing ${i + 1} of ${orderList.length}` +
              (order.orderNo ? ` (${order.orderNo})` : '') +
              '…'
          );
        }
        try {
          const label = await fetchCourierLabelRequest(order.orderId, {
            printtype,
            shipperDetails,
            accounttype: 1,
          });
          openCourierLabelForPrint(label);
          opened += 1;
        } catch (err) {
          failures.push({
            orderNo: order.orderNo || order.orderId,
            message: err?.message || 'Failed to fetch courier label PDF',
          });
          if (!isBulk) throw err;
        }
      }

      setProgress('');
      if (!opened) {
        setStatus('failed');
        setError(failures[0]?.message || 'Failed to fetch courier label PDF');
        return;
      }

      setStatus('succeeded');
      if (failures.length) {
        setError(
          failures.map((item) => `${item.orderNo}: ${item.message}`).join('\n')
        );
      }
    } catch (err) {
      setStatus('failed');
      setProgress('');
      setError(err?.message || 'Failed to fetch courier label PDF');
    }
  };

  if (!open) return null;

  const titleCourier = isBulk
    ? 'labels'
    : isPostex
      ? 'PostEx'
      : courierLabel;

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
                {isBulk
                  ? `Print labels (${orderList.length})`
                  : `Print ${titleCourier} label`}
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
                Official courier consignment label (PDF) — stick on the parcel.
              </p>

              {isBulk ? (
                <div
                  className="border rounded p-2 mb-3 bg-light small"
                  style={{ maxHeight: 140, overflowY: 'auto' }}
                >
                  {orderList.map((order) => (
                    <div
                      key={order.orderId}
                      className="d-flex justify-content-between gap-2 mb-1"
                    >
                      <span className="fw-semibold">
                        {order.orderNo || order.orderId}
                      </span>
                      <span className="font-monospace text-muted">
                        {order.trackingId || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded p-3 mb-3 bg-light">
                  <div className="d-flex justify-content-between gap-2 small mb-2">
                    <div>
                      <div className="text-muted">CN / Tracking</div>
                      <div className="fw-bold font-monospace">
                        {primary?.trackingId || '—'}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted">Order</div>
                      <div className="fw-bold">{primary?.orderNo || '—'}</div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between gap-2 small">
                    <div>
                      <div className="text-muted">Courier</div>
                      <div className="fw-semibold">{courierLabel}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted">Destination</div>
                      <div className="fw-semibold text-uppercase">
                        {primary?.city || primary?.customerName || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(!isBulk && !isPostex) || (isBulk && hasAnyTcs) ? (
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
                    From TCS CNPrint API (<code>printtype</code>). Use <strong>6×4</strong> or{' '}
                    <strong>Shipment Label</strong> for parcels.
                  </p>
                </div>
              ) : null}

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

              {progress ? <p className="text-xs text-muted mb-0 mt-3">{progress}</p> : null}
              {error ? (
                <div
                  className="alert alert-danger py-2 mt-3 mb-0"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {error}
                </div>
              ) : null}
              {status === 'succeeded' ? (
                <div className="alert alert-success py-2 mt-3 mb-0">
                  {isBulk
                    ? 'Labels opened. Print from each PDF window and stick on the parcels.'
                    : 'Label opened. Print from the PDF window and stick it on the parcel.'}
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
                disabled={isLoading || !orderList.length}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Fetching PDF…
                  </>
                ) : isBulk ? (
                  `Print ${orderList.length} labels`
                ) : (
                  `Print ${isPostex ? 'PostEx' : courierLabel} label`
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
