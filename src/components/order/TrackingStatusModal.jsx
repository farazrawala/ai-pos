import { useEffect, useMemo, useState } from 'react';
import {
  buildPublicTrackingUrl,
  fetchCourierTrackingStatusRequest,
  resolveTcsTrackingStatusApiUrl,
} from '../../features/courier/courierAPI.js';

const formatLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw;
};

const formatDateTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString();
};

const formatMoney = (value) => {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const humanizeKey = (key) =>
  String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const InfoCell = ({ label, value, badge = false, date = false, money = false }) => {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return null;
  const display = date ? formatDateTime(raw) : money ? formatMoney(raw) : raw;
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <span className="text-xs text-muted d-block">{label}</span>
      {badge ? (
        <span className="badge bg-gradient-info text-xxs">{display}</span>
      ) : (
        <strong className="text-sm text-break">{display}</strong>
      )}
    </div>
  );
};

const UrlRow = ({ label, url, hint }) => {
  if (!url) return null;
  return (
    <div className="mb-2">
      <span className="text-xs text-muted d-block">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-break"
        style={{ wordBreak: 'break-all' }}
      >
        {url}
      </a>
      {hint ? <div className="text-xs text-muted mt-1">{hint}</div> : null}
    </div>
  );
};

/**
 * Show live courier tracking status from GET /courier/tracking/:trackingNo.
 * Uses tracking_status + tracking_details.dist.trackDetail. stale:true is last-saved data, not an error.
 */
