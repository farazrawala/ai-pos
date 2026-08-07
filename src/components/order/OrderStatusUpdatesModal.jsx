import { useEffect, useState } from 'react';
import moment from 'moment';
import { FaClock } from 'react-icons/fa6';
import { fetchOrderStatusUpdatesRequest } from '../../features/orders/ordersAPI.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import NavIcon from '../NavIcon.jsx';
import './customerOrderHistoryModal.css';

/** Order status on an update row (`order_status`). Avoids row `status` (active/inactive). */
const getOrderStatus = (row) => {
  const value = row?.order_status ?? row?.orderStatus ?? row?.to_status ?? row?.toStatus;
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
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

const statusBadgeClass = (status) => {
  const s = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
  if (
    ['active', 'completed', 'posted', 'delivered', 'confirmed', 'shipped', 'packed', 'dispatched'].includes(
      s
    )
  ) {
    return 'bg-gradient-success';
  }
  if (
    [
      'pending',
      'draft',
      'placed',
      'processing',
      'on hold',
      'on-hold',
      'pay pending',
      'checkout-draft',
      'auto-draft',
    ].includes(s)
  ) {
    return 'bg-gradient-warning';
  }
  if (
    ['cancelled', 'canceled', 'void', 'refunded', 'failed', 'trash', 'no stock', 'issues'].includes(s)
  ) {
    return 'bg-gradient-danger';
  }
  if (['duplicate', 'split', 'combined', 'claim'].includes(s)) {
    return 'bg-gradient-info';
  }
  return 'bg-gradient-secondary';
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
  const updateCount = list.length;

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
          <div className="modal-content coh-modal">
            <div className="modal-header coh-modal__header border-0 pb-0">
              <div className="d-flex align-items-start gap-3 min-width-0">
                <div className="coh-modal__icon" aria-hidden="true">
                  <NavIcon icon={FaClock} size={16} />
                </div>
                <div className="min-width-0">
                  <p className="coh-modal__eyebrow mb-1">Status history</p>
                  <h5
                    className="modal-title coh-modal__title mb-1 text-truncate"
                    id="orderStatusUpdatesModalLabel"
                    title={title}
                  >
                    {title}
                  </h5>
                  {loadStatus === 'succeeded' && updateCount > 0 ? (
                    <div className="coh-modal__meta">
                      <span className="coh-modal__count">
                        {updateCount} update{updateCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body coh-modal__body pt-3">
              {loadStatus === 'loading' ? (
                <div className="coh-modal__state text-center text-muted">
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
                <div className="table-responsive coh-modal__table-wrap">
                  <table className="table align-items-center mb-0 coh-modal__table">
                    <thead>
                      <tr>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Status
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Changed by
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row, index) => {
                        const key = row?._id || row?.id || index;
                        const orderStatus = getOrderStatus(row);
                        const when = row?.createdAt || row?.created_at || row?.updatedAt;
                        const whenLabel = when
                          ? moment(when).format('DD MMM YYYY · h:mm a')
                          : '';
                        return (
                          <tr key={key}>
                            <td>
                              {orderStatus ? (
                                <span
                                  className={`badge text-xxs ${statusBadgeClass(orderStatus)}`}
                                >
                                  {formatOrderStatusOptionLabel(orderStatus)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted">—</span>
                              )}
                            </td>
                            <td className="text-sm text-dark">{getChangedBy(row)}</td>
                            <td className="text-nowrap">
                              {when ? (
                                <div className="coh-modal__when">
                                  <span className="text-sm text-dark">{whenLabel}</span>
                                  <span className="text-xs text-secondary">
                                    {moment(when).fromNow()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div className="modal-footer coh-modal__footer border-0 pt-0">
              <button type="button" className="btn btn-outline-secondary mb-0" onClick={onClose}>
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
