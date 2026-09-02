/**
 * ProductPulse analytics engine.
 *
 * Deterministic, side-effect-free calculations for product performance.
 * Historical COGS uses order-item `cost_price_at_sale` only — never current
 * product wholesale / average cost.
 */

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export const DEFAULT_DATE_PRESET = 'last_30_days';

export const TIMELINE_GRANULARITIES = ['daily', 'weekly', 'monthly'];

export const RETURN_STATUSES = new Set([
  'return',
  'returned',
  'return_received',
  'refunded',
  'refund',
]);

export const HIGH_RETURN_RATE_THRESHOLD = 10;
export const STRONG_MARGIN_THRESHOLD = 25;
export const SLOW_DAYS_SINCE_SALE = 14;
export const DECLINE_THRESHOLD_PCT = -20;
export const MARGIN_DROP_THRESHOLD = 5;

export function parsePulseNumber(raw, fallback = 0) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : fallback;
}

export function roundMoney(value) {
  const n = parsePulseNumber(value, 0);
  return Math.round(n * 100) / 100;
}

export function roundPct(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function formatYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDaysYmd(ymd, days) {
  const d = parseYmd(ymd);
  if (!d) return String(ymd || '');
  d.setDate(d.getDate() + Number(days || 0));
  return formatYmd(d);
}

export function inclusiveDayCount(startYmd, endYmd) {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Resolve a date preset to an inclusive YYYY-MM-DD range.
 * Default: Last 30 Days (including today).
 */
export function resolveDateRange(preset = DEFAULT_DATE_PRESET, custom = {}, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const id = String(preset || DEFAULT_DATE_PRESET).trim() || DEFAULT_DATE_PRESET;

  if (id === 'custom') {
    const startDate = String(custom.startDate || '').trim();
    const endDate = String(custom.endDate || '').trim();
    if (parseYmd(startDate) && parseYmd(endDate)) {
      return { preset: id, startDate, endDate };
    }
  }

  let start = today;
  let end = today;

  switch (id) {
    case 'today':
      start = today;
      end = today;
      break;
    case 'yesterday':
      start = new Date(today);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      break;
    case 'last_7_days':
      start = new Date(today);
      start.setDate(start.getDate() - 6);
      break;
    case 'last_90_days':
      start = new Date(today);
      start.setDate(start.getDate() - 89);
      break;
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'last_month': {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    }
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case 'last_30_days':
    default:
      start = new Date(today);
      start.setDate(start.getDate() - 29);
      break;
  }

  return { preset: id === 'custom' ? DEFAULT_DATE_PRESET : id, startDate: formatYmd(start), endDate: formatYmd(end) };
}

/**
 * Previous period of equal length immediately before the selected range.
 * Aug 1–Aug 30 → Jul 2–Jul 31.
 */
export function previousEquivalentRange(startYmd, endYmd) {
  const days = inclusiveDayCount(startYmd, endYmd);
  if (days <= 0) {
    return { startDate: startYmd, endDate: endYmd };
  }
  const prevEnd = addDaysYmd(startYmd, -1);
  const prevStart = addDaysYmd(prevEnd, -(days - 1));
  return { startDate: prevStart, endDate: prevEnd };
}

/**
 * Percent change. When previous is 0:
 * - current 0 → 0
 * - current > 0 → null (undefined / infinite growth — caller should not print a fake %)
 */
export function percentChange(current, previous) {
  const cur = parsePulseNumber(current, 0);
  const prev = parsePulseNumber(previous, 0);
  if (prev === 0) {
    if (cur === 0) return 0;
    return null;
  }
  return roundPct(((cur - prev) / Math.abs(prev)) * 100);
}

export function marginPercent(profit, netRevenue) {
  const net = parsePulseNumber(netRevenue, 0);
  if (net === 0) return null;
  return roundPct((parsePulseNumber(profit, 0) / net) * 100);
}

export function returnRatePercent(returnedUnits, unitsSold) {
  const sold = parsePulseNumber(unitsSold, 0);
  if (sold === 0) return parsePulseNumber(returnedUnits, 0) > 0 ? 100 : 0;
  return roundPct((parsePulseNumber(returnedUnits, 0) / sold) * 100);
}

export function refId(ref) {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    const id = ref._id ?? ref.id ?? ref.$oid;
    return id != null ? String(id).trim() : '';
  }
  return String(ref).trim();
}

export function isReturnedStatus(status) {
  const s = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!s) return false;
  if (RETURN_STATUSES.has(s)) return true;
  return s.includes('return') || s.includes('refund');
}

export function isCancelledStatus(status) {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  return s === 'cancelled' || s === 'canceled' || s === 'failed' || s === 'duplicate';
}

