import { describe, expect, it } from 'vitest';
import {
  mergeProfitSummaries,
  sumOrderDiscounts,
  buildProfitByOrderExportRows,
  discountPctForExport,
  getProfitByOrderExportColumns,
  applyDiscountsToOrderProfitGroups,
} from './profitReportAPI.js';

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

describe('profit by order export', () => {
  it('adds a TOTAL row with summed money and items', () => {
    const rows = buildProfitByOrderExportRows([
      {
        orderNo: 'ORD-1',
        orderId: 'a',
        itemCount: 2,
        itemsSubtotal: 100,
        discount: 10,
        orderProfit: 20,
        marginPct: 20,
      },
      {
        orderNo: 'ORD-2',
        orderId: 'b',
        itemCount: 3,
        itemsSubtotal: 50,
        discount: 5,
        orderProfit: 10,
        marginPct: 20,
      },
    ]);
    expect(rows).toHaveLength(3);
    const total = rows[2];
    expect(total.orderNo).toBe('TOTAL');
    expect(total.itemCount).toBe(5);
    expect(total.itemsSubtotal).toBe(150);
    expect(total.discount).toBe(15);
    expect(total.orderProfit).toBe(30);
    expect(total.netProfit).toBe(15);
    expect(total.marginPct).toBeCloseTo(10);
  });

  it('formats discount percent and export columns', () => {
    expect(discountPctForExport(10, 100)).toBe('10.0');
    expect(discountPctForExport(0, 100)).toBe('');
    const columns = getProfitByOrderExportColumns(() => '9-8-2026');
    const row = {
      orderNo: 'ORD-1',
      orderId: 'abc',
      itemCount: 2,
      itemsSubtotal: 100,
      discount: 10,
      orderProfit: 25.5,
      netProfit: 15.5,
      marginPct: 15.5,
      orderDate: '2026-09-08',
    };
    expect(columns.find((c) => c.key === 'discountPct').value(row)).toBe('10.0');
    expect(columns.find((c) => c.key === 'orderProfit').value(row)).toBe('25.50');
    expect(columns.find((c) => c.key === 'netProfit').value(row)).toBe('15.50');
    expect(columns.find((c) => c.key === 'orderDate').value(row)).toBe('9-8-2026');
  });
});

describe('applyDiscountsToOrderProfitGroups', () => {
  it('keeps gross order profit and adds net after discount', () => {
    const [group] = applyDiscountsToOrderProfitGroups(
      [
        {
          orderId: 'a',
          orderNo: 'ORD-1',
          orderProfit: 338.44,
          orderSubtotal: 4528,
          discount: 0,
        },
      ],
      [{ _id: 'a', discount: 452.8 }]
    );
    expect(group.orderProfit).toBeCloseTo(338.44);
    expect(group.discount).toBeCloseTo(452.8);
    expect(group.netProfit).toBeCloseTo(-114.36);
  });
});
