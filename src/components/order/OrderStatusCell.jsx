import { FaChevronDown, FaLock } from 'react-icons/fa6';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import { orderStatusBadgeClass } from './orderStatusBadge.js';
import './orderStatusCell.css';

function statusLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—') return '';
  return formatOrderStatusOptionLabel(raw);
}

/**
 * Compact POS + WEB status pair for OMS / order tables.
 * POS is the editable OMS status; WEB is synced from the website and read-only.
 */
export default function OrderStatusCell({
  posStatus = '',
  websiteStatus = '',
  showWebsiteStatus = false,
  canChangePos = false,
  onChangePos,
}) {
  const posLabel = statusLabel(posStatus);
  const webLabel = statusLabel(websiteStatus);
  const posClass = `badge text-xxs oms-status-cell__badge ${orderStatusBadgeClass(posStatus)}`;
  const webClass = `badge text-xxs oms-status-cell__badge ${orderStatusBadgeClass(websiteStatus)}`;

  return (
    <div
      className={`oms-status-cell${showWebsiteStatus ? ' oms-status-cell--paired' : ''}`}
    >
      <div className="oms-status-cell__row oms-status-cell__row--pos">
        <span className="oms-status-cell__src" title="POS status — editable in OMS">
          POS
        </span>
        {canChangePos ? (
          <button
            type="button"
            className="oms-status-cell__control"
            title="Change POS status"
            aria-label={
              posLabel
                ? `Change POS status, currently ${posLabel}`
                : 'Change POS status'
            }
            aria-haspopup="dialog"
            onClick={onChangePos}
          >
            {posLabel ? (
              <span className={posClass}>{posLabel}</span>
            ) : (
              <span className="oms-status-cell__empty">—</span>
            )}
            <FaChevronDown className="oms-status-cell__chevron" size={9} aria-hidden="true" />
          </button>
        ) : (
          <span
            className="oms-status-cell__value"
            title="POS status"
            aria-label={posLabel ? `POS status ${posLabel}` : 'POS status unavailable'}
          >
            {posLabel ? (
              <span className={posClass}>{posLabel}</span>
            ) : (
              <span className="oms-status-cell__empty">—</span>
            )}
          </span>
        )}
      </div>

      {showWebsiteStatus ? (
        <div className="oms-status-cell__row oms-status-cell__row--web">
          <span
            className="oms-status-cell__src"
            title="Website status — synced from the connected website"
          >
            WEB
          </span>
          <span
            className="oms-status-cell__value oms-status-cell__value--readonly"
            title="Website status — synced from the connected website"
            aria-label={
              webLabel
                ? `Website status ${webLabel}, read-only, synced from the connected website`
                : 'Website status unavailable, read-only, synced from the connected website'
            }
          >
            {webLabel ? (
              <span className={webClass}>{webLabel}</span>
            ) : (
              <span className="oms-status-cell__empty">—</span>
            )}
            <FaLock className="oms-status-cell__lock" size={9} aria-hidden="true" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