/**
 * Historical unit cost from the order line. Never falls back to today's product cost.
 * Missing cost is recorded so the UI can flag incomplete history instead of inventing it.
 */
export function historicalUnitCost(item) {
  if (!item || typeof item !== 'object') {
    return { unitCost: 0, missingHistoricalCost: true };
  }
  const raw =
    item.cost_price_at_sale ??
    item.costPriceAtSale ??
    item.cost_at_sale ??
    item.historical_unit_cost ??
    item.unit_cost_at_sale;
  if (raw == null || raw === '') {
    return { unitCost: 0, missingHistoricalCost: true };
  }
  const unitCost = parsePulseNumber(raw, NaN);
  if (!Number.isFinite(unitCost)) {
    return { unitCost: 0, missingHistoricalCost: true };
  }
  return { unitCost, missingHistoricalCost: false };
}

export function lineQuantity(item) {
  return parsePulseNumber(item?.qty ?? item?.quantity ?? item?.qty_ordered, 0);
}

export function lineUnitPrice(item) {
  return parsePulseNumber(item?.price ?? item?.unit_price ?? item?.unitPrice ?? item?.selling_price, 0);
}

export function lineDiscount(item) {
  return parsePulseNumber(
    item?.discount ?? item?.discount_amount ?? item?.line_discount ?? item?.discountAmount,
    0
  );
}

/**
 * Economics for one sale line using historical cost at sale.
 *
 * grossRevenue = qty × unitSellingPrice
 * netRevenue   = grossRevenue − line discount  (refunds applied at aggregate)
 * COGS         = qty × historicalUnitCost
 * grossProfit  = netRevenue − COGS
 */
export function computeLineEconomics(item) {
  const qty = lineQuantity(item);
  const unitSellingPrice = lineUnitPrice(item);
  const discount = lineDiscount(item);
  const { unitCost, missingHistoricalCost } = historicalUnitCost(item);
  const signedQty = qty;
  const absQty = Math.abs(signedQty);
  const grossRevenue = roundMoney(signedQty * unitSellingPrice);
  const netRevenue = roundMoney(grossRevenue - discount);
  const totalCOGS = roundMoney(signedQty * unitCost);
  const grossProfit = roundMoney(netRevenue - totalCOGS);
  const profitMargin = marginPercent(grossProfit, netRevenue);

  return {
    quantity: signedQty,
    absQuantity: absQty,
    unitSellingPrice,
    discount,
    netSellingPrice: absQty > 0 ? roundMoney(netRevenue / signedQty) : unitSellingPrice,
    unitCost,
    missingHistoricalCost,
    grossRevenue,
    netRevenue,
    totalCOGS,
    grossProfit,
    profitMargin,
  };
}

export function ymdFromDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatYmd(d);
}

