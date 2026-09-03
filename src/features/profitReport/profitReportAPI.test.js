import { describe, expect, it } from 'vitest';
import { mergeProfitSummaries, sumOrderDiscounts } from './profitReportAPI.js';

describe('sumOrderDiscounts', () => {
  it('adds invoice discounts and ignores duplicate ids', () => {
    expect(
      sumOrderDiscounts([
        { _id: 'a', discount: 100 },
        { _id: 'a', discount: 100 },
        { _id: 'b', discount_amount: '50.5' },
        { _id: 'c', extra_discount: 0 },
      ])
    ).toBe(150.5);
  });

  it('can limit the sum to one order', () => {
    expect(
      sumOrderDiscounts(
        [
          { _id: 'a', order_no: 'ORD-1', discount: 80 },
          { _id: 'b', order_no: 'ORD-2', discount: 20 },
        ],
        { orderId: 'ORD-2' }
      )
    ).toBe(20);
  });
});

describe('mergeProfitSummaries', () => {
  it('subtracts period discount from gross profit', () => {
    const merged = mergeProfitSummaries(
      { profit: 97398.41, subtotal: 1038767.29, lineCount: 2206, marginPct: 9.4 },
      null,
      null,
      12000
    );
    expect(merged.discount).toBe(12000);
    expect(merged.profitAfterDiscount).toBeCloseTo(85398.41);
    expect(merged.netMarginPct).toBeCloseTo((85398.41 / 1038767.29) * 100);
  });
});
