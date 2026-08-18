import { useEffect, useMemo, useState } from 'react';
import {
  buildPublicTrackingUrl,
  fetchCourierTrackingStatusRequest,
  resolveTcsTrackingStatusApiUrl,
} from '../../features/courier/courierAPI.js';
import './tracking-status-modal.css';

const formatLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw;
};

const formatDateTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

const statusTone = (status) => {
  const key = String(status || '').toLowerCase();
  if (/deliver/.test(key)) return 'delivered';
  if (/return|rto|cancel/.test(key)) return 'returned';
  if (/out for delivery|in transit|in-transit|dispatched/.test(key)) return 'transit';
  if (/book|created|unbook/.test(key)) return 'booked';
  return 'neutral';
};

const Field = ({ label, value }) => {
  const display = formatLabel(value);
  if (!display) return null;
  return (
    <div className="tracking-status-field">
      <span className="tracking-status-field__label">{label}</span>
      <span className="tracking-status-field__value">{display}</span>
    </div>
  );
};

const SectionCard = ({ title, children }) => {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="col-md-4">
      <div className="card tracking-status-card">
        <div className="card-body">
          <h6 className="tracking-status-card__title">{title}</h6>
          {items}
        </div>
      </div>
    </div>
  );
};

const TECHNICAL_KEYS = new Set([
  'statusCode',
  'statusMessage',
  'transactionStatusId',
  'transactionStatus',
  'transaction_status',
  'invoiceDivision',
  'invoice_division',
  'transactionNotes',
  'transaction_notes',
  'statusId',
]);

