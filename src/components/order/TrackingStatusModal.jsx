import { useEffect, useState } from 'react';
import { fetchCourierTrackingStatusRequest } from '../../features/courier/courierAPI.js';

const formatLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw;
};

/**
 * Show live courier tracking status (TCS GetDynamicTrackDetail sandbox).
 * @see https://devconnect.tcscourier.com/tracking/api/Tracking/GetDynamicTrackDetail
 */
export default function TrackingStatusModal({
  open,
  onClose,
  orderId = '',
  trackingId = '',
  orderNo = '',
  provider = '',
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError('');
    setDetail(null);

    fetchCourierTrackingStatusRequest(orderId, { consignee: trackingId })
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('failed');
        setError(err?.message || 'Failed to load tracking status');
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId, trackingId]);

  if (!open) return null;

  const isLoading = status === 'loading';
  const cn = String(trackingId || detail?.consignee || '').trim();
  const checkpoints = Array.isArray(detail?.checkpoints) ? detail.checkpoints : [];
  const deliveryInfo = Array.isArray(detail?.deliveryInfo) ? detail.deliveryInfo : [];

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
        <div className="modal-dialog modal-dialog-centered modal-lg">
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
                {provider ? (
                  <div>
                    <span className="text-xs text-muted d-block">Courier</span>
                    <strong>{provider}</strong>
                  </div>
                ) : null}
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
                  <div className="card border shadow-none mb-3">
                    <div className="card-body py-3">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <span className="text-xs text-muted d-block">Current status</span>
                          <span className="badge bg-gradient-info text-xxs">
                            {formatLabel(detail.status)}
                          </span>
                          {detail.statusCode ? (
                            <span className="text-xs text-muted ms-2">({detail.statusCode})</span>
                          ) : null}
                        </div>
                        <div className="col-md-4">
                          <span className="text-xs text-muted d-block">Station</span>
                          <strong className="text-sm">{formatLabel(detail.station)}</strong>
                        </div>
                        <div className="col-md-4">
                          <span className="text-xs text-muted d-block">Updated</span>
                          <strong className="text-sm">{formatLabel(detail.datetime)}</strong>
                        </div>
                        {detail.receivedBy ? (
                          <div className="col-md-6">
                            <span className="text-xs text-muted d-block">Received by</span>
                            <strong className="text-sm">{detail.receivedBy}</strong>
                          </div>
                        ) : null}
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
                      <h6 className="text-sm text-uppercase text-muted mb-2">Delivery info</h6>
                      <div className="table-responsive">
                        <table className="table table-sm align-items-center mb-0">
                          <thead>
                            <tr>
                              <th className="text-xs text-uppercase">Date / time</th>
                              <th className="text-xs text-uppercase">Status</th>
                              <th className="text-xs text-uppercase">Code</th>
                              <th className="text-xs text-uppercase">Station</th>
                              <th className="text-xs text-uppercase">Received by</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deliveryInfo.map((row, idx) => (
                              <tr key={`delivery-${idx}`}>
                                <td className="text-xs text-nowrap">
                                  {formatLabel(row.datetime || row.dateTime)}
                                </td>
                                <td className="text-xs">{formatLabel(row.status)}</td>
                                <td className="text-xs">{formatLabel(row.code)}</td>
                                <td className="text-xs">{formatLabel(row.station)}</td>
                                <td className="text-xs">
                                  {formatLabel(row.recievedby || row.receivedby || row.received_by)}
                                </td>
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
                                  {formatLabel(row.datetime || row.dateTime)}
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
                      No tracking events returned for this consignment.
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
                  setStatus('loading');
                  setError('');
                  fetchCourierTrackingStatusRequest(orderId, { consignee: trackingId })
                    .then((result) => {
                      setDetail(result);
                      setStatus('succeeded');
                    })
                    .catch((err) => {
                      setStatus('failed');
                      setError(err?.message || 'Failed to load tracking status');
                    });
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
