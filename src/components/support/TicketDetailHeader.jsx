import { Link } from 'react-router-dom';
import moment from 'moment';
import { FaCopy, FaLock, FaRotate } from 'react-icons/fa6';
import { formatTicketId, getTicketId } from '../../features/support/supportConstants.js';
import TicketStatusBadge from './TicketStatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';

/**
 * Shared professional header for user + admin ticket detail pages.
 */
export default function TicketDetailHeader({
  ticket,
  breadcrumbs = [],
  metaItems = [],
  actions = null,
  onCopyId,
  refreshHint = null,
  closed = false,
}) {
  if (!ticket) return null;

  return (
    <div className="support-detail-header card border-0 shadow-sm mb-3">
      {breadcrumbs.length > 0 ? (
        <nav aria-label="breadcrumb" className="support-detail-header__crumbs px-4 pt-3">
          <ol className="breadcrumb mb-0">
            {breadcrumbs.map((crumb, idx) => {
              const last = idx === breadcrumbs.length - 1;
              return (
                <li
                  key={crumb.label}
                  className={`breadcrumb-item ${last ? 'active' : ''}`}
                  aria-current={last ? 'page' : undefined}
                >
                  {!last && crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="card-body px-4 pb-4 pt-2">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div className="min-w-0 flex-grow-1">
            <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
              <button
                type="button"
                className="support-ticket-id-chip"
                onClick={onCopyId}
                title="Copy ticket ID"
              >
                <span className="font-monospace">{formatTicketId(ticket)}</span>
                <FaCopy aria-hidden />
              </button>
              <TicketStatusBadge status={ticket.status} className="support-pill-badge" />
              <PriorityBadge priority={ticket.priority} className="support-pill-badge" />
              {ticket.category ? (
                <span className="badge support-pill-badge support-category-badge">{ticket.category}</span>
              ) : null}
              {closed ? (
                <span className="badge support-pill-badge bg-dark">
                  <FaLock className="me-1" aria-hidden />
                  Closed
                </span>
              ) : null}
            </div>

            <h4 className="support-detail-header__title mb-3">{ticket.subject || 'Untitled ticket'}</h4>

            {metaItems.length > 0 ? (
              <div className="support-meta-grid">
                {metaItems.map((item) => (
                  <div key={item.label} className="support-meta-chip">
                    <span className="support-meta-chip__label">{item.label}</span>
                    <span className="support-meta-chip__value" title={item.title || undefined}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="support-meta-chip">
                  <span className="support-meta-chip__label">Ref</span>
                  <span className="support-meta-chip__value font-monospace text-truncate">
                    {getTicketId(ticket)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="d-flex flex-column align-items-end gap-2">
            {actions}
            {refreshHint ? (
              <span className="support-refresh-hint">
                <FaRotate aria-hidden />
                {refreshHint}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function formatCreatedMeta(created) {
  if (!created) return '—';
  return moment(created).format('MMM D, YYYY · h:mm A');
}
