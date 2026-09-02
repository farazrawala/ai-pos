import { describe, expect, it } from 'vitest';
import {
  aggregateOverviewFromOrders,
  aggregatePaymentPerformance,
  aggregateTopCustomers,
  aggregateTopProducts,
  attachOrderTrend,
  averageOrderValue,
  buildOrderInsights,
  classifyPaymentStatus,
  computeOrderEconomics,
  detectIgnoredStatusFilter,
  isCancelledOnlyStatus,
  isDeliveredStatus,
  isFailedStatus,
  isPendingStatus,
  isQualifyingStatus,
  isReturnedStatus,
  matchesOrderFilters,
  metricsFromServerTotals,
  normalizeOrderRow,
  percentChange,
  previousEquivalentRange,
  ratePercent,
  resolveDateRange,
  skipLimitFromPage,
  statusDistributionFromCounts,
} from './orderPulseEngine.js';

const order = (overrides = {}) =>
  normalizeOrderRow({
    _id: 'ord-1',
    order_no: 'ORD-1045',
    name: 'Ahmed Khan',
    customer_id: { _id: 'cust-1', name: 'Ahmed Khan' },
    warehouse_id: { _id: 'wh-1', name: 'Main Warehouse' },
    payment_method_accounts_id: { _id: 'pay-cash', name: 'Cash' },
    payment_method_id: 'pay-cash',
    amount_paid: 25000,
    remaining_amount: 0,
    total_amount: 25000,
    discount: 0,
    order_status: 'delivered',
    order_type: 'offline',
    createdAt: '2026-08-10T10:00:00.000Z',
    order_items: [
      {
        _id: 'line-1',
        product_id: { _id: 'prod-1', product_name: 'Wireless Earbuds', sku: 'WE-1' },
        qty: 4,
        price: 6250,
        discount: 0,
        cost_price_at_sale: 4375,
      },
    ],
    ...overrides,
  });

describe('OrderPulse date ranges', () => {
  const now = new Date(2026, 8, 3);

  it('defaults to last 30 days including today', () => {
    const range = resolveDateRange('last_30_days', {}, now);
    expect(range.startDate).toBe('2026-08-05');
    expect(range.endDate).toBe('2026-09-03');
  });

  it('previous equivalent of Aug 1–Aug 30 is Jul 2–Jul 31', () => {
    expect(previousEquivalentRange('2026-08-01', '2026-08-30')).toEqual({
      startDate: '2026-07-02',
      endDate: '2026-07-31',
    });
  });
});

describe('OrderPulse statuses (actual backend enum)', () => {
  it('maps delivered, pending, cancelled, returned, failed using existing values', () => {
    expect(isDeliveredStatus('delivered')).toBe(true);
    expect(isPendingStatus('pending')).toBe(true);
    expect(isPendingStatus('on_hold')).toBe(true);
    expect(isPendingStatus('placed')).toBe(true);
    expect(isCancelledOnlyStatus('cancelled')).toBe(true);
    expect(isReturnedStatus('return')).toBe(true);
    expect(isReturnedStatus('return_received')).toBe(true);
    expect(isFailedStatus('failed')).toBe(true);
    expect(isFailedStatus('duplicate')).toBe(true);
    expect(isQualifyingStatus('cancelled')).toBe(false);
    expect(isQualifyingStatus('draft')).toBe(false);
    expect(isQualifyingStatus('delivered')).toBe(true);
  });

  it('does not invent a shipped status — packed is the fulfillment status', () => {
    expect(isDeliveredStatus('shipped')).toBe(false);
  });
});

describe('OrderPulse payment status', () => {
  it('derives paid / partial / unpaid from amount_paid and remaining_amount', () => {
    expect(classifyPaymentStatus({ amount_paid: 100, remaining_amount: 0, total_amount: 100 })).toBe(
      'paid'
    );
    expect(classifyPaymentStatus({ amount_paid: 40, remaining_amount: 60, total_amount: 100 })).toBe(
      'partial'
    );
    expect(classifyPaymentStatus({ amount_paid: 0, remaining_amount: 100, total_amount: 100 })).toBe(
      'unpaid'
    );
  });
});

