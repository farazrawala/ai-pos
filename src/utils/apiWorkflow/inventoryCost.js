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
    avgCost: newQty > 0 ? roundMoney2(newValue / newQty) : 0,
  };
}

/** @param {InventoryState} state @param {number} qty */
export function applySale(state, qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return state;
  const newQty = Math.max(0, state.qty - q);
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
    case 'sale':
    case 'edit_purchase':
    case 'purchase_return':
    case 'delete_purchase':
    case 'delete_sales_return':
      return applySale(state, q);
    case 'edit_sale':
    case 'sales_return':
    case 'delete_sale':
    case 'delete_purchase_return':
      return applyPurchase(state, q, state.avgCost);
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
