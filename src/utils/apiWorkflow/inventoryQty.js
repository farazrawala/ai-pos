import { EMPTY_INVENTORY, applyQtyLedgerCost } from './inventoryCost.js';

/**
 * Running quantity ledger for inventory test cases (from test_case.rb).
 * @typedef {{ type: string; qty: number; unitCost?: number }} QtyLedgerEntry
 */

/** @param {number} state @param {number} delta */
export function applyQtyDelta(state, delta) {
  const next = Number(state) + Number(delta);
  return Number.isFinite(next) ? next : state;
}

/** @param {QtyLedgerEntry} lg */
export function qtyLedgerDelta(lg) {
  const q = Number(lg?.qty);
  if (!Number.isFinite(q) || q <= 0) return 0;
  switch (lg.type) {
    case 'purchase':
      return q;
    case 'sale':
      return -q;
    case 'purchase_return':
      return -q;
    case 'sales_return':
      return q;
    case 'delete_purchase':
      return -q;
    case 'delete_sale':
      return q;
    case 'delete_purchase_return':
      return q;
    case 'delete_sales_return':
      return -q;
    case 'edit_sale':
      return q;
    case 'edit_purchase':
      return -q;
    case 'edit_sales_return':
      return -q;
    case 'edit_purchase_return':
      return q;
    default:
      return 0;
  }
}

/** @param {QtyLedgerEntry} lg */
export function qtyLedgerDetail(lg) {
  const q = Number(lg?.qty);
  if (!Number.isFinite(q) || q <= 0) return '';
  switch (lg.type) {
    case 'purchase':
      return `+${q}`;
    case 'sale':
      return `-${q}`;
    case 'purchase_return':
      return `PR -${q}`;
    case 'sales_return':
      return `SR +${q}`;
    case 'delete_purchase':
      return `undo PO -${q}`;
    case 'delete_sale':
      return `undo sale +${q}`;
    case 'delete_purchase_return':
      return `undo PR +${q}`;
    case 'delete_sales_return':
      return `undo SR -${q}`;
    case 'edit_sale':
      return `edit sale +${q}`;
    case 'edit_purchase':
      return `edit PO -${q}`;
    case 'edit_sales_return':
      return `edit SR -${q}`;
    case 'edit_purchase_return':
      return `edit PR +${q}`;
    default:
      return '';
  }
}

/**
 * @param {{ name?: string; qtyLedger?: QtyLedgerEntry; expectedQty?: number }[]} steps
 */
export function buildQtyLedgerFromSteps(steps) {
  let qty = 0;
  /** @type {import('./inventoryCost.js').InventoryState} */
  let costState = { ...EMPTY_INVENTORY };
  /** @type {Array<{ stepIndex: number; stepName: string; caseNo?: number; kind: string; delta: number; qty: number; expectedQty?: number; avgCost: number; detail: string }>} */
  const rows = [];

  steps.forEach((step, index) => {
    const lg = step?.qtyLedger;
    if (!lg || typeof lg !== 'object') return;

    const delta = qtyLedgerDelta(lg);
    if (delta === 0) return;

    const detail = qtyLedgerDetail(lg);
    qty = applyQtyDelta(qty, delta);
    costState = applyQtyLedgerCost(costState, lg);
    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      caseNo: step.caseNo,
      kind: lg.type,
      delta,
      qty,
      expectedQty: step.expectedQty,
      avgCost: costState.avgCost,
      detail,
    });
  });

  return rows;
}

/**
 * Running expected qty after applying all qtyLedger entries through stepIndex (inclusive).
 * @param {{ qtyLedger?: import('./inventoryQty.js').QtyLedgerEntry }[]} steps
 * @param {number} stepIndex
 */
export function computeExpectedQtyThroughStep(steps, stepIndex) {
  let qty = 0;
  const end = Math.min(stepIndex, steps.length - 1);
  for (let i = 0; i <= end; i++) {
    const lg = steps[i]?.qtyLedger;
    if (!lg) continue;
    const delta = qtyLedgerDelta(lg);
    if (delta !== 0) qty = applyQtyDelta(qty, delta);
  }
  return qty;
}
