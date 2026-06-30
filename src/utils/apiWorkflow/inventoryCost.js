/** @typedef {{ qty: number; value: number; avgCost: number }} InventoryState */

export const EMPTY_INVENTORY = { qty: 0, value: 0, avgCost: 0 };

/** @param {number} n */
export function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** @param {InventoryState} state @param {number} qty @param {number} unitCost */
export function applyPurchase(state, qty, unitCost) {
  const q = Number(qty);
  const c = Number(unitCost);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(c)) return state;
  const newQty = state.qty + q;
  const newValue = roundMoney2(state.value + q * c);
  return {
    qty: newQty,
    value: newValue,
    // Keep WAC at full precision internally; round only for display.
    avgCost: newQty !== 0 ? newValue / newQty : 0,
  };
}

/**
 * Reduce stock by removing units at a specific unit cost (used when a purchase
 * order is edited/reduced). This recalculates the WAC from the remaining value,
 * unlike a sale which leaves the WAC unchanged.
 * @param {InventoryState} state @param {number} qty @param {number} [unitCost]
 */
export function applyReduceAtCost(state, qty, unitCost) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return state;
  const c = Number(unitCost);
  const cost = Number.isFinite(c) ? c : state.avgCost;
  const newQty = state.qty - q;
  const newValue = roundMoney2(state.value - q * cost);
  return {
    qty: newQty,
    value: newValue,
    avgCost: newQty !== 0 ? newValue / newQty : 0,
  };
}

/**
 * @param {InventoryState} state @param {number} qty
 * Qty is allowed to go negative (oversell) so the ledger can show negative
 * stock and negative inventory value (qty × WAC) instead of clamping at 0.
 */
export function applySale(state, qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return state;
  const newQty = state.qty - q;
  if (newQty === 0) {
    return { qty: 0, value: 0, avgCost: 0 };
  }
  const avg = state.avgCost;
  return {
    qty: newQty,
    value: roundMoney2(newQty * avg),
    avgCost: avg,
  };
}

/** @typedef {{ type: string; qty: number; unitCost?: number }} QtyLedgerCostEntry */

/** Apply a test-case qty ledger entry to running WAC inventory state. */
export function applyQtyLedgerCost(state, lg) {
  const q = Number(lg?.qty);
  if (!Number.isFinite(q) || q <= 0) return state;

  switch (lg.type) {
    case 'purchase':
      return applyPurchase(state, q, lg.unitCost);
    // Editing/deleting a purchase removes those units at the purchase cost,
    // which recalculates the WAC from the remaining inventory value.
    case 'edit_purchase':
    case 'delete_purchase':
      return applyReduceAtCost(state, q, lg.unitCost ?? lg.unitPrice);
    // Sales and purchase returns leave the WAC unchanged (remove at current WAC).
    case 'sale':
    case 'purchase_return':
    case 'delete_sales_return':
      return applySale(state, q);
    case 'edit_sale':
    case 'sales_return':
    case 'delete_sale':
    case 'delete_purchase_return':
      return applyPurchase(state, q, state.avgCost);
    case 'edit_purchase_price': {
      const oldC = Number(lg.unitCost ?? lg.unitPrice);
      const newC = Number(lg.newUnitCost ?? lg.editPrice);
      if (!Number.isFinite(oldC) || !Number.isFinite(newC)) return state;
      const newValue = roundMoney2(state.value + q * (newC - oldC));
      return {
        qty: state.qty,
        value: newValue,
        avgCost: state.qty !== 0 ? newValue / state.qty : 0,
      };
    }
    default:
      return state;
  }
}

/**
 * Build running WAC rows from workflow steps that define `ledger`.
 * @param {{ name?: string; ledger?: { type: string; qty: number; unitCost?: number } }[]} steps
 */
export function buildLedgerFromSteps(steps) {
  /** @type {InventoryState} */
  let state = { ...EMPTY_INVENTORY };
  /** @type {Array<{ stepIndex: number; stepName: string; kind: string; qty: number; value: number; avgCost: number; detail: string }>} */
  const rows = [];

  steps.forEach((step, index) => {
    const lg = step?.ledger;
    if (!lg || typeof lg !== 'object') return;

    let detail = '';
    if (lg.type === 'purchase') {
      state = applyPurchase(state, lg.qty, lg.unitCost);
      detail = `${lg.qty} @ ${lg.unitCost}`;
    } else if (lg.type === 'sale') {
      state = applySale(state, lg.qty);
      detail = `${lg.qty} units`;
    } else {
      return;
    }

    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      kind: lg.type,
      qty: state.qty,
      value: state.value,
      avgCost: state.avgCost,
      detail,
    });
  });

  return rows;
}

/** @param {number} n */
export function formatLedgerMoney(n) {
  return roundMoney2(n).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
