/** Warehouse ref → id string (populated doc or plain id). */
export function pickWarehouseRefId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const id = raw._id ?? raw.id;
    if (id != null) return String(id).trim();
  }
  const s = String(raw).trim();
  return s && s !== '[object Object]' ? s : '';
}

function sumWarehouseInventoryRows(inventory, warehouseId = '') {
  if (!Array.isArray(inventory)) return null;
  if (inventory.length === 0) return 0;

  const filterWh = String(warehouseId || '').trim();
  let total = 0;
  let matchedWh = false;

  for (const row of inventory) {
    if (!row || typeof row !== 'object') continue;
    const rowWh = pickWarehouseRefId(row.warehouse_id ?? row.warehouseId);
    if (filterWh && rowWh !== filterWh) continue;
    if (filterWh) matchedWh = true;
    total += Math.max(0, Number(row?.quantity) || 0);
  }

  if (filterWh && !matchedWh) return 0;
  return Math.round(total * 100) / 100;
}

/**
 * Available sellable qty for POS / cart checks.
 * Prefers POS API fields (`pos_available_qty`, `total_warehouse_qty`), then warehouse_inventory rows.
 * @param {unknown} item
 * @param {{ warehouseId?: string }} [options]
 * @returns {number | null} null only when no stock data exists on the record
 */
export function getProductAvailableStock(item, { warehouseId = '' } = {}) {
  if (!item || typeof item !== 'object') return null;

  const wh = String(warehouseId || '').trim();

  if (wh && item.pos_available_qty != null && item.pos_available_qty !== '') {
    const n = Number(item.pos_available_qty);
    if (Number.isFinite(n)) return Math.max(0, n);
  }

  if (!wh && item.total_warehouse_qty != null && item.total_warehouse_qty !== '') {
    const n = Number(item.total_warehouse_qty);
    if (Number.isFinite(n)) return Math.max(0, n);
  }

  if (item.total_stock != null && item.total_stock !== '') {
    const n = Number(item.total_stock);
    if (Number.isFinite(n)) return Math.max(0, n);
  }

  if (item.stock != null && item.stock !== '') {
    const n = Number(item.stock);
    if (Number.isFinite(n)) return Math.max(0, n);
  }

  const inv = item.warehouse_inventory ?? item.warehouseInventory;
  if (Array.isArray(inv)) {
    return sumWarehouseInventoryRows(inv, wh);
  }

  const children = item.childproducts ?? item.child_products ?? item.variations;
  if (Array.isArray(children) && children.length > 0) {
    let total = 0;
    let hasQty = false;
    for (const child of children) {
      const childStock = getProductAvailableStock(child, { warehouseId: wh });
      if (childStock != null) {
        total += childStock;
        hasQty = true;
      }
    }
    if (hasQty) return Math.round(total * 100) / 100;
  }

  return null;
}
