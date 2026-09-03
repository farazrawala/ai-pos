import { describe, expect, it } from 'vitest';
import {
  aggregateMetrics,
  aggregateVariants,
  aggregateWarehouses,
  attachTrend,
  buildInsights,
  buildTimelineBuckets,
  classifyProductHealth,
  computeLineEconomics,
  fillTimeline,
  historicalUnitCost,
  identifyVariantHighlights,
  inclusiveDayCount,
  isReturnedStatus,
  matchesProductScope,
  marginPercent,
  metricsFromProfitTotals,
  normalizeSaleLine,
  normalizeTimelinePoints,
  paginateRows,
  percentChange,
  pickTimelineMetric,
  previousEquivalentRange,
  resolveDateRange,
  returnRatePercent,
  skipLimitFromPage,
  timelineHasChartableData,
} from './productPulseEngine.js';

const line = (overrides = {}) =>
  normalizeSaleLine(
    {
      _id: 'line-1',
      product_id: { _id: 'prod-1', product_name: 'T-Shirt [Black / Medium]', sku: 'TS-BM' },
      qty: 2,
      price: 1000,
      discount: 0,
      cost_price_at_sale: 600,
      ...overrides.item,
    },
    {
      _id: 'ord-1',
      order_no: 'INV-1',
      name: 'Ali',
      warehouse_id: { _id: 'wh-1', name: 'Main' },
      createdAt: '2026-08-10T10:00:00.000Z',
      order_status: 'delivered',
      ...overrides.order,
    }
  );

describe('ProductPulse date ranges', () => {
  const now = new Date(2026, 8, 3); // 3 Sep 2026

  it('defaults to last 30 days including today', () => {
    const range = resolveDateRange('last_30_days', {}, now);
    expect(range.startDate).toBe('2026-08-05');
    expect(range.endDate).toBe('2026-09-03');
    expect(inclusiveDayCount(range.startDate, range.endDate)).toBe(30);
  });

  it('resolves today, yesterday, this month, last month, this year', () => {
    expect(resolveDateRange('today', {}, now)).toMatchObject({ startDate: '2026-09-03', endDate: '2026-09-03' });
    expect(resolveDateRange('yesterday', {}, now)).toMatchObject({ startDate: '2026-09-02', endDate: '2026-09-02' });
    expect(resolveDateRange('this_month', {}, now)).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-03' });
    expect(resolveDateRange('last_month', {}, now)).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(resolveDateRange('this_year', {}, now)).toMatchObject({ startDate: '2026-01-01', endDate: '2026-09-03' });
  });

  it('accepts a custom range', () => {
    const range = resolveDateRange('custom', { startDate: '2026-08-01', endDate: '2026-08-30' }, now);
    expect(range).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-30' });
  });

  it('previous equivalent of Aug 1–Aug 30 is Jul 2–Jul 31', () => {
    expect(previousEquivalentRange('2026-08-01', '2026-08-30')).toEqual({
      startDate: '2026-07-02',
      endDate: '2026-07-31',
    });
  });
});

