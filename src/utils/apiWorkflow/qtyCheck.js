import { computeExpectedQtyThroughStep } from './inventoryQty.js';

function normalizeId(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '').trim();
  return String(value).trim();
}

function rowQuantity(row) {
  if (!row || typeof row !== 'object') return null;
  const raw = row.quantity ?? row.qty ?? row.available_qty ?? row.stock ?? row.net_qty;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function normalizeWarehouseInventoryList(responseData) {
  if (!responseData || typeof responseData !== 'object') return [];
  if (Array.isArray(responseData.data)) return responseData.data;
  if (Array.isArray(responseData.warehouse_inventory)) return responseData.warehouse_inventory;
  if (Array.isArray(responseData)) return responseData;

  const nested = responseData.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.warehouse_inventory)) return nested.warehouse_inventory;
    if (Array.isArray(nested.rows)) return nested.rows;
    if (Array.isArray(nested.items)) return nested.items;
  }

  return [];
}

/**
 * Sum warehouse-inventory quantity for a product (optionally scoped to one warehouse).
 * When a warehouse filter is set but no row matches that warehouse, falls back to the
 * product total across all warehouses (same rule as POS product stock helpers).
 * @param {unknown} responseData
 * @param {string} productId
 * @param {string} [warehouseId]
 */
export function extractWarehouseQtyForProduct(responseData, productId, warehouseId = '') {
  const pid = normalizeId(productId);
  if (!pid) return null;

  const wid = normalizeId(warehouseId);
  const rows = normalizeWarehouseInventoryList(responseData);
  let scopedTotal = 0;
  let allWarehousesTotal = 0;
  let matchedWarehouse = false;
  let hasProductRow = false;

  for (const row of rows) {
    const rowProductId = normalizeId(row?.product_id ?? row?.product ?? row?.productId);
    if (rowProductId !== pid) continue;

    const q = rowQuantity(row);
    if (q == null) continue;

    hasProductRow = true;
    allWarehousesTotal += q;

    if (!wid) {
      scopedTotal += q;
      matchedWarehouse = true;
      continue;
    }

    const rowWarehouseId = normalizeId(row?.warehouse_id ?? row?.warehouse ?? row?.warehouseId);
    if (rowWarehouseId !== wid) continue;
    scopedTotal += q;
    matchedWarehouse = true;
  }

  if (!hasProductRow) return wid ? 0 : null;
  if (!wid) return scopedTotal;
  return matchedWarehouse ? scopedTotal : allWarehousesTotal;
}

/**
 * Read qty from `inventory_movements/stock-by-product/:id` response.
 * @param {unknown} responseData
 * @param {string} [warehouseId]
 */
export function extractStockByProductQty(responseData, warehouseId = '') {
  if (!responseData || typeof responseData !== 'object') return null;

  const root =
    responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)
      ? responseData.data
      : responseData;

  const wid = normalizeId(warehouseId);
  const warehouses = root.warehouses ?? root.data?.warehouses;

  if (Array.isArray(warehouses) && warehouses.length > 0) {
    let scopedTotal = 0;
    let allTotal = 0;
    let matchedWarehouse = false;

    for (const row of warehouses) {
      const q = rowQuantity(row);
      if (q == null) continue;
      allTotal += q;

      if (!wid) {
        scopedTotal += q;
        matchedWarehouse = true;
        continue;
      }

      const rowWarehouseId = normalizeId(row?.warehouse_id ?? row?.warehouseId);
      if (rowWarehouseId !== wid) continue;
      scopedTotal += q;
      matchedWarehouse = true;
    }

    if (wid) return matchedWarehouse ? scopedTotal : allTotal;
    return scopedTotal;
  }

  const topLevel = rowQuantity(root);
  return topLevel;
}

/** True when warehouse qty can be checked (test product id is known). */
export function shouldCheckQtyAfterStep(vars) {
  return Boolean(normalizeId(vars?.product_1_id));
}

/**
 * @param {object} step
 * @param {number} stepIndex
 * @param {object[]} allSteps
 */
export function expectedQtyForStep(step, stepIndex, allSteps) {
  if (step?.expectedQty != null && Number.isFinite(Number(step.expectedQty))) {
    return Number(step.expectedQty);
  }
  return computeExpectedQtyThroughStep(allSteps, stepIndex);
}

export function buildWarehouseInventoryCheckUrl(baseUrl) {
  const root = String(baseUrl || '').replace(/\/$/, '');
  const path =
    'api/warehouse_inventory/get-all-active?populate=product_id,warehouse_id&limit=2000';
  return `${root}/${path.replace(/^\//, '')}`;
}

export function buildStockByProductCheckUrl(baseUrl, productId) {
  const root = String(baseUrl || '').replace(/\/$/, '');
  const id = encodeURIComponent(String(productId || '').trim());
  const path = `api/inventory_movements/stock-by-product/${id}`;
  return `${root}/${path.replace(/^\//, '')}`;
}

/**
 * Prefer warehouse-inventory list; fall back to stock-by-product when needed.
 * @param {unknown} warehouseInventoryBody
 * @param {unknown | null | undefined} stockByProductBody
 * @param {string} productId
 * @param {string} [warehouseId]
 */
export function resolveActualProductQty(
  warehouseInventoryBody,
  stockByProductBody,
  productId,
  warehouseId = ''
) {
  const fromStock =
    stockByProductBody != null
      ? extractStockByProductQty(stockByProductBody, warehouseId)
      : null;
  const fromInventory = extractWarehouseQtyForProduct(
    warehouseInventoryBody,
    productId,
    warehouseId
  );

  if (fromInventory != null && Number.isFinite(fromInventory)) {
    if (fromInventory !== 0 || fromStock == null) return fromInventory;
  }
  if (fromStock != null && Number.isFinite(fromStock)) return fromStock;
  return fromInventory;
}

/**
 * @param {number | null} actual
 * @param {number} expected
 */
export function qtyMatchesExpected(actual, expected) {
  if (actual == null || !Number.isFinite(actual)) return false;
  return actual === expected;
}