export function isDateInRange(ymd, startYmd, endYmd) {
  if (!ymd) return false;
  if (startYmd && ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}

/**
 * Normalize one order_item (+ parent order) into a ProductPulse sale row.
 */
export function normalizeSaleLine(item, order = {}) {
  if (!item || typeof item !== 'object') return null;

  const economics = computeLineEconomics(item);
  const productRef = item.product_id ?? item.productId;
  const product =
    productRef && typeof productRef === 'object' && !Array.isArray(productRef) ? productRef : null;
  const productId = refId(product) || refId(productRef) || refId(item.product_id);
  const parentProductId = refId(
    item.parent_product_id ?? item.parentProductId ?? product?.parent_product_id
  );
  const warehouseRef = item.warehouse_id ?? item.warehouseId ?? order.warehouse_id ?? order.warehouseId;
  const warehouse =
    warehouseRef && typeof warehouseRef === 'object' ? warehouseRef : null;
  const customerRef = order.customer_id ?? order.customerId ?? order.customer;
  const customer =
    customerRef && typeof customerRef === 'object' ? customerRef : null;
  const status = String(
    item.status ?? item.line_status ?? order.order_status ?? order.status ?? ''
  ).trim();
  const soldAt = item.createdAt ?? item.created_at ?? order.createdAt ?? order.created_at ?? order.date;
  const returned = isReturnedStatus(status) || parsePulseNumber(item.returned_qty ?? item.return_qty, 0) > 0;
  const cancelled = isCancelledStatus(status);

  return {
    lineId: refId(item._id ?? item.id ?? item.order_item_id) || null,
    orderId: refId(order._id ?? order.id ?? item.order_id ?? item.orderId) || null,
    orderNo: String(order.order_no ?? order.orderNo ?? item.order_no ?? '').trim() || '—',
    productId,
    parentProductId,
    variantId: productId,
    variantName: String(
      item.variant_name ??
        item.variation_name ??
        product?.product_name ??
        item.product_name ??
        item.name ??
        ''
    ).trim(),
    sku: String(item.sku ?? product?.sku ?? product?.product_code ?? item.product_code ?? '').trim(),
    barcode: String(item.barcode ?? product?.barcode ?? '').trim(),
    customerName: String(
      order.name ??
        order.customer_name ??
        customer?.name ??
        customer?.customer_name ??
        ''
    ).trim(),
    warehouseId: refId(warehouse) || refId(warehouseRef),
    warehouseName: String(
      warehouse?.name ?? warehouse?.warehouse_name ?? order.warehouse_name ?? ''
    ).trim(),
    soldAt: soldAt ? String(soldAt) : null,
    soldOn: ymdFromDate(soldAt),
    status,
    returned,
    cancelled,
    returnedUnits: returned
      ? Math.abs(parsePulseNumber(item.returned_qty ?? item.return_qty, economics.absQuantity))
      : parsePulseNumber(item.returned_qty ?? item.return_qty, 0),
    ...economics,
  };
}

export function matchesProductScope(line, { productIds, variantId, warehouseId } = {}) {
  if (!line) return false;
  if (line.cancelled) return false;
  const ids = Array.isArray(productIds)
    ? productIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (ids.length) {
    const linePid = String(line.productId || '').trim();
    const parentPid = String(line.parentProductId || '').trim();
    if (!ids.includes(linePid) && !ids.includes(parentPid)) return false;
  }
  if (variantId) {
    if (String(line.productId || '') !== String(variantId)) return false;
  }
  if (warehouseId) {
    if (String(line.warehouseId || '') !== String(warehouseId)) return false;
  }
  return true;
}

export function emptyMetrics() {
  return {
    firstSoldAt: null,
    lastSoldAt: null,
    ordersCount: 0,
    unitsSold: 0,
    grossRevenue: 0,
    discount: 0,
    refundAmount: 0,
    netRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    profitMargin: null,
    returnedUnits: 0,
    returnRate: 0,
    salesVelocity: 0,
    averageDaysBetweenSales: null,
    daysSinceLastSale: null,
    missingHistoricalCostCount: 0,
    trend: {
      units: 0,
      revenue: 0,
      profit: 0,
      unitsSoldChangePercent: null,
      revenueChangePercent: null,
      profitChangePercent: null,
      marginChange: null,
      previousUnitsSold: 0,
      previousRevenue: 0,
      previousProfit: 0,
      previousMargin: null,
    },
  };
}

export function salesVelocity(unitsSold, periodDays) {
  const days = Number(periodDays) || 0;
  if (days <= 0) return 0;
  return roundPct(parsePulseNumber(unitsSold, 0) / days) ?? 0;
}

export function averageDaysBetweenSales(sortedSoldOn, periodDays) {
  const days = Array.isArray(sortedSoldOn) ? sortedSoldOn.filter(Boolean) : [];
  if (days.length >= 2) {
    const first = parseYmd(days[0]);
    const last = parseYmd(days[days.length - 1]);
    if (first && last) {
      const span = inclusiveDayCount(days[0], days[days.length - 1]);
      if (span > 1) return roundPct((span - 1) / (days.length - 1));
    }
  }
  if (days.length === 1 && periodDays > 0) return roundPct(periodDays);
  return null;
}

/**
 * Aggregate sale lines for the selected period.
 * `returnedUnits` / `refundAmount` may be supplied from the sales-return module
 * so we do not invent a second return system.
 */
export function aggregateMetrics(lines, options = {}) {
  const list = Array.isArray(lines) ? lines : [];
  const periodDays = Number(options.periodDays) || 0;
  const now = options.now instanceof Date ? options.now : new Date();
  const todayYmd = formatYmd(now);

  const extraReturnedUnits = parsePulseNumber(options.returnedUnits, 0);
  const extraRefundAmount = parsePulseNumber(options.refundAmount, 0);

  let unitsSold = 0;
  let grossRevenue = 0;
  let discount = 0;
  let refundAmount = extraRefundAmount;
  let netRevenue = 0;
  let totalCOGS = 0;
  let returnedFromLines = 0;
  let missingHistoricalCostCount = 0;
  let firstSoldAt = null;
  let lastSoldAt = null;
  const orderIds = new Set();
  const saleDays = [];

  for (const line of list) {
    if (!line || line.cancelled) continue;
    unitsSold += line.quantity || 0;
    grossRevenue += line.grossRevenue || 0;
    discount += line.discount || 0;
    netRevenue += line.netRevenue || 0;
    totalCOGS += line.totalCOGS || 0;
    if (line.missingHistoricalCost) missingHistoricalCostCount += 1;
    if (line.returned) {
      returnedFromLines += line.returnedUnits || line.absQuantity || 0;
      refundAmount += Math.abs(line.netRevenue || 0);
    }
    if (line.orderId) orderIds.add(String(line.orderId));
    else if (line.orderNo && line.orderNo !== '—') orderIds.add(`no:${line.orderNo}`);
    if (line.soldAt) {
      if (!firstSoldAt || String(line.soldAt) < String(firstSoldAt)) firstSoldAt = line.soldAt;
      if (!lastSoldAt || String(line.soldAt) > String(lastSoldAt)) lastSoldAt = line.soldAt;
    }
    if (line.soldOn) saleDays.push(line.soldOn);
  }

  const returnedUnits = extraReturnedUnits > 0 ? extraReturnedUnits : returnedFromLines;
  const uniqueDays = [...new Set(saleDays)].sort();
  const lastSoldOn = lastSoldAt ? ymdFromDate(lastSoldAt) : uniqueDays[uniqueDays.length - 1] || null;
  const daysSinceLastSale = lastSoldOn ? Math.max(0, inclusiveDayCount(lastSoldOn, todayYmd) - 1) : null;

  const netAfterRefunds = roundMoney(netRevenue - (extraRefundAmount > 0 ? extraRefundAmount : 0));
  const grossProfit = roundMoney(netAfterRefunds - totalCOGS);

  return {
    firstSoldAt,
    lastSoldAt,
    ordersCount: orderIds.size,
    unitsSold: roundMoney(unitsSold),
    grossRevenue: roundMoney(grossRevenue),
    discount: roundMoney(discount),
    refundAmount: roundMoney(refundAmount),
    netRevenue: netAfterRefunds,
    totalCOGS: roundMoney(totalCOGS),
    grossProfit,
    profitMargin: marginPercent(grossProfit, netAfterRefunds),
    returnedUnits: roundMoney(returnedUnits),
    returnRate: returnRatePercent(returnedUnits, unitsSold),
    salesVelocity: salesVelocity(unitsSold, periodDays),
    averageDaysBetweenSales: averageDaysBetweenSales(uniqueDays, periodDays),
    daysSinceLastSale,
    missingHistoricalCostCount,
    trend: emptyMetrics().trend,
  };
}

export function attachTrend(currentMetrics, previousMetrics) {
  const current = currentMetrics && typeof currentMetrics === 'object' ? currentMetrics : emptyMetrics();
  const previous = previousMetrics && typeof previousMetrics === 'object' ? previousMetrics : emptyMetrics();
  const marginChange =
    current.profitMargin != null && previous.profitMargin != null
      ? roundPct(current.profitMargin - previous.profitMargin)
      : null;

  return {
    ...current,
    trend: {
      units: current.unitsSold,
      revenue: current.netRevenue,
      profit: current.grossProfit,
      unitsSoldChangePercent: percentChange(current.unitsSold, previous.unitsSold),
      revenueChangePercent: percentChange(current.netRevenue, previous.netRevenue),
      profitChangePercent: percentChange(current.grossProfit, previous.grossProfit),
      marginChange,
      previousUnitsSold: previous.unitsSold,
      previousRevenue: previous.netRevenue,
      previousProfit: previous.grossProfit,
      previousMargin: previous.profitMargin,
    },
  };
}

export function metricsFromProfitTotals(totals = {}, extras = {}) {
  const subtotal = roundMoney(totals.subtotal ?? totals.grossRevenue ?? 0);
  const profit = roundMoney(totals.profit ?? totals.grossProfit ?? 0);
  const discount = roundMoney(extras.discount ?? totals.discount ?? 0);
  const refundAmount = roundMoney(extras.refundAmount ?? totals.refundAmount ?? 0);
  const unitsSold = roundMoney(extras.unitsSold ?? totals.unitsSold ?? totals.total_qty ?? 0);
  const returnedUnits = roundMoney(extras.returnedUnits ?? totals.returnedUnits ?? 0);
  const explicitCogs = totals.totalCOGS ?? totals.cost_of_goods_sold ?? totals.cogs;
  const totalCOGS =
    explicitCogs != null && Number.isFinite(Number(explicitCogs))
      ? roundMoney(explicitCogs)
      : roundMoney(subtotal - profit);
  const netRevenue = roundMoney(subtotal - discount - refundAmount);
  const grossProfit = roundMoney(netRevenue - totalCOGS);
  const periodDays = Number(extras.periodDays) || 0;

  return {
    ...emptyMetrics(),
    firstSoldAt: extras.firstSoldAt ?? totals.firstSoldAt ?? totals.first_sold_at ?? null,
    lastSoldAt: extras.lastSoldAt ?? totals.lastSoldAt ?? totals.last_sold_at ?? null,
    ordersCount: Number(extras.ordersCount ?? totals.ordersCount ?? totals.order_count ?? 0) || 0,
    unitsSold,
    grossRevenue: subtotal,
    discount,
    refundAmount,
    netRevenue,
    totalCOGS,
    grossProfit,
    profitMargin: marginPercent(grossProfit, netRevenue),
    returnedUnits,
    returnRate: returnRatePercent(returnedUnits, unitsSold),
    salesVelocity: salesVelocity(unitsSold, periodDays),
    averageDaysBetweenSales: extras.averageDaysBetweenSales ?? null,
    daysSinceLastSale: extras.daysSinceLastSale ?? null,
    missingHistoricalCostCount: Number(extras.missingHistoricalCostCount) || 0,
  };
}

function timelineBucketKey(ymd, granularity) {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  if (granularity === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (granularity === 'weekly') {
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    return formatYmd(monday);
  }
  return ymd;
}

function timelineLabel(key, granularity) {
  if (granularity === 'monthly') {
    const [y, m] = String(key).split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  if (granularity === 'weekly') {
    return `Week of ${key}`;
  }
  return key;
}

export function buildTimelineBuckets(startYmd, endYmd, granularity = 'daily') {
  const g = TIMELINE_GRANULARITIES.includes(granularity) ? granularity : 'daily';
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return [];

  const keys = [];
  const seen = new Set();
  const cursor = new Date(start);
  while (cursor <= end) {
    const ymd = formatYmd(cursor);
    const key = timelineBucketKey(ymd, g);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
    if (keys.length > 366) break;
  }
  return keys.map((date) => ({
    date,
    label: timelineLabel(date, g),
    orders: 0,
    unitsSold: 0,
    grossRevenue: 0,
    discount: 0,
    netRevenue: 0,
    COGS: 0,
    profit: 0,
    profitMargin: null,
    returnedUnits: 0,
  }));
}

export function fillTimeline(buckets, lines) {
  const index = new Map((Array.isArray(buckets) ? buckets : []).map((b, i) => [b.date, i]));
  const rows = (Array.isArray(buckets) ? buckets : []).map((b) => ({ ...b, _orderIds: new Set() }));

  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || line.cancelled || !line.soldOn) continue;
    let key = line.soldOn;
    if (!index.has(key)) {
      const monthly = key.slice(0, 7);
      if (index.has(monthly)) key = monthly;
      else {
        const d = parseYmd(line.soldOn);
        if (!d) continue;
        const day = d.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        const weekKey = formatYmd(monday);
        if (index.has(weekKey)) key = weekKey;
        else continue;
      }
    }
    const row = rows[index.get(key)];
    if (!row) continue;
    row.unitsSold += line.quantity || 0;
    row.grossRevenue += line.grossRevenue || 0;
    row.discount += line.discount || 0;
    row.netRevenue += line.netRevenue || 0;
    row.COGS += line.totalCOGS || 0;
    row.profit += line.grossProfit || 0;
    if (line.returned) row.returnedUnits += line.returnedUnits || line.absQuantity || 0;
    if (line.orderId) row._orderIds.add(String(line.orderId));
    else if (line.orderNo && line.orderNo !== '—') row._orderIds.add(`no:${line.orderNo}`);
  }

  return rows.map((row) => {
    const { _orderIds, ...rest } = row;
    return {
      ...rest,
      orders: _orderIds.size,
      unitsSold: roundMoney(rest.unitsSold),
      grossRevenue: roundMoney(rest.grossRevenue),
      discount: roundMoney(rest.discount),
      netRevenue: roundMoney(rest.netRevenue),
      COGS: roundMoney(rest.COGS),
      profit: roundMoney(rest.profit),
      profitMargin: marginPercent(rest.profit, rest.netRevenue),
      returnedUnits: roundMoney(rest.returnedUnits),
    };
  });
}

export function emptyVariantRow(variant = {}) {
  return {
    variantId: String(variant.id ?? variant._id ?? '').trim(),
    variantName: String(variant.name ?? variant.product_name ?? 'Variant').trim() || 'Variant',
    sku: String(variant.sku ?? variant.product_code ?? '').trim(),
    unitsSold: 0,
    ordersCount: 0,
    grossRevenue: 0,
    netRevenue: 0,
    COGS: 0,
    profit: 0,
    profitMargin: null,
    returnedUnits: 0,
    returnRate: 0,
    firstSoldAt: null,
    lastSoldAt: null,
    highlight: null,
  };
}

export function aggregateVariants(lines, variants = []) {
  const map = new Map();
  for (const variant of Array.isArray(variants) ? variants : []) {
    const row = emptyVariantRow(variant);
    if (row.variantId) map.set(row.variantId, { ...row, _orderIds: new Set() });
  }

  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || line.cancelled) continue;
    const id = String(line.productId || '').trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        ...emptyVariantRow({
          id,
          name: line.variantName,
          sku: line.sku,
        }),
        _orderIds: new Set(),
      });
    }
    const row = map.get(id);
    row.unitsSold += line.quantity || 0;
    row.grossRevenue += line.grossRevenue || 0;
    row.netRevenue += line.netRevenue || 0;
    row.COGS += line.totalCOGS || 0;
    row.profit += line.grossProfit || 0;
    if (line.returned) row.returnedUnits += line.returnedUnits || line.absQuantity || 0;
    if (line.orderId) row._orderIds.add(String(line.orderId));
    if (line.soldAt) {
      if (!row.firstSoldAt || String(line.soldAt) < String(row.firstSoldAt)) row.firstSoldAt = line.soldAt;
      if (!row.lastSoldAt || String(line.soldAt) > String(row.lastSoldAt)) row.lastSoldAt = line.soldAt;
    }
    if (!row.variantName && line.variantName) row.variantName = line.variantName;
    if (!row.sku && line.sku) row.sku = line.sku;
  }

  return [...map.values()].map((row) => {
    const { _orderIds, ...rest } = row;
    return {
      ...rest,
      unitsSold: roundMoney(rest.unitsSold),
      ordersCount: _orderIds.size,
      grossRevenue: roundMoney(rest.grossRevenue),
      netRevenue: roundMoney(rest.netRevenue),
      COGS: roundMoney(rest.COGS),
      profit: roundMoney(rest.profit),
      profitMargin: marginPercent(rest.profit, rest.netRevenue),
      returnedUnits: roundMoney(rest.returnedUnits),
      returnRate: returnRatePercent(rest.returnedUnits, rest.unitsSold),
    };
  });
}

