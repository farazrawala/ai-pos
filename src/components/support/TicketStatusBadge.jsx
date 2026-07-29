import { getStatusMeta } from '../../features/support/supportConstants.js';

export default function TicketStatusBadge({ status, className = '' }) {
  const meta = getStatusMeta(status);
  return (
    <span className={`badge badge-sm ${meta.badgeClass} ${className}`.trim()} title={meta.label}>
      {meta.label}
    </span>
  );
}
