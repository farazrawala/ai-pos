import {
  createPosOrderRequest,
  extractOrderFromSaveResponse,
  pickOrderInvoiceNoFromSaveResponse,
} from '../features/orders/ordersAPI.js';
import { META_KEYS } from './db.js';
import { getMeta } from './repositories/metaRepo.js';
import {
  listFailedOrders,
  listOrdersByStatus,
  listPendingOrders,
  PENDING_ORDER_STATUS,
  updatePendingOrderStatus,
} from './repositories/ordersRepo.js';
import { ensureOfflineDbOpen, offlineDb } from './db.js';
import { runMasterSync } from './masterSync.js';
import { refreshSyncStatusCounts, setSyncStatus } from './syncStatus.js';

const BACKOFF_MS = [5000, 30000, 120000, 600000];
const SYNCED_ORDER_MAX_AGE_DAYS = 30;
/** How often pending + failed orders are automatically retried. */
export const SYNC_POLL_INTERVAL_MS = 60_000;

let processingPromise = null;
let pollTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
}

function isAuthSyncError(err) {
  const status = Number(err?.status);
  if (status === 401 || status === 403) return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('token') ||
    msg.includes('401') ||
    msg.includes('403')
  );
}

function backoffMsForRetry(retryCount) {
  const index = Math.max(0, Math.min(Number(retryCount) || 0, BACKOFF_MS.length - 1));
  return BACKOFF_MS[index];
}

export async function pruneOldSyncedOrders(maxAgeDays = SYNCED_ORDER_MAX_AGE_DAYS) {
  await ensureOfflineDbOpen();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const rows = await offlineDb.pending_orders
    .where('status')
    .equals(PENDING_ORDER_STATUS.SYNCED)
    .toArray();

  let removed = 0;
  for (const row of rows) {
    const ts = Date.parse(row.synced_at || row.created_at || '');
    if (!Number.isFinite(ts) || ts >= cutoff) continue;
    await offlineDb.pending_orders.delete(row.client_order_id);
    removed += 1;
  }
  return removed;
}

async function syncSingleOrder(order) {
  const clientOrderId = String(order?.client_order_id ?? '').trim();
  if (!clientOrderId) return { ok: false, reason: 'missing_id' };

  if (!getAuthToken()) {
    await updatePendingOrderStatus(clientOrderId, {
      status: PENDING_ORDER_STATUS.FAILED,
      error_message: 'Session expired — sign in again to sync orders',
      retry_count: (Number(order.retry_count) || 0) + 1,
    });
    return { ok: false, reason: 'auth', stopQueue: true };
  }

  setSyncStatus({ currentClientOrderId: clientOrderId });
  await updatePendingOrderStatus(clientOrderId, { status: PENDING_ORDER_STATUS.SYNCING });

  try {
    const payload =
      order.payload && typeof order.payload === 'object' ? { ...order.payload } : {};
    const result = await createPosOrderRequest({
      ...payload,
      client_order_id: clientOrderId,
    });

    const savedOrder = extractOrderFromSaveResponse(result);
    const serverOrderId = savedOrder?._id ?? savedOrder?.id ?? null;
    const serverInvoiceNo = pickOrderInvoiceNoFromSaveResponse(result);

    await updatePendingOrderStatus(clientOrderId, {
      status: PENDING_ORDER_STATUS.SYNCED,
      server_order_id: serverOrderId != null ? String(serverOrderId) : null,
      server_invoice_no: serverInvoiceNo || null,
      error_message: null,
      synced_at: new Date().toISOString(),
    });

    return { ok: true };
  } catch (err) {
    const retryCount = (Number(order.retry_count) || 0) + 1;
    const authError = isAuthSyncError(err);
    const message = authError
      ? 'Session expired — sign in again to sync orders'
      : err?.message || 'Sync failed';

    await updatePendingOrderStatus(clientOrderId, {
      status: PENDING_ORDER_STATUS.FAILED,
      error_message: message,
      retry_count: retryCount,
    });

    return { ok: false, reason: authError ? 'auth' : 'error', stopQueue: authError, err };
  }
}

/**
 * Upload pending offline orders FIFO (one at a time).
 */