describe('OrderPulse historical COGS / profit', () => {
  it('uses cost_price_at_sale and order-level discount, never current product cost', () => {
    const economics = computeOrderEconomics({
      discount: 1000,
      wholesale_price: 9999,
      average_cost: 8888,
      order_items: [
        { qty: 2, price: 1000, discount: 0, cost_price_at_sale: 400, average_cost: 999 },
      ],
    });
    expect(economics.grossRevenue).toBe(2000);
    expect(economics.discount).toBe(1000);
    expect(economics.netRevenue).toBe(1000);
    expect(economics.totalCOGS).toBe(800);
    expect(economics.grossProfit).toBe(200);
    expect(economics.missingHistoricalCostCount).toBe(0);
  });

  it('does not fall back to today cost when historical cost is missing', () => {
    const economics = computeOrderEconomics({
      order_items: [{ qty: 1, price: 100, wholesale_price: 40, average_cost: 40 }],
    });
    expect(economics.totalCOGS).toBe(0);
    expect(economics.missingHistoricalCostCount).toBe(1);
  });

  it('subtracts refunds from net revenue', () => {
    const economics = computeOrderEconomics(
      { order_items: [{ qty: 1, price: 100, cost_price_at_sale: 40 }] },
      { refundAmount: 20 }
    );
    expect(economics.netRevenue).toBe(80);
    expect(economics.grossProfit).toBe(40);
  });
});

describe('OrderPulse overview aggregation', () => {
  it('counts total, delivered, pending, cancelled, returned and computes revenue / profit / AOV', () => {
    const rows = [
      order(),
      order({
        _id: 'ord-2',
        order_no: 'ORD-1044',
        order_status: 'pending',
        amount_paid: 0,
        remaining_amount: 12000,
        total_amount: 12000,
        order_items: [{ qty: 2, price: 6000, cost_price_at_sale: 4000 }],
      }),
      order({
        _id: 'ord-3',
        order_no: 'ORD-1043',
        order_status: 'cancelled',
        order_items: [{ qty: 1, price: 5000, cost_price_at_sale: 2000 }],
      }),
      order({
        _id: 'ord-4',
        order_no: 'ORD-1042',
        order_status: 'return',
        order_items: [{ qty: 1, price: 3000, cost_price_at_sale: 1000 }],
      }),
    ];
    const metrics = aggregateOverviewFromOrders(rows);
    expect(metrics.totalOrders).toBe(4);
    expect(metrics.deliveredOrders).toBe(1);
    expect(metrics.pendingOrders).toBe(1);
    expect(metrics.cancelledOrders).toBe(1);
    expect(metrics.returnedOrders).toBe(1);
    expect(metrics.qualifyingOrders).toBe(2);
    expect(metrics.grossRevenue).toBe(25000 + 12000 + 3000);
    expect(metrics.returnRate).toBe(25);
    expect(metrics.cancellationRate).toBe(25);
    expect(metrics.averageOrderValue).toBe(averageOrderValue(metrics.netRevenue, metrics.qualifyingOrders));
  });

  it('handles an empty dataset without NaN', () => {
    const metrics = aggregateOverviewFromOrders([]);
    expect(metrics.totalOrders).toBe(0);
    expect(metrics.netRevenue).toBe(0);
    expect(metrics.profitMargin).toBeNull();
    expect(metrics.averageOrderValue).toBe(0);
    expect(metrics.returnRate).toBe(0);
  });

  it('AOV uses qualifying orders and is zero-safe', () => {
    expect(averageOrderValue(1000, 4)).toBe(250);
    expect(averageOrderValue(1000, 0)).toBe(0);
  });
});

