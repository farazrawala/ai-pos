import { computeExpectedQtyThroughStep } from './inventoryQty.js';

function normalizeId(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '').trim();
  return String(value).trim();
}

function isPopulatedRef(ref) {
  return ref && typeof ref === 'object' && !Array.isArray(ref);
}

function normalizeWarehouseInventoryList(responseData) {
  if (!responseData || typeof responseData !== 'object') return [];
  if (Array.isArray(responseData.data)) return responseData.data;
  if (Array.isArray(responseData.warehouse_inventory)) return responseData.warehouse_inventory;
  if (Array.isArray(responseData)) return responseData;
  return [];
}

/**
 * Sum warehouse-inventory quantity for a product (optionally scoped to one warehouse).
 * @param {unknown} responseData
 * @param {string} productId
 * @param {string} [warehouseId]
 */
export function extractWarehouseQtyForProduct(responseData, productId, warehouseId = '') {
  const pid = normalizeId(productId);
  if (!pid) return null;

  const wid = normalizeId(warehouseId);
  const rows = normalizeWarehouseInventoryList(responseData);
  let total = 0;
  let matched = false;

  for (const row of rows) {
    const rowProductId = normalizeId(row?.product_id ?? row?.product);
    if (rowProductId !== pid) continue;

    if (wid) {
      const rowWarehouseId = normalizeId(row?.warehouse_id ?? row?.warehouse);
      if (rowWarehouseId !== wid) continue;
    }

    const q = Number(row?.quantity ?? row?.qty);
    if (!Number.isFinite(q)) continue;
    total += q;
    matched = true;
  }

  return matched ? total : wid ? 0 : null;
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
  const path = 'api/warehouse_inventory/get-all-active?populate=product_id,warehouse_id&limit=200';
  return `${root}/${path.replace(/^\//, '')}`;
}

/**
 * @param {number | null} actual
 * @param {number} expected
 */
export function qtyMatchesExpected(actual, expected) {
  if (actual == null || !Number.isFinite(actual)) return false;
  return actual === expected;
}
