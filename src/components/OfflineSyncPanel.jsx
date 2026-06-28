import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import { useSyncStatus } from '../hooks/useSyncStatus.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { listAllPendingOrders } from '../offline/repositories/ordersRepo.js';
import { refreshSyncStatusCounts } from '../offline/syncStatus.js';
import { processSyncQueue, retryFailedOrders } from '../offline/syncOrders.js';
import { toast } from '../utils/toast.js';

const MODAL_ID = 'posOfflineSyncModal';

/** Auto-retry failed offline orders this long after the last attempt. */
const AUTO_RETRY_MS = 60_000;

/** Format remaining seconds as `m:ss` for the countdown. */
function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function estimateOrderTotal(order) {
  const payload = order?.payload;
  if (!payload || typeof payload !== 'object') return 0;
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const subtotal = lines.reduce(
    (sum, line) => sum + (Number(line?.qty) || 0) * (Number(line?.price) || 0),
    0
  );
  const shipping = Number(payload.shipping ?? payload.shipment) || 0;
  const discount = Number(payload.discount) || 0;
  return Math.max(0, subtotal + shipping - discount);
}

function formatOrderTime(value) {
  const ts = Date.parse(value || '');
  if (!Number.isFinite(ts)) return '—';
  return moment(ts).format('D MMM YYYY, h:mm a');
}

/** Live "next automatic retry in m:ss" indicator. Isolated so it re-renders per second alone. */
function RetryCountdown({ hasQueue, isOnline, busy, nextRetryAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasQueue || !isOnline || busy) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasQueue, isOnline, busy]);

  if (!hasQueue) return null;

  if (!isOnline) {
    return <span className="text-muted small">Will retry automatically when back online.</span>;
  }

  if (busy) {
    return (
      <span className="text-primary small">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Syncing now…
      </span>
    );
  }

  if (nextRetryAt == null) return null;
  const secondsLeft = Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
  return (
    <span className="text-muted small" role="status" aria-live="polite">
      Next automatic retry in{' '}
      <strong className="text-dark">{formatCountdown(secondsLeft)}</strong>
    </span>
  );
}

export function openOfflineSyncPanel() {
  const el = document.getElementById(MODAL_ID);
  if (el && window.bootstrap?.Modal) {
    const M = window.bootstrap.Modal;
    const instance =
      typeof M.getOrCreateInstance === 'function'
        ? M.getOrCreateInstance(el)
        : M.getInstance(el) || new M(el);
    instance.show();
  }
}

