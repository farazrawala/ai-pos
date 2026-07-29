import { Link } from 'react-router-dom';
import moment from 'moment';
import { FaChevronRight } from 'react-icons/fa6';
import {
  formatTicketId,
  getTicketId,
  personDisplayName,
} from '../../features/support/supportConstants.js';
import TicketStatusBadge from './TicketStatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';

export default function TicketCard({ ticket, to, showUser = false }) {
  if (!ticket) return null;
  const id = getTicketId(ticket);
  const href = to || `/support/${id}`;
  const unread = Number(ticket.unread_count ?? ticket.unreadCount ?? 0);
  const updated = ticket.updatedAt || ticket.updated_at || ticket.last_reply_at;
  const created = ticket.createdAt || ticket.created_at;

  return (
    <Link to={href} className="support-ticket-card card shadow-sm border-0 text-decoration-none">
      <div className="card-body p-3">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span className="font-monospace text-xs text-muted">{formatTicketId(ticket)}</span>
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {unread > 0 ? (
                <span className="badge bg-danger badge-sm" title={`${unread} unread`}>
                  {unread} new
                </span>
              ) : null}
            </div>
            <h6 className="mb-1 text-dark text-truncate">{ticket.subject || 'Untitled'}</h6>
            <div className="text-xs text-muted d-flex flex-wrap gap-2">
              {ticket.category ? <span>{ticket.category}</span> : null}
              {showUser ? <span>· {personDisplayName(ticket.user || ticket.created_by || ticket.customer)}</span> : null}
              {created ? <span>· Created {moment(created).fromNow()}</span> : null}
              {updated ? <span>· Updated {moment(updated).fromNow()}</span> : null}
            </div>
          </div>
          <FaChevronRight className="text-muted flex-shrink-0 mt-1" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