export function identifyVariantHighlights(variantRows) {
  const rows = Array.isArray(variantRows) ? variantRows.filter((r) => r && r.variantId) : [];
  const withSales = rows.filter((r) => r.unitsSold > 0 || r.grossRevenue > 0);

  const bestSellingVariant = withSales.reduce(
    (best, row) => (!best || row.unitsSold > best.unitsSold ? row : best),
    null
  );
  const mostProfitableVariant = withSales.reduce(
    (best, row) => (!best || row.profit > best.profit ? row : best),
    null
  );
  const highestMarginVariant = withSales
    .filter((row) => row.profitMargin != null)
    .reduce((best, row) => (!best || row.profitMargin > best.profitMargin ? row : best), null);
  const highestReturnVariant = rows
    .filter((row) => row.returnedUnits > 0)
    .reduce((best, row) => (!best || row.returnRate > best.returnRate ? row : best), null);

  const tagged = rows.map((row) => {
    const tags = [];
    if (bestSellingVariant && row.variantId === bestSellingVariant.variantId) tags.push('best_seller');
    if (mostProfitableVariant && row.variantId === mostProfitableVariant.variantId) {
      tags.push('most_profitable');
    }
    if (highestMarginVariant && row.variantId === highestMarginVariant.variantId) {
      tags.push('highest_margin');
    }
    if (
      highestReturnVariant &&
      row.variantId === highestReturnVariant.variantId &&
      highestReturnVariant.returnRate >= HIGH_RETURN_RATE_THRESHOLD
    ) {
      tags.push('highest_return');
    }
    return { ...row, highlight: tags[0] || null, highlights: tags };
  });

  return {
    rows: tagged,
    bestSellingVariant,
    mostProfitableVariant,
    highestMarginVariant,
    highestReturnVariant:
      highestReturnVariant && highestReturnVariant.returnRate >= HIGH_RETURN_RATE_THRESHOLD
        ? highestReturnVariant
        : highestReturnVariant,
  };
}