export default function OfflineSyncPanel() {
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [retrySecondsLeft, setRetrySecondsLeft] = useState(null);
  const retryDeadlineRef = useRef(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAllPendingOrders();
      setOrders(Array.isArray(rows) ? rows.reverse() : []);
      await refreshSyncStatusCounts();
    } catch (err) {
      console.error('[OfflineSyncPanel] Failed to load orders', err);
      toast.error(err?.message || 'Could not load pending sync orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, syncStatus.pending, syncStatus.failed, syncStatus.syncing]);

  useEffect(() => {
    const el = document.getElementById(MODAL_ID);
    if (!el) return undefined;
    const onShow = () => loadOrders();
    el.addEventListener('show.bs.modal', onShow);
    return () => el.removeEventListener('show.bs.modal', onShow);
  }, [loadOrders]);

  const pendingRows = useMemo(
    () => orders.filter((row) => row.status === 'pending' || row.status === 'syncing'),
    [orders]
  );
  const failedRows = useMemo(() => orders.filter((row) => row.status === 'failed'), [orders]);

  const hasQueue = pendingRows.length > 0 || failedRows.length > 0;

  const handleSyncNow = async () => {
    if (!isOnline) {
      toast.warning('Go online to sync pending orders');
      return;
    }
    setAction('sync');
    try {
      const result = await processSyncQueue({ force: true, skipBackoff: true });
      await loadOrders();
      if ((result.synced || 0) > 0) {
        toast.success(`Synced ${result.synced} order(s)`);
      } else if ((result.failed || 0) > 0) {
        toast.error('Some orders failed to sync — see details below');
      } else {
        toast.info('No pending orders to sync');
      }
    } catch (err) {
      toast.error(err?.message || 'Sync failed');
    } finally {
      setAction('');
    }
  };

  const handleRetryFailed = async () => {
    if (!isOnline) {
      toast.warning('Go online to retry failed syncs');
      return;
    }
    setAction('retry');
    try {
      const result = await retryFailedOrders();
      await loadOrders();
      toast.success(`Retried failed orders — synced ${result.synced || 0}`);
    } catch (err) {
      toast.error(err?.message || 'Retry failed');
    } finally {
      setAction('');
    }
  };

  // Silent retry fired by the countdown (no toast — it runs unattended).
  const handleAutoRetry = useCallback(async () => {
    if (!isOnline) return;
    setAction('retry');
    try {
      await retryFailedOrders();
      await loadOrders();
    } catch (err) {
      console.warn('[OfflineSyncPanel] Auto-retry failed', err);
    } finally {
      setAction('');
    }
  }, [isOnline, loadOrders]);

  // While there are failed orders and we're online, count down to the next
  // automatic retry (1 min after the last attempt) and fire it at zero.
  useEffect(() => {
    const eligible =
      isOnline && failedRows.length > 0 && !syncStatus.syncing && action === '';

    if (!eligible) {
      retryDeadlineRef.current = null;
      setRetrySecondsLeft(null);
      return undefined;
    }

    if (retryDeadlineRef.current == null) {
      retryDeadlineRef.current = Date.now() + AUTO_RETRY_MS;
    }

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const msLeft = (retryDeadlineRef.current ?? 0) - Date.now();
      if (msLeft <= 0) {
        retryDeadlineRef.current = null;
        setRetrySecondsLeft(0);
        handleAutoRetry();
        return;
      }
      setRetrySecondsLeft(Math.ceil(msLeft / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOnline, failedRows.length, syncStatus.syncing, action, handleAutoRetry]);

  const handleCopyError = async (message) => {
    const text = String(message || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Error copied');
    } catch {
      toast.error('Could not copy error text');
    }
  };

  const renderTable = (rows, { highlightFailed = false } = {}) => (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Time</th>
            <th className="text-end">Amount</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted text-center py-3">
                No orders
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.client_order_id}
                className={highlightFailed || row.status === 'failed' ? 'table-warning' : ''}
              >
                <td>{row.local_invoice_no || row.client_order_id}</td>
                <td>{formatOrderTime(row.created_at)}</td>
                <td className="text-end">PKR {estimateOrderTotal(row).toFixed(2)}</td>
                <td className="text-capitalize">{row.status || '—'}</td>
                <td>
                  {row.error_message ? (
                    <div className="d-flex align-items-start gap-2">
                      <span className="small text-danger">{row.error_message}</span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => handleCopyError(row.error_message)}
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="modal fade" id={MODAL_ID} tabIndex="-1" aria-labelledby="posOfflineSyncModalLabel" aria-hidden="true">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="posOfflineSyncModalLabel">
              Pending sync
            </h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
          </div>
          <div className="modal-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleSyncNow}
                disabled={!isOnline || syncStatus.syncing || action !== ''}
              >
                {action === 'sync' ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={handleRetryFailed}
                disabled={!isOnline || syncStatus.syncing || action !== '' || failedRows.length === 0}
              >
                {action === 'retry'
                  ? 'Retrying…'
                  : retrySecondsLeft != null
                    ? `Retry failed (${formatCountdown(retrySecondsLeft)})`
                    : 'Retry failed'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={loadOrders}
                disabled={loading}
              >
                Refresh
              </button>
              <div className="ms-auto d-flex align-items-center">
                <RetryCountdown
                  hasQueue={hasQueue}
                  isOnline={isOnline}
                  busy={syncStatus.syncing || action !== ''}
                  nextRetryAt={syncStatus.nextRetryAt}
                />
              </div>
            </div>

            {loading ? (
              <div className="text-muted small py-3">Loading pending orders…</div>
            ) : (
              <>
                <h6 className="mb-2">Pending / syncing ({pendingRows.length})</h6>
                {renderTable(pendingRows)}
                <h6 className="mt-4 mb-2">
                  Failed ({failedRows.length})
                  {action === 'retry' && retrySecondsLeft === 0 ? (
                    <span className="text-muted small ms-2 fw-normal">· retrying now…</span>
                  ) : retrySecondsLeft != null ? (
                    <span className="text-muted small ms-2 fw-normal">
                      · auto-retry in {formatCountdown(retrySecondsLeft)}
                    </span>
                  ) : null}
                </h6>
                {renderTable(failedRows, { highlightFailed: true })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
