import { EMPTY_INVENTORY, applyQtyLedgerCost } from './inventoryCost.js';

/**
 * Running quantity ledger for inventory test cases (from test_case.rb).
 * @typedef {{ type: string; qty: number; unitCost?: number }} QtyLedgerEntry
 */

/** @param {typeof import('./testCaseSteps.js').INVENTORY_TEST_CASES[number][] | null} cases */
function syncLedgerQtyFromCase(qty, costState, step, cases) {
  if (!cases || step?.caseNo == null || !step.caseFinal) return { qty, costState };
  const tc = cases.find((c) => c.n === step.caseNo);
  if (!tc?.replayQty || tc?.expected == null || !Number.isFinite(Number(tc.expected))) {
    return { qty, costState };
  }
  const nextQty = Number(tc.expected);
  if (nextQty === 0) {
    return { qty: 0, costState: { ...EMPTY_INVENTORY } };
  }
  return {
    qty: nextQty,
    costState: {
      ...costState,
      qty: nextQty,
      value: nextQty * costState.avgCost,
    },
  };
}

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
    case 'edit_purchase_price':
      return 0;
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
    case 'edit_purchase_price':
      return `edit PO price`;
    case 'edit_sales_return':
      return `edit SR -${q}`;
    case 'edit_purchase_return':
      return `edit PR +${q}`;
    default:
      return '';
  }
}

/** @param {{ undoQty?: number; refQty?: number; qty?: number } | null | undefined} tc */
function caseUndoQty(tc) {
  if (!tc) return null;
  const n = Number(tc.undoQty ?? tc.refQty ?? tc.qty);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** @param {{ type?: string } | null | undefined} tc @param {number} effectiveDelta */
function buildReplayDetail(tc, effectiveDelta) {
  const undo = caseUndoQty(tc);
  if (tc?.type === 'delete_purchase' && undo != null) {
    return `↺ replay · delete PO −${undo}`;
  }
  if (tc?.type === 'delete_sale' && undo != null) {
    return `↺ replay · delete sale +${undo}`;
  }
  if (tc?.type === 'delete_purchase_return' && undo != null) {
    return `↺ replay · delete PR +${undo}`;
  }
  if (tc?.type === 'delete_sales_return' && undo != null) {
    return `↺ replay · delete SR −${undo}`;
  }
  if (tc?.type === 'edit_purchase_price') {
    return '↺ replay · edit PO price';
  }
  if (effectiveDelta !== 0) {
    return `↺ replay ${effectiveDelta > 0 ? `+${effectiveDelta}` : effectiveDelta}`;
  }
  return '↺ replay';
}

/**
 * @param {{ name?: string; qtyLedger?: QtyLedgerEntry; expectedQty?: number; caseNo?: number; caseFinal?: boolean; replayExpectedQty?: number }[]} steps
 * @param {Array<{ n: number; expected?: number; type?: string; undoQty?: number; refQty?: number; qty?: number; replayQty?: boolean }> | null} [cases]
 */
export function buildQtyLedgerFromSteps(steps, cases = null) {
  let qty = 0;
  /** @type {import('./inventoryCost.js').InventoryState} */
  let costState = { ...EMPTY_INVENTORY };
  /** @type {Array<{ stepIndex: number; stepName: string; caseNo?: number; docRef?: string; kind: string; delta: number; undoQty?: number; qty: number; expectedQty?: number; avgCost: number; detail: string }>} */
  const rows = [];

  steps.forEach((step, index) => {
    const lg = step?.qtyLedger;
    const tc = cases?.find((c) => c.n === step.caseNo);
    if (!lg || typeof lg !== 'object') {
      if (step.caseFinal && step.replayExpectedQty != null && step.expectedQty != null) {
        const priorQty = qty;
        const nextQty = Number(step.expectedQty);
        const effectiveDelta = nextQty - priorQty;
        qty = nextQty;
        if (qty === 0) {
          costState = { ...EMPTY_INVENTORY };
        } else {
          costState = {
            ...costState,
            qty,
            value: qty * costState.avgCost,
          };
        }
        rows.push({
          stepIndex: index,
          stepName: step.name || `Step ${index + 1}`,
          caseNo: step.caseNo,
          docRef: step.docRef ?? '',
          kind: step.replayExpectedQty != null ? 'replay' : 'expected',
          delta: effectiveDelta,
          undoQty: caseUndoQty(tc) ?? undefined,
          qty,
          expectedQty: step.expectedQty,
          avgCost: costState.avgCost,
          value: costState.value,
          detail: buildReplayDetail(tc, effectiveDelta),
        });
      }
      return;
    }

    const delta = qtyLedgerDelta(lg);
    const costOnly = lg.type === 'edit_purchase_price';
    if (delta === 0 && !costOnly) return;

    const priorQty = qty;
    const detail = qtyLedgerDetail(lg);
    if (delta !== 0) qty = applyQtyDelta(qty, delta);
    costState = applyQtyLedgerCost(costState, lg);
    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      caseNo: step.caseNo,
      docRef: step.docRef ?? '',
      kind: lg.type,
      delta,
      undoQty: Number(lg.qty) > 0 ? Number(lg.qty) : undefined,
      qty,
      expectedQty: step.expectedQty,
      avgCost: costState.avgCost,
      value: costState.value,
      detail,
    });

    if (step.caseFinal) {
      ({ qty, costState } = syncLedgerQtyFromCase(qty, costState, step, cases));
      const last = rows[rows.length - 1];
      if (last) {
        last.qty = qty;
        last.delta = qty - priorQty;
        last.avgCost = costState.avgCost;
        last.value = costState.value;
        if (tc?.replayQty) {
          last.undoQty = caseUndoQty(tc) ?? last.undoQty;
          last.detail = buildReplayDetail(tc, last.delta);
          last.kind = 'replay';
        }
      }
    }
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