export function aggregateWarehouses(lines, warehouses = []) {
  const map = new Map();
  for (const warehouse of Array.isArray(warehouses) ? warehouses : []) {
    const id = refId(warehouse._id ?? warehouse.id);
    if (!id) continue;
    map.set(id, {
      warehouseId: id,
      warehouseName: String(warehouse.name ?? warehouse.warehouse_name ?? 'Warehouse').trim(),
      unitsSold: 0,
      orders: 0,
      revenue: 0,
      COGS: 0,
      profit: 0,
      margin: null,
      _orderIds: new Set(),
    });
  }

  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || line.cancelled) continue;
    const id = String(line.warehouseId || '').trim() || 'unknown';
    if (!map.has(id)) {
      map.set(id, {
        warehouseId: id,
        warehouseName: line.warehouseName || (id === 'unknown' ? 'Unassigned' : 'Warehouse'),
        unitsSold: 0,
        orders: 0,
        revenue: 0,
        COGS: 0,
        profit: 0,
        margin: null,
        _orderIds: new Set(),
      });
    }
    const row = map.get(id);
    row.unitsSold += line.quantity || 0;
    row.revenue += line.netRevenue || 0;
    row.COGS += line.totalCOGS || 0;
    row.profit += line.grossProfit || 0;
    if (line.orderId) row._orderIds.add(String(line.orderId));
    if (!row.warehouseName && line.warehouseName) row.warehouseName = line.warehouseName;
  }

  return [...map.values()]
    .map((row) => {
      const { _orderIds, ...rest } = row;
      return {
        ...rest,
        unitsSold: roundMoney(rest.unitsSold),
        orders: _orderIds.size,
        revenue: roundMoney(rest.revenue),
        COGS: roundMoney(rest.COGS),
        profit: roundMoney(rest.profit),
        margin: marginPercent(rest.profit, rest.revenue),
      };
    })
    .filter((row) => row.unitsSold !== 0 || row.revenue !== 0 || row.orders !== 0);
}