describe('OrderPulse rates and comparison', () => {
  it('return rate is returned orders / total orders', () => {
    expect(ratePercent(70, 4250)).toBe(1.65);
    expect(ratePercent(0, 0)).toBe(0);
    expect(ratePercent(5, 0)).toBe(100);
  });

  it('does not produce Infinity when the previous period is zero', () => {
    expect(percentChange(4250, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(4250, 3780)).toBe(12.43);
  });

  it('attaches previous-period comparison fields', () => {
    const current = metricsFromServerTotals({
      profit: { subtotal: 4250000, profit: 1320000 },
      extras: { totalOrders: 4250, averageOrderValue: 1000 },
      statusCounts: { delivered: 3020, cancelled: 180, return: 70, pending: 120 },
    });
    const previous = metricsFromServerTotals({
      profit: { subtotal: 3590000, profit: 1087000 },
      extras: { totalOrders: 3780, averageOrderValue: 950 },
      statusCounts: { delivered: 2800, cancelled: 100, return: 40 },
    });
    const withTrend = attachOrderTrend(current, previous);
    expect(withTrend.trend.previousOrders).toBe(3780);
    expect(withTrend.trend.ordersChangePercent).toBeGreaterThan(0);
    expect(withTrend.grossProfit).toBe(1320000);
    expect(withTrend.totalCOGS).toBe(2930000);
  });
});

describe('OrderPulse filters', () => {
  it('filters by warehouse, status, payment status, payment method, channel, and date', () => {
    const row = order();
    expect(matchesOrderFilters(row, { warehouseId: 'wh-1' })).toBe(true);
    expect(matchesOrderFilters(row, { warehouseId: 'wh-2' })).toBe(false);
    expect(matchesOrderFilters(row, { orderStatus: 'delivered' })).toBe(true);
    expect(matchesOrderFilters(row, { orderStatus: 'cancelled' })).toBe(false);
    expect(matchesOrderFilters(row, { paymentStatus: 'paid' })).toBe(true);
    expect(matchesOrderFilters(row, { paymentMethodId: 'pay-cash' })).toBe(true);
    expect(matchesOrderFilters(row, { orderType: 'offline' })).toBe(true);
    expect(matchesOrderFilters(row, { startDate: '2026-08-01', endDate: '2026-08-31' })).toBe(true);
    expect(matchesOrderFilters(row, { startDate: '2026-09-01', endDate: '2026-09-30' })).toBe(false);
    expect(matchesOrderFilters(row, { productId: 'prod-1' })).toBe(true);
    expect(matchesOrderFilters(row, { productId: 'prod-other' })).toBe(false);
  });
});

describe('OrderPulse products / customers / payments', () => {
  it('aggregates top products from sale lines using historical cost', () => {
    const rows = aggregateTopProducts([
      {
        productId: 'prod-1',
        productName: 'Wireless Earbuds',
        quantity: 10,
        netRevenue: 10000,
        totalCOGS: 4000,
        grossProfit: 6000,
        orderId: 'a',
      },
      {
        productId: 'prod-2',
        productName: 'Perfume',
        quantity: 4,
        netRevenue: 4000,
        totalCOGS: 1500,
        grossProfit: 2500,
        orderId: 'b',
      },
    ]);
    expect(rows[0].productName).toBe('Wireless Earbuds');
    expect(rows[0].profit).toBe(6000);
    expect(rows[0].margin).toBe(60);
  });

  it('aggregates top customers', () => {
    const rows = aggregateTopCustomers([order(), order({ _id: 'ord-9', order_no: 'ORD-9' })]);
    expect(rows[0].customerName).toBe('Ahmed Khan');
    expect(rows[0].orders).toBe(2);
  });

  it('flags COD-style payment methods with higher cancellation', () => {
    const cash = order({ payment_method_accounts_id: { _id: 'cash', name: 'Cash' } });
    const cod = order({
      _id: 'c1',
      payment_method_accounts_id: { _id: 'cod', name: 'COD' },
      order_status: 'cancelled',
    });
    const payments = aggregatePaymentPerformance([cash, cash, cod]);
    const codRow = payments.find((p) => p.paymentMethodName === 'COD');
    expect(codRow.cancellationRate).toBe(100);
  });
});

describe('OrderPulse status distribution, pagination, isolation helpers', () => {
  it('builds a status chart from counted statuses', () => {
    const rows = statusDistributionFromCounts({ pending: 120, processing: 340, delivered: 3020 });
    expect(rows.find((r) => r.status === 'delivered').count).toBe(3020);
    expect(rows.find((r) => r.status === 'pending').percent).toBeGreaterThan(0);
  });

  it('detects a backend that ignores order_status filters', () => {
    expect(detectIgnoredStatusFilter({ pending: 100, delivered: 100, cancelled: 100 }, 100)).toBe(true);
    expect(detectIgnoredStatusFilter({ pending: 10, delivered: 80, cancelled: 10 }, 100)).toBe(false);
  });

  it('paginates with skip/limit', () => {
    expect(skipLimitFromPage(3, 25)).toEqual({ skip: 50, limit: 25, page: 3 });
  });
});

describe('OrderPulse insights', () => {
  it('only emits insights backed by metrics', () => {
    const current = metricsFromServerTotals({
      profit: { subtotal: 425000, profit: 132000 },
      extras: { totalOrders: 4250 },
      statusCounts: { delivered: 4000, cancelled: 50, return: 200 },
    });
    const previous = metricsFromServerTotals({
      profit: { subtotal: 300000, profit: 90000 },
      extras: { totalOrders: 3580 },
      statusCounts: { delivered: 3400, cancelled: 40, return: 80 },
    });
    const insights = buildOrderInsights({
      metrics: attachOrderTrend(current, previous),
      topProduct: { productName: 'Wireless Earbuds', profit: 820000, revenue: 2450000 },
    });
    const texts = insights.map((i) => i.text).join('\n');
    expect(texts).toContain('Orders increased');
    expect(texts).toContain('Gross profit increased');
    expect(texts).toContain('Wireless Earbuds');
    expect(insights.every((i) => i.text && i.id)).toBe(true);
  });

  it('empty period insight', () => {
    const insights = buildOrderInsights({ metrics: aggregateOverviewFromOrders([]) });
    expect(insights.some((i) => i.id === 'empty')).toBe(true);
  });
});
