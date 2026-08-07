import { useEffect, useState } from 'react';
import moment from 'moment';
import { fetchOrderStatusUpdatesRequest } from '../../features/orders/ordersAPI.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';

/** Order status on an update row (`order_status`). Avoids row `status` (active/inactive). */
const getOrderStatus = (row) => {
  const value = row?.order_status ?? row?.orderStatus ?? row?.to_status ?? row?.toStatus;
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
};

const getNote = (row) => {
  for (const key of ['note', 'reason', 'comment', 'remarks', 'message']) {
    const value = row?.[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
};

const getChangedBy = (row) => {
  const user = row?.created_by ?? row?.updated_by ?? row?.user_id ?? row?.changed_by;
  if (user && typeof user === 'object') {
    const name = String(user.name ?? '').trim();
    if (name) return name;
    const email = String(user.email ?? '').trim();
    if (email) return email;
  }
  if (typeof user === 'string' && user.trim()) return user.trim();
  return '—';
};

/**
 * Popup listing `order_status_updates` rows for one order.
 */
export default function OrderStatusUpdatesModal({ open, orderId, orderNo, onClose }) {
  const [list, setList] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !orderId) return undefined;

    let cancelled = false;
    setLoadStatus('loading');
    setError(null);
    setList([]);

    fetchOrderStatusUpdatesRequest({ order_id: orderId, limit: 100 })
      .then((result) => {
        if (cancelled) return;
        setList(Array.isArray(result?.data) ? result.data : []);
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setList([]);
        setLoadStatus('failed');
        setError(err?.message || 'Failed to load status updates');
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!open) return null;

  const title = orderNo || 'Order';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="orderStatusUpdatesModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="orderStatusUpdatesModalLabel">
                Status history — {title}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loadStatus === 'loading' ? (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading status updates…
                </div>
              ) : null}

              {loadStatus === 'failed' ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : null}

              {loadStatus === 'succeeded' && list.length === 0 ? (
                <div className="alert alert-warning py-2 mb-0">
                  No status updates found for this order.
                </div>
              ) : null}

              {loadStatus === 'succeeded' && list.length > 0 ? (
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-xxs text-secondary text-uppercase">Status</th>
                        <th className="text-xxs text-secondary text-uppercase">Note</th>
                        <th className="text-xxs text-secondary text-uppercase">Changed by</th>
                        <th className="text-xxs text-secondary text-uppercase">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row, index) => {
                        const key = row?._id || row?.id || index;
                        const orderStatus = getOrderStatus(row);
                        const note = getNote(row);
                        const when = row?.createdAt || row?.created_at || row?.updatedAt;
                        return (
                          <tr key={key}>
                            <td className="text-sm font-weight-bold">
                              {orderStatus ? formatOrderStatusOptionLabel(orderStatus) : '—'}
                            </td>
                            <td className="text-sm text-muted">{note || '—'}</td>
                            <td className="text-sm">{getChangedBy(row)}</td>
                            <td
                              className="text-sm text-nowrap"
                              title={
                                when ? moment(when).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {when ? moment(when).fromNow() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
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
