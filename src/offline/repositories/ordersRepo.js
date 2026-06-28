import { ensureOfflineDbOpen, offlineDb, PENDING_ORDER_STATUS } from '../db.js';
import { omitUndefined } from '../utils/recordId.js';

export { PENDING_ORDER_STATUS };

function normalizePendingOrder(order) {
  if (!order || typeof order !== 'object') return null;
  const clientOrderId = String(order.client_order_id ?? '').trim();
  if (!clientOrderId) return null;

  return omitUndefined({
    client_order_id: clientOrderId,
    local_invoice_no: order.local_invoice_no ?? null,
    payload: order.payload ?? null,
    cart_snapshot: order.cart_snapshot ?? null,
    status: order.status ?? PENDING_ORDER_STATUS.PENDING,
    server_order_id: order.server_order_id ?? null,
    server_invoice_no: order.server_invoice_no ?? null,
    error_message: order.error_message ?? null,
    retry_count: Number(order.retry_count) || 0,
    created_at: order.created_at ?? new Date().toISOString(),
    synced_at: order.synced_at ?? null,
  });
}

export async function upsertPendingOrder(order) {
  await ensureOfflineDbOpen();
  const row = normalizePendingOrder(order);
  if (!row) throw new Error('pending order requires client_order_id');
  await offlineDb.pending_orders.put(row);
  return row;
}

export async function getPendingOrderByClientId(clientOrderId) {
  await ensureOfflineDbOpen();
  const key = String(clientOrderId ?? '').trim();
  if (!key) return null;
  return (await offlineDb.pending_orders.get(key)) ?? null;
}

export async function listPendingOrders() {
  await ensureOfflineDbOpen();
  return offlineDb.pending_orders
    .where('status')
    .equals(PENDING_ORDER_STATUS.PENDING)
    .sortBy('created_at');
}

export async function listFailedOrders() {
  await ensureOfflineDbOpen();
  return offlineDb.pending_orders
    .where('status')
    .equals(PENDING_ORDER_STATUS.FAILED)
    .sortBy('created_at');
}

export async function listOrdersByStatus(status) {
  await ensureOfflineDbOpen();
  return offlineDb.pending_orders.where('status').equals(String(status)).sortBy('created_at');
}

export async function listAllPendingOrders() {
  await ensureOfflineDbOpen();
  return offlineDb.pending_orders.orderBy('created_at').toArray();
}

export async function updatePendingOrderStatus(clientOrderId, patch = {}) {
  await ensureOfflineDbOpen();
  const key = String(clientOrderId ?? '').trim();
  if (!key) throw new Error('client_order_id is required');

  const existing = await offlineDb.pending_orders.get(key);
  if (!existing) return null;

  const next = normalizePendingOrder({ ...existing, ...patch, client_order_id: key });
  await offlineDb.pending_orders.put(next);
  return next;
}

export async function countPendingOrdersByStatus(status) {
  await ensureOfflineDbOpen();
  return offlineDb.pending_orders.where('status').equals(String(status)).count();
}

export async function clearPendingOrders() {
  await ensureOfflineDbOpen();
  await offlineDb.pending_orders.clear();
}

export async function recordLocalStockAdjustment({
  product_id,
  warehouse_id,
  delta_qty,
  client_order_id = null,
  created_at = new Date().toISOString(),
}) {
  await ensureOfflineDbOpen();
  const productId = String(product_id ?? '').trim();
  const warehouseId = String(warehouse_id ?? '').trim();
  if (!productId || !warehouseId) {
    throw new Error('product_id and warehouse_id are required');
  }

  const row = omitUndefined({
    product_id: productId,
    warehouse_id: warehouseId,
    delta_qty: Number(delta_qty) || 0,
    client_order_id: client_order_id ? String(client_order_id) : undefined,
    created_at,
  });

  const id = await offlineDb.local_stock_adjustments.add(row);
  return { ...row, id };
}

export async function listLocalStockAdjustmentsForProduct(productId, warehouseId) {
  await ensureOfflineDbOpen();
  const pid = String(productId ?? '').trim();
  const wid = String(warehouseId ?? '').trim();
  if (!pid || !wid) return [];

  return offlineDb.local_stock_adjustments
    .where('[product_id+warehouse_id]')
    .equals([pid, wid])
    .toArray();
}

export async function clearLocalStockAdjustments() {
  await ensureOfflineDbOpen();
  await offlineDb.local_stock_adjustments.clear();
}