/**
 * Show live courier tracking status from GET /courier/tracking/:trackingNo.
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
  const extraFields =
    detail?.extraFields && typeof detail.extraFields === 'object' ? detail.extraFields : {};
  const isStale = Boolean(detail?.stale);
  const currentStatus = formatLabel(detail?.status);
  const extra = (key) => extraFields[key];

  const usedExtraKeys = new Set([
    'customerName',
    'customerPhone',
    'deliveryAddress',
    'delivery_address',
    'cityName',
    'destination',
    'merchantName',
    'pickupAddress',
    'returnAddress',
    'return_address',
    'orderDetail',
    'items',
    'bookingWeight',
    'actualWeight',
    'pickupDate',
    'orderDeliveryDate',
    'reservePayment',
    'transactionFee',
    'transactionTax',
    'upfrontPayment',
    'balancePayment',
    'transactionDate',
    'origin',
    'weight',
    'invoicePayment',
    'shippingCharges',
    'bookingDate',
    'deliveryDate',
    'city',
  ]);
  const leftoverFields = Object.entries(extraFields).filter(([key, value]) => {
    if (TECHNICAL_KEYS.has(key) || usedExtraKeys.has(key)) return false;
    if (value == null || String(value).trim() === '') return false;
    return true;
  });

  const moreDetails = leftoverFields.filter(([key]) =>
    /note|id|code|division|woocommerce|refNumber/i.test(key)
  );
  const extraDisplay = leftoverFields.filter(
    ([key]) => !/note|id|code|division|woocommerce|refNumber/i.test(key)
  );

  return (
    <>
      <div
        className="modal fade show tracking-status-modal"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="trackingStatusModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0" id="trackingStatusModalLabel">
                  Tracking status
                </h5>
                <div className="text-xs text-muted mt-1">
                  {[orderNo || extra('orderRefNumber'), cn, courierLabel].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isLoading}
              />
            </div>
            <div className="modal-body">
              {isLoading ? (
                <div className="text-center py-5 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Fetching live tracking status…
                </div>
              ) : null}

              {status === 'failed' ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : null}

              {status === 'succeeded' && detail ? (
                <>
                  <div className="tracking-status-hero">
                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        {currentStatus ? (
                          <span className={`tracking-status-badge tracking-status-badge--${statusTone(currentStatus)}`}>
                            {currentStatus}
                          </span>
                        ) : null}
                        {isStale ? (
                          <span className="tracking-status-badge tracking-status-badge--neutral">Last saved</span>
                        ) : (
                          <span className="tracking-status-badge tracking-status-badge--booked">Live</span>
                        )}
                      </div>
                      <div className="tracking-status-hero__status">{currentStatus || 'No status yet'}</div>
                      <div className="tracking-status-hero__meta">
                        {detail.station ? <span>{detail.station}</span> : null}
                        {detail.datetime ? <span>Updated {formatDateTime(detail.datetime)}</span> : null}
                        {detail.lastTrackingSync ? (
                          <span>Synced {formatDateTime(detail.lastTrackingSync)}</span>
                        ) : null}
                      </div>
                    </div>
                    {publicUrl ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary mb-0"
                      >
                        Open courier page
                      </a>
                    ) : null}
                  </div>

                  {isStale && detail.warning ? (
                    <div className="alert alert-warning py-2 mb-3">{detail.warning}</div>
                  ) : null}

                  <div className="row g-3 mb-3">
                    <SectionCard title="Customer">
                      <Field label="Name" value={detail.customerName || extra('customerName')} />
                      <Field label="Phone" value={detail.customerPhone || extra('customerPhone')} />
                      <Field
                        label="Delivery address"
                        value={extra('deliveryAddress') || extra('delivery_address')}
                      />
                      <Field
                        label="City"
                        value={detail.city || extra('cityName') || extra('destination')}
                      />
                      <Field label="Merchant" value={extra('merchantName')} />
                    </SectionCard>

                    <SectionCard title="Shipment">
                      <Field label="Origin" value={detail.origin || extra('pickupAddress')} />
                      <Field label="Destination" value={detail.destination || extra('cityName')} />
                      <Field
                        label="Return address"
                        value={extra('returnAddress') || extra('return_address')}
                      />
                      <Field label="Items" value={extra('orderDetail') || extra('items')} />
                      <Field
                        label="Booking weight"
                        value={detail.weight || extra('bookingWeight')}
                      />
                      <Field label="Actual weight" value={extra('actualWeight')} />
                      <Field label="Pickup" value={formatDateTime(detail.pickupDate || extra('pickupDate'))} />
                      <Field
                        label="Delivered"
                        value={formatDateTime(detail.deliveryDate || extra('orderDeliveryDate'))}
                      />
                    </SectionCard>

                    <SectionCard title="Payment">
                      <Field
                        label="COD / invoice"
                        value={formatMoney(detail.invoicePayment || extra('reservePayment'))}
                      />
                      <Field
                        label="Shipping charges"
                        value={formatMoney(detail.shippingCharges || extra('transactionFee'))}
                      />
                      <Field label="Tax" value={formatMoney(extra('transactionTax'))} />
                      <Field label="Upfront" value={formatMoney(extra('upfrontPayment'))} />
                      <Field label="Balance" value={formatMoney(extra('balancePayment'))} />
                      <Field
                        label="Booking date"
                        value={formatDateTime(detail.bookingDate || extra('transactionDate'))}
                      />
                    </SectionCard>
                  </div>

                  {extraDisplay.length > 0 ? (
                    <div className="card tracking-status-card mb-3">
                      <div className="card-body">
                        <h6 className="tracking-status-card__title">Additional details</h6>
                        <div className="row g-3">
                          {extraDisplay.map(([key, value]) => (
                            <div className="col-6 col-md-4" key={key}>
                              <Field
                                label={humanizeKey(key)}
                                value={/date|time/i.test(key) ? formatDateTime(value) : value}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {deliveryInfo.length > 0 ? (
                    <div className="card tracking-status-card mb-3">
                      <div className="card-body">
                        <h6 className="tracking-status-card__title">Scan timeline</h6>
                        <ol className="tracking-status-timeline">
                          {deliveryInfo.map((row, idx) => (
                            <li className="tracking-status-timeline__item" key={`scan-${idx}`}>
                              <div className="tracking-status-timeline__rail">
                                <div className="tracking-status-timeline__dot" />
                              </div>
                              <div>
                                <p className="tracking-status-timeline__title">
                                  {formatLabel(row.status) || 'Update'}
                                </p>
                                <div className="tracking-status-timeline__meta">
                                  {row.datetime ? <span>{formatDateTime(row.datetime)}</span> : null}
                                  {row.station ? <span>{row.station}</span> : null}
                                  {row.description &&
                                  String(row.description).toLowerCase() !==
                                    String(row.status || '').toLowerCase() ? (
                                    <span>{row.description}</span>
                                  ) : null}
                                  {row.recievedby ? <span>Received by {row.recievedby}</span> : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ) : null}

                  {checkpoints.length > 0 ? (
                    <div className="card tracking-status-card mb-3">
                      <div className="card-body">
                        <h6 className="tracking-status-card__title">Checkpoints</h6>
                        <ol className="tracking-status-timeline">
                          {checkpoints.map((row, idx) => (
                            <li className="tracking-status-timeline__item" key={`cp-${idx}`}>
                              <div className="tracking-status-timeline__rail">
                                <div className="tracking-status-timeline__dot" />
                              </div>
                              <div>
                                <p className="tracking-status-timeline__title">
                                  {formatLabel(row.status) || 'Update'}
                                </p>
                                <div className="tracking-status-timeline__meta">
                                  {row.datetime ? <span>{formatDateTime(row.datetime)}</span> : null}
                                  <span>
                                    {formatLabel(row.station || row.location || row.recievedby)}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ) : null}

                  {!detail.status && deliveryInfo.length === 0 && checkpoints.length === 0 ? (
                    <div className="alert alert-warning py-2 mb-3">
                      {detail.message || 'No tracking events returned for this consignment.'}
                    </div>
                  ) : null}

                  <div className="accordion tracking-status-collapse" id="trackingStatusMore">
                    <div className="accordion-item">
                      <h2 className="accordion-header">
                        <button
                          className="accordion-button collapsed"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target="#trackingStatusMoreBody"
                          aria-expanded="false"
                          aria-controls="trackingStatusMoreBody"
                        >
                          Technical details
                        </button>
                      </h2>
                      <div
                        id="trackingStatusMoreBody"
                        className="accordion-collapse collapse"
                      >
                        <div className="accordion-body">
                          {statusApiUrl ? (
                            <div className="mb-2">
                              <span className="tracking-status-field__label">Status API</span>
                              <div className="tracking-status-url">{statusApiUrl}</div>
                            </div>
                          ) : null}
                          {publicUrl ? (
                            <div className="mb-2">
                              <span className="tracking-status-field__label">Public tracking page</span>
                              <a
                                className="tracking-status-url d-block"
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {publicUrl}
                              </a>
                            </div>
                          ) : null}
                          {moreDetails.map(([key, value]) => (
                            <Field key={key} label={humanizeKey(key)} value={value} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mb-0"
                onClick={onClose}
                disabled={isLoading}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm mb-0"
                disabled={isLoading}
                onClick={() => {
                  loadStatus();
                }}
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
