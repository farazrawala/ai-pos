import { useEffect, useState } from 'react';
import moment from 'moment';
import { FaClockRotateLeft, FaPhone, FaEnvelope, FaWhatsapp } from 'react-icons/fa6';
import {
  fetchOrdersRequest,
  pickOrderDocumentId,
  DEFAULT_ORDER_LIST_PATH,
} from '../../features/orders/ordersAPI.js';
import { buildWhatsAppUrl } from '../../features/bigCommerce/marketplaceUtils.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import NavIcon from '../NavIcon.jsx';
import { toast } from '../../utils/toast.js';
import './customerOrderHistoryModal.css';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const getOrderNo = (row) => {
  const value = row?.order_no ?? row?.orderNo;
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
};

const getOrderStatus = (row) => {
  const value = row?.order_status ?? row?.orderStatus ?? row?.status;
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
};

const getOrderTotalDisplay = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const raw =
    row.order_items_total ??
    row.orderItemsTotal ??
    row.items_total ??
    row.itemsTotal ??
    row.total ??
    row.grand_total ??
    row.grandTotal;
  if (raw == null || raw === '') return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCreatedAt = (row) => row?.createdAt ?? row?.created_at ?? row?.date ?? null;

const orderIdentityKey = (row) => {
  const id = pickOrderDocumentId(row);
  if (id) return `id:${id}`;
  const orderNo = getOrderNo(row);
  if (orderNo) return `no:${orderNo}`;
  return '';
};

const matchesCustomer = (row, { phoneDigits, emailNorm }) => {
  if (phoneDigits && phoneDigits.length >= 7) {
    const rowDigits = digitsOnly(row?.phone);
    if (
      rowDigits &&
      (rowDigits === phoneDigits ||
        rowDigits.endsWith(phoneDigits) ||
        phoneDigits.endsWith(rowDigits))
    ) {
      return true;
    }
  }
  if (emailNorm) {
    const rowEmail = normalizeEmail(row?.email);
    if (rowEmail && rowEmail === emailNorm) return true;
  }
  return false;
};