/**
 * Deterministic product health. Never random / LLM-generated.
 */
export function classifyProductHealth(metrics = emptyMetrics()) {
  const reasons = [];
  if (metrics.grossProfit < 0) {
    reasons.push('LOSS_MAKING');
  }
  if ((metrics.returnRate || 0) >= HIGH_RETURN_RATE_THRESHOLD) {
    reasons.push('HIGH_RETURN');
  }
  if ((metrics.daysSinceLastSale ?? 0) >= SLOW_DAYS_SINCE_SALE || (metrics.salesVelocity || 0) === 0) {
    if ((metrics.unitsSold || 0) === 0 || (metrics.daysSinceLastSale ?? 0) >= SLOW_DAYS_SINCE_SALE) {
      reasons.push('SLOW');
    }
  }
  const unitsChange = metrics.trend?.unitsSoldChangePercent;
  if (unitsChange != null && unitsChange <= DECLINE_THRESHOLD_PCT) {
    reasons.push('DECLINING');
  }

  let status = 'GOOD';
  if (reasons.includes('LOSS_MAKING')) status = 'LOSS_MAKING';
  else if (reasons.includes('SLOW') && (metrics.unitsSold || 0) === 0) status = 'SLOW';
  else if (reasons.includes('HIGH_RETURN') || reasons.includes('DECLINING') || reasons.includes('SLOW')) {
    status = 'WATCH';
  } else if (
    (metrics.profitMargin == null || metrics.profitMargin >= STRONG_MARGIN_THRESHOLD) &&
    (metrics.unitsSold || 0) > 0 &&
    (metrics.returnRate || 0) < 5 &&
    (unitsChange == null || unitsChange >= 0)
  ) {
    status = 'STRONG';
  }

  return { status, reasons };
}

