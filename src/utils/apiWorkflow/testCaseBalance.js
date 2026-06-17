import {
  EMPTY_INVENTORY,
  applyQtyLedgerCost,
  formatLedgerMoney,
  roundMoney2,
} from './inventoryCost.js';
import { qtyLedgerDelta } from './inventoryQty.js';

/** POS sale unit price in inventory test cases (matches testCaseSteps PRODUCT_PRICE). */
export const TEST_CASE_SALE_UNIT_PRICE = 300;

/**
 * Cash / AP balance change for a qty-ledger step (full payment model).
 * Purchases paid from `default_account_payable_account`; sales to `default_cash_account`.
 * @param {{ type: string; qty: number; unitPrice?: number; unitCost?: number }} lg
 */
export function balanceLedgerDeltas(lg) {
  const q = Number(lg?.qty);
  if (!Number.isFinite(q) || q <= 0) return { ap: 0, cash: 0 };

  const unit = Number(lg.unitPrice ?? lg.unitCost ?? TEST_CASE_SALE_UNIT_PRICE);
  if (!Number.isFinite(unit)) return { ap: 0, cash: 0 };

  const amount = roundMoney2(q * unit);

  switch (lg.type) {
    case 'purchase':
      return { ap: -amount, cash: 0 };
    case 'edit_purchase':
    case 'delete_purchase':
      return { ap: amount, cash: 0 };
    case 'purchase_return':
      return { ap: amount, cash: 0 };
    case 'delete_purchase_return':
      return { ap: -amount, cash: 0 };
    case 'sale':
      return { ap: 0, cash: amount };
    case 'edit_sale':
    case 'delete_sale':
      return { ap: 0, cash: -amount };
    case 'sales_return':
      return { ap: 0, cash: -amount };
    case 'delete_sales_return':
      return { ap: 0, cash: amount };
    default:
      return { ap: 0, cash: 0 };
  }
}

/**
 * @param {{ name?: string; qtyLedger?: object; caseNo?: number; expectedQty?: number }[]} steps
 */
export function buildBalanceLedgerFromSteps(steps) {
  let ap = 0;
  let cash = 0;
  /** @type {import('./inventoryCost.js').InventoryState} */
  let costState = { ...EMPTY_INVENTORY };

  /** @type {Array<{
   *   stepIndex: number;
   *   stepName: string;
   *   caseNo?: number;
   *   kind: string;
   *   ap: number;
   *   cash: number;
   *   inventoryValue: number;
   *   totalCurrentAssets: number;
   *   totalCurrentLiabilities: number;
   *   apDelta: number;
   *   cashDelta: number;
   *   expectedQty?: number;
   *   detail: string;
   * }>} */
  const rows = [];

  steps.forEach((step, index) => {
    const lg = step?.qtyLedger;
    if (!lg || typeof lg !== 'object') return;

    const delta = qtyLedgerDelta(lg);
    if (delta === 0) return;

    const { ap: apDelta, cash: cashDelta } = balanceLedgerDeltas(lg);
    ap = roundMoney2(ap + apDelta);
    cash = roundMoney2(cash + cashDelta);
    costState = applyQtyLedgerCost(costState, lg);

    const unit = Number(lg.unitPrice ?? lg.unitCost ?? TEST_CASE_SALE_UNIT_PRICE);
    const detailParts = [];
    if (apDelta !== 0) detailParts.push(`AP ${apDelta > 0 ? '+' : ''}${formatLedgerMoney(apDelta)}`);
    if (cashDelta !== 0) {
      detailParts.push(`Cash ${cashDelta > 0 ? '+' : ''}${formatLedgerMoney(cashDelta)}`);
    }
    if (!detailParts.length && unit > 0) {
      detailParts.push(`${lg.type} ${lg.qty} @ ${unit}`);
    }

    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      caseNo: step.caseNo,
      kind: lg.type,
      ap,
      cash,
      inventoryValue: costState.value,
      totalCurrentAssets: roundMoney2(cash + costState.value),
      totalCurrentLiabilities: roundMoney2(ap),
      apDelta,
      cashDelta,
      expectedQty: step.expectedQty,
      detail: detailParts.join(' · '),
    });
  });

  return rows;
}

export { formatLedgerMoney };