const dedupeAndSortOrders = (rows) => {
  const seen = new Set();
  const unique = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = orderIdentityKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  unique.sort((a, b) => {
    const ta = Date.parse(String(getCreatedAt(a) || ''));
    const tb = Date.parse(String(getCreatedAt(b) || ''));
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk) return tb - ta;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
  return unique;
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
 * Popup listing previous orders for the same customer (matched by phone / email).
 */
export default function CustomerOrderHistoryModal({
  open,
  phone = '',
  email = '',
  customerName = '',
  currentOrderId = '',
  listPath = DEFAULT_ORDER_LIST_PATH,
  onClose,
}) {
  const [list, setList] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const phoneDigits = digitsOnly(phone);
    const emailNorm = normalizeEmail(email);
    const search = (phone && String(phone).trim()) || (email && String(email).trim()) || '';

    if (!search) {
      setList([]);
      setLoadStatus('succeeded');
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoadStatus('loading');
    setError(null);
    setList([]);

    fetchOrdersRequest({
      listPath,
      search,
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        const matched = rows.filter((row) => matchesCustomer(row, { phoneDigits, emailNorm }));
        const filtered = matched.length > 0 ? matched : rows;
        setList(dedupeAndSortOrders(filtered));
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setList([]);
        setLoadStatus('failed');
        setError(err?.message || 'Failed to load order history');
      });

    return () => {
      cancelled = true;
    };
  }, [open, phone, email, listPath]);

  if (!open) return null;

  const displayName = String(customerName || '').trim() || 'Customer';
  const contactPhone = String(phone || '').trim();
  const contactEmail = String(email || '').trim();
  const currentId = String(currentOrderId || '').trim();
  const orderCount = list.length;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="customerOrderHistoryModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content coh-modal">
            <div className="modal-header coh-modal__header border-0 pb-0">
              <div className="d-flex align-items-start gap-3 min-width-0">
                <div className="coh-modal__icon" aria-hidden="true">
                  <NavIcon icon={FaClockRotateLeft} size={16} />
                </div>
                <div className="min-width-0">
                  <p className="coh-modal__eyebrow mb-1">Order history</p>
                  <h5
                    className="modal-title coh-modal__title mb-1 text-truncate"
                    id="customerOrderHistoryModalLabel"
                    title={displayName}
                  >
                    {displayName}
                  </h5>
                  <div className="coh-modal__meta d-flex flex-wrap align-items-center gap-2">
                    {contactPhone ? (
                      <span className="coh-modal__chip" title={contactPhone}>
                        <NavIcon icon={FaPhone} size={10} />
                        {contactPhone}
                      </span>
                    ) : null}
                    {contactPhone ? (
                      <button
                        type="button"
                        className="coh-modal__chip coh-modal__chip--whatsapp"
                        title="Open WhatsApp Web chat"
                        aria-label="Open WhatsApp Web chat"
                        onClick={() => {
                          const url = buildWhatsAppUrl(contactPhone);
                          if (!url) {
                            toast.error('Could not open WhatsApp.');
                            return;
                          }
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <NavIcon icon={FaWhatsapp} size={12} />
                        WhatsApp
                      </button>
                    ) : null}
                    {contactEmail ? (
                      <span className="coh-modal__chip" title={contactEmail}>
                        <NavIcon icon={FaEnvelope} size={10} />
                        {contactEmail}
                      </span>
                    ) : null}
                    {loadStatus === 'succeeded' && orderCount > 0 ? (
                      <span className="coh-modal__count">
                        {orderCount} order{orderCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body coh-modal__body pt-3">
              {loadStatus === 'loading' ? (
                <div className="coh-modal__state text-center text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading previous orders…
                </div>
              ) : null}

              {loadStatus === 'failed' ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : null}

              {loadStatus === 'succeeded' && !phone && !email ? (
                <div className="alert alert-warning py-2 mb-0">
                  No phone or email on this order to look up history.
                </div>
              ) : null}

              {loadStatus === 'succeeded' && (phone || email) && list.length === 0 ? (
                <div className="alert alert-warning py-2 mb-0">
                  No previous orders found for this customer.
                </div>
              ) : null}

              {loadStatus === 'succeeded' && list.length > 0 ? (
                <div className="table-responsive coh-modal__table-wrap">
                  <table className="table align-items-center mb-0 coh-modal__table">
                    <thead>
                      <tr>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Order no
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7 text-end">
                          Total
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Status
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Created on
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row, index) => {
                        const key = orderIdentityKey(row) || index;
                        const orderNo = getOrderNo(row);
                        const orderStatus = getOrderStatus(row);
                        const total = getOrderTotalDisplay(row);
                        const when = getCreatedAt(row);
                        const rowId = String(pickOrderDocumentId(row) || '').trim();
                        const isCurrent = Boolean(currentId && rowId && currentId === rowId);
                        const whenLabel = when
                          ? moment(when).format('DD MMM YYYY · h:mm a')
                          : '';
                        return (
                          <tr
                            key={key}
                            className={isCurrent ? 'coh-modal__row--current' : undefined}
                          >
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <span className="text-sm font-weight-bold text-dark">
                                  {orderNo || '—'}
                                </span>
                                {isCurrent ? (
                                  <span className="badge badge-sm bg-gradient-primary coh-modal__current-badge">
                                    Current
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="text-end text-nowrap">
                              {total !== '—' ? (
                                <span className="text-sm font-weight-bold text-dark">
                                  <span className="coh-modal__currency">PKR</span> {total}
                                </span>
                              ) : (
                                <span className="text-sm text-muted">—</span>
                              )}
                            </td>
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
                            <td className="text-nowrap">
                              {when ? (
                                <div className="coh-modal__when">
                                  <span className="text-sm text-dark">{whenLabel}</span>
                                  <span className="text-xs text-secondary">{moment(when).fromNow()}</span>
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
