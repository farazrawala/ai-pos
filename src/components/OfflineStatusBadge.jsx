import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useSyncStatus } from '../hooks/useSyncStatus.js';

/**
 * POS connectivity badge — Online (green), Offline (amber), Syncing… (blue).
 */
export default function OfflineStatusBadge({ isSyncing: isSyncingOverride, pendingCount: pendingOverride }) {
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const isSyncing = isSyncingOverride ?? syncStatus.syncing;
  const pendingCount = pendingOverride ?? syncStatus.pending;
  const failedCount = syncStatus.failed;

  let variant = 'online';
  let label = 'Online';

  if (isSyncing) {
    variant = 'syncing';
    label = 'Syncing…';
  } else if (!isOnline) {
    variant = 'offline';
    label = 'Offline';
  } else if (pendingCount > 0) {
    label = `${pendingCount} pending`;
  } else if (failedCount > 0) {
    variant = 'failed';
    label = `${failedCount} failed`;
  }

  return (
    <span
      className={`pos-offline-status-badge pos-offline-status-badge--${variant}`}
      role="status"
      aria-live="polite"
      title={
        failedCount > 0
          ? `${failedCount} failed sync(s) — open Pending sync to retry`
          : pendingCount > 0
            ? `${pendingCount} order(s) waiting to sync`
            : undefined
      }
    >
      <span className="pos-offline-status-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
