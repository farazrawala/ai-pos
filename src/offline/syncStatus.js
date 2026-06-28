import {
  countPendingOrdersByStatus,
  PENDING_ORDER_STATUS,
} from './repositories/ordersRepo.js';

const listeners = new Set();

let state = {
  pending: 0,
  failed: 0,
  syncing: false,
  currentClientOrderId: null,
  // Epoch ms of the next scheduled automatic sync/retry (null when not scheduled).
  nextRetryAt: null,
};

export function getSyncStatus() {
  return { ...state };
}

export function setSyncStatus(patch = {}) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try {
      listener(getSyncStatus());
    } catch (err) {
      console.warn('[syncStatus] listener error', err);
    }
  });
}

export function subscribeSyncStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(getSyncStatus());
  return () => listeners.delete(listener);
}

export async function refreshSyncStatusCounts() {
  const [pending, failed] = await Promise.all([
    countPendingOrdersByStatus(PENDING_ORDER_STATUS.PENDING),
    countPendingOrdersByStatus(PENDING_ORDER_STATUS.FAILED),
  ]);
  setSyncStatus({ pending, failed });
  return getSyncStatus();
}
