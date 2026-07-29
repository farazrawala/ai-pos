import { getPriorityMeta } from '../../features/support/supportConstants.js';

export default function PriorityBadge({ priority, className = '' }) {
  const meta = getPriorityMeta(priority);
  return (
    <span className={`badge badge-sm ${meta.badgeClass} ${className}`.trim()} title={meta.label}>
      {meta.label}
    </span>
  );
}
