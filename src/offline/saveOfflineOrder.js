import { v4 as uuidv4 } from 'uuid';
import { pickWarehouseRefId } from '../utils/productStock.js';
import { nextLocalInvoiceNo } from './localInvoiceNo.js';
import {
  PENDING_ORDER_STATUS,
  recordLocalStockAdjustment,
  upsertPendingOrder,
} from './repositories/ordersRepo.js';
import { getProductById, upsertProducts } from './repositories/productsRepo.js';

function applyStockDecrement(product, qty, warehouseId) {
  const next = { ...product };
  const delta = Math.max(0, Number(qty) || 0);
  if (delta <= 0) return next;

  const dec = (value) => Math.max(0, (Number(value) || 0) - delta);
  const wh = String(warehouseId || '').trim();

  if (wh && next.pos_available_qty != null && next.pos_available_qty !== '') {
    next.pos_available_qty = dec(next.pos_available_qty);
    return next;
  }

  const inventory = next.warehouse_inventory ?? next.warehouseInventory;
  if (Array.isArray(inventory) && wh) {
    const key = Array.isArray(next.warehouse_inventory) ? 'warehouse_inventory' : 'warehouseInventory';
    next[key] = inventory.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const rowWh = pickWarehouseRefId(row.warehouse_id ?? row.warehouseId);
      if (rowWh !== wh) return row;
      return { ...row, quantity: dec(row.quantity) };
    });
    return next;
  }

  if (next.total_stock != null && next.total_stock !== '') {
    next.total_stock = dec(next.total_stock);
  } else if (next.stock != null && next.stock !== '') {
    next.stock = dec(next.stock);
  } else if (next.total_warehouse_qty != null && next.total_warehouse_qty !== '') {
    next.total_warehouse_qty = dec(next.total_warehouse_qty);
  }

  return next;
}

async function decrementLocalStockForLines(lines, warehouseId, clientOrderId) {
  for (const line of Array.isArray(lines) ? lines : []) {
    const productId = String(line?.productId ?? '').trim();
    const qty = Number(line?.qty) || 0;
    if (!productId || qty <= 0) continue;

    const product = await getProductById(productId);
    if (!product) continue;

    const updated = applyStockDecrement(product, qty, warehouseId);
    await upsertProducts([updated]);

    const wh = String(warehouseId || '').trim();
    if (wh) {
      await recordLocalStockAdjustment({
        product_id: productId,
        warehouse_id: wh,
        delta_qty: -qty,
        client_order_id: clientOrderId,
      });
    }
  }
}

/**
 * Save a POS sale locally for later sync (offline checkout).
 * @param {object} params
 * @param {object} params.payload - Same shape as `createPosOrderRequest` input
 * @param {Array} params.cartSnapshot - Cart lines for receipt reprint
 * @param {string} [params.warehouseId]
 */
export async function saveOfflineOrder({ payload, cartSnapshot, warehouseId = '' }) {
  const clientOrderId = uuidv4();
  const localInvoiceNo = await nextLocalInvoiceNo();
  const orderPayload = {
    ...(payload && typeof payload === 'object' ? payload : {}),
    client_order_id: clientOrderId,
  };

  await decrementLocalStockForLines(orderPayload.lines, warehouseId, clientOrderId);

  const saved = await upsertPendingOrder({
    client_order_id: clientOrderId,
    local_invoice_no: localInvoiceNo,
    payload: orderPayload,
    cart_snapshot: Array.isArray(cartSnapshot) ? cartSnapshot : [],
    status: PENDING_ORDER_STATUS.PENDING,
    created_at: new Date().toISOString(),
  });

  return {
    order: saved,
    client_order_id: clientOrderId,
    local_invoice_no: localInvoiceNo,
  };
}

export function buildOfflineSaveResult(offlineResult, customer = {}) {
  return {
    offline: true,
    result: {
      offline: true,
      client_order_id: offlineResult.client_order_id,
      local_invoice_no: offlineResult.local_invoice_no,
      order: offlineResult.order,
    },
    localInvoiceNo: offlineResult.local_invoice_no,
    clientOrderId: offlineResult.client_order_id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    cartSnapshot: customer.cartSnapshot ?? offlineResult.order?.cart_snapshot ?? [],
  };
}