export async function processSyncQueue(options = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await refreshSyncStatusCounts();
    return { synced: 0, failed: 0, skipped: true };
  }

  if (processingPromise && !options.force) {
    return processingPromise;
  }

  const job = performSyncQueue(options).finally(() => {
    processingPromise = null;
  });
  processingPromise = job;
  return job;
}

async function recoverStuckSyncingOrders() {
  const stuck = await listOrdersByStatus(PENDING_ORDER_STATUS.SYNCING);
  for (const order of stuck) {
    await updatePendingOrderStatus(order.client_order_id, {
      status: PENDING_ORDER_STATUS.PENDING,
    });
  }
}

async function performSyncQueue(options = {}) {
  setSyncStatus({ syncing: true });
  let synced = 0;
  let failed = 0;

  try {
    await recoverStuckSyncingOrders();
    const queue = await listPendingOrders();
    for (const order of queue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      const retryCount = Number(order.retry_count) || 0;
      if (retryCount > 0 && !options.skipBackoff) {
        await sleep(backoffMsForRetry(retryCount - 1));
      }

      const result = await syncSingleOrder(order);
      if (result.ok) {
        synced += 1;
      } else {
        failed += 1;
        if (result.stopQueue) break;
      }
    }

    if (synced > 0 && options.refreshCatalogAfter !== false) {
      try {
        const companyId = String((await getMeta(META_KEYS.COMPANY_ID)) ?? '').trim();
        const warehouseId = String((await getMeta(META_KEYS.WAREHOUSE_ID)) ?? '').trim();
        if (companyId) {
          runMasterSync({ companyId, warehouseId, force: true }).catch((err) => {
            console.warn('[syncOrders] Post-sync catalog refresh failed', err);
          });
        }
      } catch (err) {
        console.warn('[syncOrders] Could not start post-sync catalog refresh', err);
      }
    }

    await pruneOldSyncedOrders();
  } finally {
    setSyncStatus({ syncing: false, currentClientOrderId: null });
    await refreshSyncStatusCounts();
  }

  return { synced, failed };
}

/** Reset every failed order back to pending so the next sync pass uploads it again. */
async function requeueFailedOrders() {
  const failed = await listFailedOrders();
  for (const order of failed) {
    await updatePendingOrderStatus(order.client_order_id, {
      status: PENDING_ORDER_STATUS.PENDING,
      error_message: null,
    });
  }
  return failed.length;
}

export async function retryFailedOrders() {
  await requeueFailedOrders();
  return processSyncQueue({ force: true, skipBackoff: true });
}

/**
 * One automatic retry pass: requeue any failed orders, then upload the queue.
 * Used by the 1-minute poll so failed orders recover on their own.
 */
async function autoRetrySyncQueue() {
  await requeueFailedOrders();
  return processSyncQueue({ skipBackoff: true });
}

/** Publish when the next automatic retry will run, so the UI can show a countdown. */
function scheduleNextRetry(intervalMs) {
  setSyncStatus({ nextRetryAt: Date.now() + intervalMs });
}

export function startOrderSyncPolling(intervalMs = SYNC_POLL_INTERVAL_MS) {
  if (typeof window === 'undefined') return;
  stopOrderSyncPolling();

  scheduleNextRetry(intervalMs);

  pollTimer = window.setInterval(() => {
    scheduleNextRetry(intervalMs);
    if (!navigator.onLine) return;
    refreshSyncStatusCounts()
      .then((status) => {
        if (status.pending > 0 || status.failed > 0) {
          autoRetrySyncQueue().catch((err) => {
            console.warn('[syncOrders] Poll sync failed', err);
          });
        }
      })
      .catch(() => {});
  }, intervalMs);
}

export function stopOrderSyncPolling() {
  if (pollTimer != null && typeof window !== 'undefined') {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  setSyncStatus({ nextRetryAt: null });
}

export function wireOrderSyncTriggers() {
  if (typeof window === 'undefined') return () => {};

  refreshSyncStatusCounts().catch(() => {});

  const onOnline = () => {
    processSyncQueue().catch((err) => {
      console.warn('[syncOrders] Online sync failed', err);
    });
  };

  window.addEventListener('online', onOnline);
  startOrderSyncPolling();

  if (navigator.onLine) {
    processSyncQueue().catch((err) => {
      console.warn('[syncOrders] Initial sync failed', err);
    });
  }

  return () => {
    window.removeEventListener('online', onOnline);
    stopOrderSyncPolling();
  };
}
