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
 * AP is a positive liability balance (credit); cash is a positive asset balance (debit).
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
      return { ap: amount, cash: 0 };
    case 'edit_purchase':
    case 'delete_purchase':
      return { ap: -amount, cash: 0 };
    case 'purchase_return':
      return { ap: -amount, cash: 0 };
    case 'delete_purchase_return':
      return { ap: amount, cash: 0 };
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
 * Gross profit impact on owner's equity (sale price − avg cost at time of sale).
 * @param {import('./inventoryCost.js').InventoryState} costStateBefore
 */
export function equityDeltaFromLedger(lg, costStateBefore) {
  const q = Number(lg?.qty);
  if (!Number.isFinite(q) || q <= 0) return 0;

  const unit = Number(lg.unitPrice ?? lg.unitCost ?? TEST_CASE_SALE_UNIT_PRICE);
  const avg = Number(costStateBefore?.avgCost) || 0;
  const profit = roundMoney2(q * unit - q * avg);

  switch (lg.type) {
    case 'sale':
    case 'delete_sales_return':
      return profit;
    case 'edit_sale':
    case 'delete_sale':
    case 'sales_return':
      return -profit;
    default:
      return 0;
  }
}

/** @param {{ cash: number; inventory: number; fixedAssets: number; ap: number; longTermLiabilities: number; equity: number }} p */
export function buildBalanceSheetSnapshot(p) {
  const currentAssetsTotal = roundMoney2(p.cash);
  const inventoryTotal = roundMoney2(p.inventory);
  const fixedAssetsTotal = roundMoney2(p.fixedAssets);
  const totalAssets = roundMoney2(currentAssetsTotal + inventoryTotal + fixedAssetsTotal);

  const currentLiabilitiesTotal = roundMoney2(p.ap);
  const longTermLiabilitiesTotal = roundMoney2(p.longTermLiabilities);
  const totalLiabilities = roundMoney2(currentLiabilitiesTotal + longTermLiabilitiesTotal);

  const equityTotal = roundMoney2(p.equity);
  const totalLiabilitiesAndEquity = roundMoney2(totalLiabilities + equityTotal);
  const outOfBalance = roundMoney2(totalAssets - totalLiabilitiesAndEquity);

  return {
    currentAssets: {
      cash: currentAssetsTotal,
      total: currentAssetsTotal,
    },
    inventory: {
      total: inventoryTotal,
    },
    fixedAssets: {
      total: fixedAssetsTotal,
    },
    totalAssets,
    currentLiabilities: {
      accountsPayable: currentLiabilitiesTotal,
      total: currentLiabilitiesTotal,
    },
    longTermLiabilities: {
      total: longTermLiabilitiesTotal,
    },
    totalLiabilities,
    equity: {
      ownersEquity: equityTotal,
      total: equityTotal,
    },
    totalLiabilitiesAndEquity,
    outOfBalance,
    balanced: Math.abs(outOfBalance) < 0.01,
  };
}

/**
 * @param {{ name?: string; qtyLedger?: object; caseNo?: number; expectedQty?: number }[]} steps
 */
export function buildBalanceLedgerFromSteps(steps) {
  let ap = 0;
  let cash = 0;
  let equity = 0;
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
   *   equity: number;
   *   totalCurrentAssets: number;
   *   totalCurrentLiabilities: number;
   *   balanceSheet: ReturnType<typeof buildBalanceSheetSnapshot>;
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

    const costBefore = { ...costState };
    const { ap: apDelta, cash: cashDelta } = balanceLedgerDeltas(lg);
    const equityDelta = equityDeltaFromLedger(lg, costBefore);

    ap = roundMoney2(ap + apDelta);
    cash = roundMoney2(cash + cashDelta);
    equity = roundMoney2(equity + equityDelta);
    costState = applyQtyLedgerCost(costState, lg);

    const unit = Number(lg.unitPrice ?? lg.unitCost ?? TEST_CASE_SALE_UNIT_PRICE);
    const detailParts = [];
    if (apDelta !== 0) detailParts.push(`AP ${apDelta > 0 ? '+' : ''}${formatLedgerMoney(apDelta)}`);
    if (cashDelta !== 0) {
      detailParts.push(`Cash ${cashDelta > 0 ? '+' : ''}${formatLedgerMoney(cashDelta)}`);
    }
    if (equityDelta !== 0) {
      detailParts.push(`Equity ${equityDelta > 0 ? '+' : ''}${formatLedgerMoney(equityDelta)}`);
    }
    if (!detailParts.length && unit > 0) {
      detailParts.push(`${lg.type} ${lg.qty} @ ${unit}`);
    }

    const balanceSheet = buildBalanceSheetSnapshot({
      cash,
      inventory: costState.value,
      fixedAssets: 0,
      ap,
      longTermLiabilities: 0,
      equity,
    });

    rows.push({
      stepIndex: index,
      stepName: step.name || `Step ${index + 1}`,
      caseNo: step.caseNo,
      kind: lg.type,
      ap,
      cash,
      inventoryValue: costState.value,
      equity,
      totalCurrentAssets: balanceSheet.currentAssets.total,
      totalCurrentLiabilities: balanceSheet.currentLiabilities.total,
      balanceSheet,
      apDelta,
      cashDelta,
      expectedQty: step.expectedQty,
      detail: detailParts.join(' · '),
    });
  });

  return rows;
}

export { formatLedgerMoney };