describe('ProductPulse comparison percentages', () => {
  it('computes a normal increase', () => {
    expect(percentChange(1245, 1080)).toBe(15.28);
  });

  it('returns 0 when both periods are zero', () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it('does not invent a percentage when the previous period is zero', () => {
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe('ProductPulse historical COGS / profit', () => {
  it('reads Shopify-style quantity and order_date fields', () => {
    const row = normalizeSaleLine(
      { product_id: 'prod-1', units: 3, price: 100, cost_price_at_sale: 40 },
      { _id: 'ord-9', order_no: 'S-1', order_date: '2026-08-12' }
    );
    expect(row.quantity).toBe(3);
    expect(row.soldOn).toBe('2026-08-12');
  });

  it('uses cost_price_at_sale, never current product cost', () => {
    const economics = computeLineEconomics({
      qty: 2,
      price: 1000,
      discount: 100,
      cost_price_at_sale: 400,
      wholesale_price: 9999,
      average_cost: 8888,
    });
    expect(economics.unitCost).toBe(400);
    expect(economics.grossRevenue).toBe(2000);
    expect(economics.netRevenue).toBe(1900);
    expect(economics.totalCOGS).toBe(800);
    expect(economics.grossProfit).toBe(1100);
    expect(economics.missingHistoricalCost).toBe(false);
  });

  it('does not fall back to today cost when historical cost is missing', () => {
    const cost = historicalUnitCost({ wholesale_price: 250, average_cost: 250 });
    expect(cost).toEqual({ unitCost: 0, missingHistoricalCost: true });
  });

  it('handles negative profit and zero profit', () => {
    const loss = computeLineEconomics({ qty: 1, price: 100, cost_price_at_sale: 150 });
    expect(loss.grossProfit).toBe(-50);
    expect(loss.profitMargin).toBe(-50);

    const zero = computeLineEconomics({ qty: 1, price: 100, cost_price_at_sale: 100 });
    expect(zero.grossProfit).toBe(0);
    expect(zero.profitMargin).toBe(0);
  });

  it('handles zero net revenue margin without dividing by zero', () => {
    expect(marginPercent(0, 0)).toBeNull();
  });
});

describe('ProductPulse returns', () => {
  it('recognises existing return / refund statuses', () => {
    expect(isReturnedStatus('return')).toBe(true);
    expect(isReturnedStatus('return_received')).toBe(true);
    expect(isReturnedStatus('refunded')).toBe(true);
    expect(isReturnedStatus('delivered')).toBe(false);
  });

  it('computes return rate independently, including 100% when only returns exist', () => {
    expect(returnRatePercent(14.2, 100)).toBe(14.2);
    expect(returnRatePercent(5, 0)).toBe(100);
    expect(returnRatePercent(0, 0)).toBe(0);
  });
});

describe('ProductPulse products without variants', () => {
  it('aggregates first/last sale, units, orders, revenue, COGS, profit', () => {
    const rows = [
      line({ item: { qty: 3, price: 500, cost_price_at_sale: 200 }, order: { createdAt: '2026-08-01T09:00:00.000Z', _id: 'a' } }),
      line({ item: { qty: 1, price: 500, cost_price_at_sale: 200 }, order: { createdAt: '2026-08-20T09:00:00.000Z', _id: 'b' } }),
    ];
    const metrics = aggregateMetrics(rows, { periodDays: 30, now: new Date('2026-08-30T00:00:00.000Z') });
    expect(metrics.unitsSold).toBe(4);
    expect(metrics.ordersCount).toBe(2);
    expect(metrics.grossRevenue).toBe(2000);
    expect(metrics.totalCOGS).toBe(800);
    expect(metrics.grossProfit).toBe(1200);
    expect(metrics.profitMargin).toBe(60);
    expect(metrics.firstSoldAt).toBe('2026-08-01T09:00:00.000Z');
    expect(metrics.lastSoldAt).toBe('2026-08-20T09:00:00.000Z');
  });

  it('shows an empty product with no sales', () => {
    const metrics = aggregateMetrics([], { periodDays: 30 });
    expect(metrics.unitsSold).toBe(0);
    expect(metrics.ordersCount).toBe(0);
    expect(metrics.firstSoldAt).toBeNull();
    expect(classifyProductHealth(metrics).status).toBe('SLOW');
  });
});

describe('ProductPulse products with variants', () => {
  const blackSmall = (qty, extras = {}) =>
    normalizeSaleLine(
      {
        product_id: { _id: 'var-bs', product_name: 'T-Shirt [Black / Small]', sku: 'TS-BS' },
        qty,
        price: 500,
        cost_price_at_sale: 300,
        ...extras.item,
      },
      { _id: extras.orderId || `o-${qty}`, order_no: 'X', createdAt: extras.createdAt || '2026-08-10T00:00:00.000Z', warehouse_id: extras.warehouse }
    );

  const blackMedium = (qty, extras = {}) =>
    normalizeSaleLine(
      {
        product_id: { _id: 'var-bm', product_name: 'T-Shirt [Black / Medium]', sku: 'TS-BM' },
        qty,
        price: 500,
        cost_price_at_sale: 300,
        ...extras.item,
      },
      { _id: extras.orderId || `o-m-${qty}`, order_no: 'Y', createdAt: extras.createdAt || '2026-08-12T00:00:00.000Z' }
    );

  it('All variants aggregates every child', () => {
    const metrics = aggregateMetrics([blackSmall(2), blackMedium(4)], { periodDays: 30 });
    expect(metrics.unitsSold).toBe(6);
    expect(metrics.grossRevenue).toBe(3000);
  });

  it('individual variant filtering keeps only that child', () => {
    const rows = [blackSmall(2), blackMedium(4)];
    const filtered = rows.filter((row) => matchesProductScope(row, { variantId: 'var-bm' }));
    const metrics = aggregateMetrics(filtered, { periodDays: 30 });
    expect(metrics.unitsSold).toBe(4);
    expect(filtered.every((row) => row.productId === 'var-bm')).toBe(true);
  });

  it('variant performance identifies best seller, most profitable, highest margin, highest return', () => {
    const rows = [
      blackSmall(120),
      blackMedium(240),
      normalizeSaleLine(
        {
          product_id: { _id: 'var-bl', product_name: 'T-Shirt [Black / Large]', sku: 'TS-BL' },
          qty: 10,
          price: 500,
          cost_price_at_sale: 480,
        },
        { _id: 'o-l', createdAt: '2026-08-13T00:00:00.000Z', order_status: 'return' }
      ),
    ];
    const variants = [
      { id: 'var-bs', name: 'Black / Small', sku: 'TS-BS' },
      { id: 'var-bm', name: 'Black / Medium', sku: 'TS-BM' },
      { id: 'var-bl', name: 'Black / Large', sku: 'TS-BL' },
    ];
    const highlighted = identifyVariantHighlights(aggregateVariants(rows, variants));
    expect(highlighted.bestSellingVariant.variantId).toBe('var-bm');
    expect(highlighted.mostProfitableVariant.variantId).toBe('var-bm');
    expect(highlighted.highestReturnVariant.variantId).toBe('var-bl');
    expect(highlighted.highestReturnVariant.returnRate).toBe(100);
  });
});

describe('ProductPulse warehouse / date / timeline / pagination', () => {
  it('filters by warehouse and date range', () => {
    const rows = [
      line({ order: { warehouse_id: { _id: 'wh-1', name: 'Main' }, createdAt: '2026-08-10T00:00:00.000Z' } }),
      line({
        item: { qty: 9 },
        order: { _id: 'ord-2', warehouse_id: { _id: 'wh-2', name: 'Outlet' }, createdAt: '2026-07-01T00:00:00.000Z' },
      }),
    ];
    const scoped = rows.filter(
      (row) =>
        matchesProductScope(row, { warehouseId: 'wh-1' }) && row.soldOn >= '2026-08-01' && row.soldOn <= '2026-08-31'
    );
    expect(scoped).toHaveLength(1);
    expect(aggregateWarehouses(rows, [{ _id: 'wh-1', name: 'Main' }, { _id: 'wh-2', name: 'Outlet' }])).toHaveLength(2);
  });

  it('builds a daily timeline for the selected range only', () => {
    const buckets = buildTimelineBuckets('2026-08-01', '2026-08-03', 'daily');
    expect(buckets.map((b) => b.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    const filled = fillTimeline(buckets, [
      line({ item: { qty: 2 }, order: { createdAt: '2026-08-02T12:00:00.000Z' } }),
    ]);
    expect(filled[0].unitsSold).toBe(0);
    expect(filled[1].unitsSold).toBe(2);
    expect(filled[1].profit).toBe(800);
  });

  it('normalizes dedicated timeline aliases and detects chartable revenue', () => {
    const points = normalizeTimelinePoints(
      [{ period: '2026-08', units: 0, revenue: 15945, profit: 3345, orders: 23 }],
      'monthly'
    );
    expect(points[0]).toMatchObject({
      date: '2026-08',
      unitsSold: 0,
      netRevenue: 15945,
      profit: 3345,
      orders: 23,
    });
    expect(timelineHasChartableData(points, 'unitsSold')).toBe(false);
    expect(timelineHasChartableData(points)).toBe(true);
    expect(pickTimelineMetric(points, 'unitsSold')).toBe('netRevenue');
  });

  it('still charts undated sale lines instead of dropping them', () => {
    const buckets = buildTimelineBuckets('2026-08-01', '2026-08-03', 'daily');
    const filled = fillTimeline(buckets, [
      line({ item: { qty: 2 }, order: { createdAt: null, date: null } }),
    ]);
    expect(filled.reduce((sum, row) => sum + row.unitsSold, 0)).toBe(2);
    expect(timelineHasChartableData(filled)).toBe(true);
  });

  it('paginates sales history with skip/limit', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    const page2 = paginateRows(rows, { page: 2, limit: 10 });
    expect(page2.data[0].id).toBe(11);
    expect(page2.total).toBe(30);
    expect(page2.totalPages).toBe(3);
    expect(skipLimitFromPage(3, 25)).toEqual({ skip: 50, limit: 25, page: 3 });
  });
});

describe('ProductPulse previous-period attach + health + insights', () => {
  it('attaches comparison fields and handles a zero previous period', () => {
    const current = metricsFromProfitTotals({ subtotal: 1000, profit: 400 }, { unitsSold: 10, periodDays: 30 });
    const previous = metricsFromProfitTotals({ subtotal: 0, profit: 0 }, { unitsSold: 0, periodDays: 30 });
    const withTrend = attachTrend(current, previous);
    expect(withTrend.trend.previousUnitsSold).toBe(0);
    expect(withTrend.trend.unitsSoldChangePercent).toBeNull();
    expect(withTrend.trend.revenueChangePercent).toBeNull();
  });

  it('classifies loss-making, slow, watch, and strong products', () => {
    expect(classifyProductHealth({ ...metricsFromProfitTotals({ subtotal: 100, profit: -20 }, { unitsSold: 5 }), grossProfit: -20 }).status).toBe(
      'LOSS_MAKING'
    );
    expect(classifyProductHealth(aggregateMetrics([], { periodDays: 30 })).status).toBe('SLOW');
    const declining = attachTrend(
      metricsFromProfitTotals({ subtotal: 100, profit: 40 }, { unitsSold: 10 }),
      metricsFromProfitTotals({ subtotal: 200, profit: 80 }, { unitsSold: 20 })
    );
    expect(classifyProductHealth(declining).status).toBe('WATCH');
  });

  it('only emits insights supported by data', () => {
    const metrics = attachTrend(
      {
        ...metricsFromProfitTotals({ subtotal: 425000, profit: 425000 }, { unitsSold: 20, periodDays: 30 }),
        daysSinceLastSale: 18,
        returnRate: 0,
      },
      metricsFromProfitTotals({ subtotal: 300000, profit: 200000 }, { unitsSold: 16 })
    );
    const insights = buildInsights({
      metrics,
      highlights: {
        bestSellingVariant: { variantName: 'Black / Medium', unitsSold: 12 },
        highestReturnVariant: { variantName: 'Black / Large', returnRate: 14.2 },
      },
    });
    const texts = insights.map((i) => i.text).join('\n');
    expect(texts).toContain('425,000');
    expect(texts).toContain('Black / Medium is the best-selling variant');
    expect(texts).toContain('14.2% return rate');
    expect(texts).toContain('last 18 days');
    expect(insights.every((i) => i.text && i.id)).toBe(true);
  });
});

describe('ProductPulse returned-only and cancelled lines', () => {
  it('product with only returned orders still reports return rate', () => {
    const returned = line({
      item: { qty: 4, price: 100, cost_price_at_sale: 40 },
      order: { order_status: 'return', _id: 'ret-1' },
    });
    expect(returned.returned).toBe(true);
    const metrics = aggregateMetrics([returned], { periodDays: 30 });
    expect(metrics.returnedUnits).toBe(4);
    expect(metrics.returnRate).toBe(100);
  });

  it('cancelled lines are excluded from product scope', () => {
    const cancelled = line({ order: { order_status: 'cancelled' } });
    expect(matchesProductScope(cancelled, { productIds: ['prod-1'] })).toBe(false);
  });
});
