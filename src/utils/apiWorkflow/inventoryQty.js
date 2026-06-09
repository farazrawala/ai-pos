/**
 * Running quantity ledger for inventory test cases (from test_case.rb).
 * @typedef {{ type: string; qty: number }} QtyLedgerEntry
 */

/** @param {number} state @param {number} delta */
export function applyQtyDelta(state, delta) {
  const next = Number(state) + Number(delta);
  return Number.isFinite(next) ? next : state;
}

/**
 * @param {{ name?: string; qtyLedger?: QtyLedgerEntry; expectedQty?: number }[]} steps
 */
export function buildQtyLedgerFromSteps(steps) {
  let qty = 0;
  /** @type {Array<{ stepIndex: number; stepName: string; caseNo?: number; kind: string; delta: number; qty: number; expectedQty?: number; detail: string }>} */
  const rows = [];

  steps.forEach((step, index) => {
    const lg = step?.qtyLedger;
    if (!lg || typeof lg !== 'object') return;

    const q = Number(lg.qty);
    if (!Number.isFinite(q) || q <= 0) return;

    let delta = 0;
    let detail = '';
    switch (lg.type) {
      case 'purchase':
        delta = q;
        detail = `+${q}`;
        break;
      case 'sale':
        delta = -q;
        detail = `-${q}`;
        break;
      case 'purchase_return':
        delta = -q;
        detail = `PR -${q}`;
        break;
      case 'sales_return':
        delta = q;
        detail = `SR +${q}`;
        break;
      case 'delete_purchase':
        delta = -q;
        detail = `undo PO -${q}`;
        break;
      case 'delete_sale':
        delta = q;
        detail = `undo sale +${q}`;
        break;
      case 'delete_purchase_return':
        delta = q;
        detail = `undo PR +${q}`;
        break;
      case 'delete_sales_return':
        delta = -q;
        detail = `undo SR -${q}`;
        break;
      default:
        return;
    }

    qty = applyQtyDelta(qty, delta);
    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      caseNo: step.caseNo,
      kind: lg.type,
      delta,
      qty,
      expectedQty: step.expectedQty,
      detail,
    });
  });

  return rows;
}