function formatInsightMoney(amount, currency = 'PKR') {
  const n = parsePulseNumber(amount, 0);
  const formatted = n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  return `${currency} ${formatted}`;
}

function formatInsightPct(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${roundPct(value)}%`;
}

/**
 * Insights are only emitted when backed by actual metrics.
 */
export function buildInsights({
  metrics,
  variants,
  highlights,
  productName,
  currency = 'PKR',
} = {}) {
  const insights = [];
  const m = metrics && typeof metrics === 'object' ? metrics : emptyMetrics();
  const health = classifyProductHealth(m);

  if (m.grossProfit > 0) {
    insights.push({
      id: 'profit',
      tone: 'success',
      text: `This product generated ${formatInsightMoney(m.grossProfit, currency)} profit.`,
    });
  } else if (m.grossProfit < 0) {
    insights.push({
      id: 'loss',
      tone: 'danger',
      text: `Loss-making product — ${formatInsightMoney(m.grossProfit, currency)} gross profit.`,
    });
  }

  const unitsPct = formatInsightPct(m.trend?.unitsSoldChangePercent);
  const revenuePct = formatInsightPct(m.trend?.revenueChangePercent);
  if (m.trend?.unitsSoldChangePercent != null && m.trend.unitsSoldChangePercent > 0 && unitsPct) {
    insights.push({
      id: 'units-up',
      tone: 'success',
      text: `Sales increased ${unitsPct} compared with the previous period.`,
    });
  } else if (m.trend?.unitsSoldChangePercent != null && m.trend.unitsSoldChangePercent < 0 && unitsPct) {
    insights.push({
      id: 'units-down',
      tone: 'warning',
      text: `Sales declined ${unitsPct} compared with the previous period.`,
    });
  } else if (m.trend?.revenueChangePercent != null && m.trend.revenueChangePercent !== 0 && revenuePct) {
    insights.push({
      id: 'revenue-change',
      tone: m.trend.revenueChangePercent > 0 ? 'success' : 'warning',
      text: `Revenue changed ${revenuePct} compared with the previous period.`,
    });
  }

  if (
    m.trend?.previousMargin != null &&
    m.profitMargin != null &&
    m.trend.marginChange != null &&
    m.trend.marginChange <= -MARGIN_DROP_THRESHOLD
  ) {
    insights.push({
      id: 'margin-drop',
      tone: 'danger',
      text: `Product margin decreased from ${roundPct(m.trend.previousMargin)}% to ${roundPct(m.profitMargin)}%.`,
    });
  }

  if (m.daysSinceLastSale != null && m.daysSinceLastSale >= SLOW_DAYS_SINCE_SALE) {
    insights.push({
      id: 'stale',
      tone: 'warning',
      text: `No sale recorded in the last ${m.daysSinceLastSale} days.`,
    });
  }

  if ((m.returnRate || 0) >= HIGH_RETURN_RATE_THRESHOLD) {
    insights.push({
      id: 'return-risk',
      tone: 'warning',
      text: `High return risk — ${roundPct(m.returnRate)}% of units sold were returned.`,
    });
  }

  const best = highlights?.bestSellingVariant;
  if (best && best.unitsSold > 0) {
    insights.push({
      id: 'best-variant',
      tone: 'info',
      text: `${best.variantName} is the best-selling variant.`,
    });
  }

  const highReturn = highlights?.highestReturnVariant;
  if (highReturn && highReturn.returnRate >= HIGH_RETURN_RATE_THRESHOLD) {
    insights.push({
      id: 'variant-return',
      tone: 'warning',
      text: `${highReturn.variantName} has a ${roundPct(highReturn.returnRate)}% return rate.`,
    });
  }

  if (health.status === 'SLOW' && (m.unitsSold || 0) === 0) {
    const name = String(productName || 'This product').trim() || 'This product';
    insights.push({
      id: 'no-sales',
      tone: 'muted',
      text: `${name} has no sales in the selected period.`,
    });
  }

  return insights;
}

export function toSalesHistoryRow(line) {
  if (!line) return null;
  return {
    date: line.soldAt,
    orderId: line.orderId,
    orderNumber: line.orderNo,
    customer: line.customerName || '—',
    warehouse: line.warehouseName || '—',
    variant: line.variantName || '—',
    sku: line.sku || '—',
    quantity: line.quantity,
    unitSellingPrice: line.unitSellingPrice,
    discount: line.discount,
    netSellingPrice: line.netSellingPrice,
    unitCost: line.unitCost,
    missingHistoricalCost: Boolean(line.missingHistoricalCost),
    totalCOGS: line.totalCOGS,
    revenue: line.netRevenue,
    profit: line.grossProfit,
    margin: line.profitMargin,
    status: line.status || '—',
  };
}

export function paginateRows(rows, { page = 1, limit = 25 } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safePage = Math.max(1, Number(page) || 1);
  const total = list.length;
  const start = (safePage - 1) * safeLimit;
  return {
    data: list.slice(start, start + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: total > 0 ? Math.ceil(total / safeLimit) : 0,
  };
}

export function skipLimitFromPage(page = 1, limit = 25) {
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safePage = Math.max(1, Number(page) || 1);
  return { skip: (safePage - 1) * safeLimit, limit: safeLimit, page: safePage };
}

export function variantDisplayName(product) {
  if (!product || typeof product !== 'object') return '';
  const name = String(product.product_name ?? product.name ?? '').trim();
  const match = name.match(/\[([^\]]+)\]/);
  if (match) return match[1].trim();
  return name;
}

export function hasVariants(product) {
  if (!product || typeof product !== 'object') return false;
  const type = String(product.product_type ?? product.productType ?? '').trim().toLowerCase();
  if (type === 'variable') return true;
  const kids = product.childproducts ?? product.child_products ?? product.variations;
  return Array.isArray(kids) && kids.length > 0;
}
