import { describe, it, expect } from 'vitest';
import {
  computeIncomeStatementTotals,
  mergeOrderSalesIntoReport,
  mergeSalesReturnIntoReport,
  mergeCostOfGoodsIntoReport,
  mergeOperatingExpensesIntoReport,
  normalizeIncomeStatementPayload,
} from './incomeStatementAPI.js';

const emptyReport = () => ({
  revenue: [],
  costOfGoodsSold: [],
  operatingExpenses: [],
  otherIncome: [],
  otherExpenses: [],
});

const labels = (lines) => (lines || []).map((l) => l.label);

describe('Income statement — perpetual inventory (WAC) accounting rules', () => {
  it('reduces revenue by sales returns to produce net sales', () => {
    let report = emptyReport();
    report = mergeOrderSalesIntoReport(report, { totalAmount: 28_500 });
    report = mergeSalesReturnIntoReport(report, { totalAmount: 3_000 });

    expect(report.revenue).toEqual([
      { label: 'Sales', amount: 28_500 },
      { label: 'Sales returns', amount: -3_000 },
    ]);

    const totals = computeIncomeStatementTotals(report);
    expect(totals.totalRevenue).toBe(25_500); // net sales
  });

  it('COGS section contains ONLY the COGS line (no Purchases / Purchase returns)', () => {
    let report = emptyReport();
    report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 17_100 });

    expect(report.costOfGoodsSold).toEqual([
      { label: 'Cost of Goods Sold', amount: 17_100 },
    ]);
    expect(labels(report.costOfGoodsSold)).not.toContain('Purchases');
    expect(labels(report.costOfGoodsSold)).not.toContain('Purchase returns');
  });

  it('strips any legacy Purchases / Purchase returns lines from the base report', () => {
    const report = mergeCostOfGoodsIntoReport(
      {
        ...emptyReport(),
        costOfGoodsSold: [
          { label: 'Purchases', amount: 19_740 },
          { label: 'Purchase returns', amount: -1_000 },
        ],
      },
      { costOfGoodsSold: 17_100 }
    );
    expect(report.costOfGoodsSold).toEqual([
      { label: 'Cost of Goods Sold', amount: 17_100 },
    ]);
  });

  it('computes Gross Profit = Net Sales − COGS (no double counting of purchases)', () => {
    let report = emptyReport();
    report = mergeOrderSalesIntoReport(report, { totalAmount: 28_500 });
    report = mergeSalesReturnIntoReport(report, { totalAmount: 3_000 });
    report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 17_100 });

    const totals = computeIncomeStatementTotals(report);
    expect(totals.totalRevenue).toBe(25_500);
    expect(totals.totalCOGS).toBe(17_100);
    // Was incorrectly (10,340) when purchases were added to COGS; now +8,400.
    expect(totals.grossProfit).toBe(8_400);
  });

  it('rolls up operating expenses, other income/expense into net income', () => {
    let report = emptyReport();
    report = mergeOrderSalesIntoReport(report, { totalAmount: 28_500 });
    report = mergeSalesReturnIntoReport(report, { totalAmount: 3_000 });
    report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 17_100 });
    report = mergeOperatingExpensesIntoReport(report, [
      { name: 'Rent', transactions_sum: { net_debit_minus_credit: 2_000 } },
      { name: 'Salary', transactions_sum: { net_debit_minus_credit: 4_000 } },
    ]);
    report.otherIncome = [{ label: 'Interest income', amount: 500 }];
    report.otherExpenses = [{ label: 'Bank fees', amount: 200 }];

    const t = computeIncomeStatementTotals(report);
    expect(t.totalOperatingExpenses).toBe(6_000);
    expect(t.operatingIncome).toBe(8_400 - 6_000); // 2,400
    // Net income = operating income + other income − other expenses
    expect(t.netIncome).toBe(2_400 + 500 - 200); // 2,700
  });

  it('handles negative-inventory COGS from the WAC engine (uses recalculated WAC)', () => {
    // Oversell scenario surfaces as a COGS total already computed at WAC by the
    // inventory engine; the income statement must consume it verbatim.
    let report = emptyReport();
    report = mergeOrderSalesIntoReport(report, { totalAmount: 50_000 });
    report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 32_000 });
    const t = computeIncomeStatementTotals(report);
    expect(t.grossProfit).toBe(18_000);
  });

  it('net income equals the retained-earnings delta (ties to balance sheet)', () => {
    // Retained earnings change for the period must equal net income:
    //   Δretained = revenue − COGS − opex + otherIncome − otherExpenses
    let report = emptyReport();
    report = mergeOrderSalesIntoReport(report, { totalAmount: 28_500 });
    report = mergeSalesReturnIntoReport(report, { totalAmount: 3_000 });
    report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 17_100 });
    report = mergeOperatingExpensesIntoReport(report, [
      { name: 'Rent', transactions_sum: { net_debit_minus_credit: 6_000 } },
    ]);
    report.otherIncome = [{ label: 'Interest', amount: 500 }];
    report.otherExpenses = [{ label: 'Fees', amount: 200 }];

    const t = computeIncomeStatementTotals(report);
    const retainedEarningsDelta =
      t.totalRevenue - t.totalCOGS - t.totalOperatingExpenses + t.totalOtherIncome - t.totalOtherExpenses;
    expect(t.netIncome).toBe(retainedEarningsDelta);
  });

  it('normalizes a backend payload and never carries purchases through to COGS', () => {
    const normalized = normalizeIncomeStatementPayload({
      data: {
        revenue: [{ label: 'Sales', amount: 100 }],
        cost_of_goods_sold: [{ label: 'Purchases', amount: 80 }],
      },
    });
    // Backend may still send Purchases; the COGS merge step is what enforces the rule.
    const cleaned = mergeCostOfGoodsIntoReport(normalized, { costOfGoodsSold: 60 });
    expect(cleaned.costOfGoodsSold).toEqual([
      { label: 'Cost of Goods Sold', amount: 60 },
    ]);
  });
});