export default function TrackingStatusModal({
  open,
  onClose,
  orderId = '',
  trackingId = '',
  orderNo = '',
  provider = '',
  trackingUrl = '',
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const publicUrl = useMemo(() => {
    const explicit = String(trackingUrl || '').trim();
    if (explicit) return explicit;
    return buildPublicTrackingUrl(provider, trackingId);
  }, [trackingUrl, provider, trackingId]);

  const previewApiUrls = useMemo(() => {
    const cn = String(trackingId || '').trim();
    if (!cn) return null;
    return resolveTcsTrackingStatusApiUrl(cn);
  }, [trackingId]);

  const loadStatus = () => {
    setStatus('loading');
    setError('');
    return fetchCourierTrackingStatusRequest(orderId, { consignee: trackingId, provider })
      .then((result) => {
        setDetail(result);
        setStatus('succeeded');
      })
      .catch((err) => {
        setStatus('failed');
        setError(err?.message || 'Failed to load tracking status');
        if (err?.requestUrl || err?.upstreamUrl) {
          setDetail({
            requestUrl: err.requestUrl || '',
            upstreamUrl: err.upstreamUrl || '',
          });
        }
      });
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError('');
    setDetail(null);

    fetchCourierTrackingStatusRequest(orderId, { consignee: trackingId, provider })
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('failed');
        setError(err?.message || 'Failed to load tracking status');
        if (err?.requestUrl || err?.upstreamUrl) {
          setDetail({
            requestUrl: err.requestUrl || '',
            upstreamUrl: err.upstreamUrl || '',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId, trackingId, provider]);

  if (!open) return null;

  const isLoading = status === 'loading';
  const cn = String(trackingId || detail?.consignee || '').trim();
  const checkpoints = Array.isArray(detail?.checkpoints) ? detail.checkpoints : [];
  const deliveryInfo = Array.isArray(detail?.deliveryInfo) ? detail.deliveryInfo : [];
  const courierLabel = formatLabel(detail?.courier || provider);
  const statusApiUrl = detail?.viaBackend
    ? detail.requestUrl || detail.upstreamUrl || ''
    : detail?.upstreamUrl || previewApiUrls?.upstreamUrl || '';
  const requestApiUrl = detail?.requestUrl || previewApiUrls?.requestUrl || '';
  const showProxyHint = Boolean(detail?.viaProxy ?? previewApiUrls?.viaProxy) && !detail?.viaBackend;
  const extraFields =
    detail?.extraFields && typeof detail.extraFields === 'object' ? detail.extraFields : {};
  const shownExtraKeys = new Set([
    'trackingNumber',
    'tracking_number',
    'transactionStatus',
    'transaction_status',
    'transactionStatusId',
    'orderRefNumber',
    'order_ref_number',
    'destination',
    'origin',
    'invoicePayment',
    'invoice_payment',
    'bookingDate',
    'booking_date',
    'deliveryDate',
    'delivery_date',
    'returnDate',
    'return_date',
    'weight',
    'shippingCharges',
    'shipping_charges',
    'pickupDate',
    'pickup_date',
    'orderPickupDate',
    'customerName',
    'customer_name',
    'consigneeName',
    'customerPhone',
    'customer_phone',
    'consigneePhone',
    'city',
    'pickupCity',
    'destinationCity',
    'status',
    'statusCode',
    'statusMessage',
  ]);
  const leftoverFields = Object.entries(extraFields).filter(
    ([key, value]) => !shownExtraKeys.has(key) && value != null && String(value).trim() !== ''
  );
  const isStale = Boolean(detail?.stale);
  const currentStatus = formatLabel(detail?.status);
  const hasDescription = deliveryInfo.some((row) => String(row.description || '').trim());
  const hasReceivedBy = deliveryInfo.some(
    (row) => String(row.recievedby || row.receivedby || row.received_by || '').trim()
  );

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="trackingStatusModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="trackingStatusModalLabel">
                Tracking status
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
              <div className="d-flex flex-wrap gap-3 mb-3 text-sm">
                {orderNo ? (
                  <div>
                    <span className="text-xs text-muted d-block">Order</span>
                    <strong>{orderNo}</strong>
                  </div>
                ) : null}
                {cn ? (
                  <div>
                    <span className="text-xs text-muted d-block">CN / Tracking ID</span>
                    <strong>{cn}</strong>
                  </div>
                ) : null}
                {courierLabel !== '—' ? (
                  <div>
                    <span className="text-xs text-muted d-block">Courier</span>
                    <strong>{courierLabel}</strong>
                  </div>
                ) : null}
              </div>

              <div className="card border shadow-none mb-3">
                <div className="card-body py-3">
                  <h6 className="text-xs text-uppercase text-muted mb-2">Tracking URLs</h6>
                  <UrlRow
                    label={
                      detail?.viaBackend
                        ? `Status API (${courierLabel !== '—' ? courierLabel : 'Courier'} tracking)`
                        : 'Status API (TCS GetDynamicTrackDetail)'
                    }
                    url={statusApiUrl}
                    hint={
                      showProxyHint && requestApiUrl && requestApiUrl !== statusApiUrl
                        ? `Browser request (dev proxy): ${requestApiUrl}`
                        : detail?.viaBackend
                          ? 'Live courier status via backend. stale:true still shows last saved records.'
                          : null
                    }
                  />
                  <UrlRow
                    label="Public tracking page"
                    url={publicUrl}
                    hint="Customer-facing track page (opens in a new tab)."
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Fetching live tracking status…
                </div>
              ) : null}

              {status === 'failed' ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : null}

              {status === 'succeeded' && detail ? (
                <>
                  {isStale ? (
                    <div className="alert alert-warning py-2 mb-3">
                      {detail.warning ||
                        'Showing last saved tracking records. Live courier lookup did not refresh this time.'}
                    </div>
                  ) : null}

                  <div className="card border shadow-none mb-3">
                    <div className="card-body py-3">
                      <h6 className="text-xs text-uppercase text-muted mb-3">Shipment details</h6>
                      <div className="row g-3">
                        <InfoCell label="Current status" value={currentStatus !== '—' ? currentStatus : ''} badge />
                        {isStale ? (
                          <div className="col-6 col-md-4 col-lg-3">
                            <span className="text-xs text-muted d-block">Data source</span>
                            <span className="badge bg-warning text-dark text-xxs">Last saved</span>
                          </div>
                        ) : null}
                        <InfoCell label="Status code" value={detail.statusCode} />
                        <InfoCell label="Status ID" value={detail.statusId} />
                        <InfoCell label="Station" value={detail.station} />
                        <InfoCell label="Updated" value={detail.datetime || detail.lastTrackingSync} date />
                        <InfoCell label="Last sync" value={detail.lastTrackingSync} date />
                        <InfoCell label="Order reference" value={detail.orderRefNumber || orderNo} />
                        <InfoCell label="Tracking number" value={detail.consignee || cn} />
                        <InfoCell label="Courier" value={detail.courier || provider} />
                        <InfoCell label="Origin" value={detail.origin} />
                        <InfoCell label="Destination" value={detail.destination} />
                        <InfoCell label="City" value={detail.city} />
                        <InfoCell label="Customer" value={detail.customerName} />
                        <InfoCell label="Customer phone" value={detail.customerPhone} />
                        <InfoCell label="Weight (kg)" value={detail.weight} />
                        <InfoCell label="Invoice / COD" value={detail.invoicePayment} money />
                        <InfoCell label="Shipping charges" value={detail.shippingCharges} money />
                        <InfoCell label="Booking date" value={detail.bookingDate} date />
                        <InfoCell label="Pickup date" value={detail.pickupDate} date />
                        <InfoCell label="Delivery date" value={detail.deliveryDate} date />
                        <InfoCell label="Return date" value={detail.returnDate} date />
                        <InfoCell label="Received by" value={detail.receivedBy} />
                        {leftoverFields.map(([key, value]) => (
                          <InfoCell
                            key={key}
                            label={humanizeKey(key)}
                            value={value}
                            date={/date|time|sync/i.test(key)}
                          />
                        ))}
                        {detail.summary ? (
                          <div className="col-12">
                            <span className="text-xs text-muted d-block">Summary</span>
                            <pre
                              className="mb-0 mt-1 text-xs text-dark"
                              style={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'inherit',
                                background: '#f8f9fc',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                              }}
                            >
                              {detail.summary}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {deliveryInfo.length > 0 ? (
                    <div className="mb-3">
                      <h6 className="text-sm text-uppercase text-muted mb-2">Scan timeline</h6>
                      <div className="table-responsive">
                        <table className="table table-sm align-items-center mb-0">
                          <thead>
                            <tr>
                              <th className="text-xs text-uppercase">Date / time</th>
                              <th className="text-xs text-uppercase">Status</th>
                              <th className="text-xs text-uppercase">Code</th>
                              <th className="text-xs text-uppercase">Station</th>
                              {hasDescription ? (
                                <th className="text-xs text-uppercase">Description</th>
                              ) : null}
                              {hasReceivedBy ? (
                                <th className="text-xs text-uppercase">Received by</th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody>
                            {deliveryInfo.map((row, idx) => (
                              <tr key={`delivery-${idx}`}>
                                <td className="text-xs text-nowrap">
                                  {formatDateTime(row.datetime || row.dateTime)}
                                </td>
                                <td className="text-xs">{formatLabel(row.status)}</td>
                                <td className="text-xs">{formatLabel(row.code)}</td>
                                <td className="text-xs">{formatLabel(row.station)}</td>
                                {hasDescription ? (
                                  <td className="text-xs">{formatLabel(row.description)}</td>
                                ) : null}
                                {hasReceivedBy ? (
                                  <td className="text-xs">
                                    {formatLabel(
                                      row.recievedby || row.receivedby || row.received_by
                                    )}
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {checkpoints.length > 0 ? (
                    <div>
                      <h6 className="text-sm text-uppercase text-muted mb-2">Checkpoints</h6>
                      <div className="table-responsive">
                        <table className="table table-sm align-items-center mb-0">
                          <thead>
                            <tr>
                              <th className="text-xs text-uppercase">Date / time</th>
                              <th className="text-xs text-uppercase">Status</th>
                              <th className="text-xs text-uppercase">Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {checkpoints.map((row, idx) => (
                              <tr key={`cp-${idx}`}>
                                <td className="text-xs text-nowrap">
                                  {formatDateTime(row.datetime || row.dateTime)}
                                </td>
                                <td className="text-xs">{formatLabel(row.status)}</td>
                                <td className="text-xs">
                                  {formatLabel(
                                    row.recievedby || row.receivedby || row.station || row.location
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {!detail.status && deliveryInfo.length === 0 && checkpoints.length === 0 ? (
                    <div className="alert alert-warning py-2 mb-0">
                      {detail.message ||
                        'No tracking events returned for this consignment.'}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mb-0"
                disabled={isLoading}
                onClick={() => {
                  loadStatus();
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm mb-0"
                onClick={onClose}
                disabled={isLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
