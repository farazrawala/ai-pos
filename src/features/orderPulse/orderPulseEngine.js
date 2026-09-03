/**
 * OrderPulse analytics engine.
 *
 * Deterministic, side-effect-free calculations for order performance.
 * Historical COGS uses order-item `cost_price_at_sale` only — never current
 * product wholesale / average cost. Mirrors ProductPulse accounting rules.
 */

import { getOrderLineItems } from '../orders/ordersAPI.js';
import { getOrderDiscountAmount, parseProfitNumber } from '../profitReport/profitReportAPI.js';
import {
  computeLineEconomics,
  isCancelledStatus,
  isReturnedStatus,
  marginPercent,
  parsePulseNumber,
  percentChange,
  refId,
  roundMoney,
  roundPct,
  ymdFromDate,
} from '../productPulse/productPulseEngine.js';

export {
  DATE_PRESETS,
  DEFAULT_DATE_PRESET,
  TIMELINE_GRANULARITIES,
  addDaysYmd,
  buildTimelineBuckets,
  fillTimeline,
  formatYmd,
  inclusiveDayCount,
  isCancelledStatus,
  isReturnedStatus,
  marginPercent,
  paginateRows,
  parsePulseNumber,
  percentChange,
  previousEquivalentRange,
  refId,
  resolveDateRange,
  roundMoney,
  roundPct,
  skipLimitFromPage,
  ymdFromDate,
} from '../productPulse/productPulseEngine.js';

/** Backend `order_status` enum used by POS invoice + OMS. There is no `shipped`. */
export const ORDER_STATUS_VALUES = [
  'active',
  'placed',
  'confirmed',
  'duplicate',
  'packed',
  'delivered',
  'draft',
  'pending',
  'on_hold',
  'cancelled',
  'failed',
  'processing',
  'return',
  'return_received',
];

/** Statuses excluded from AOV / net-revenue qualifying orders. */
export const NON_QUALIFYING_STATUSES = new Set([
  'cancelled',
  'canceled',
  'failed',
  'duplicate',
  'draft',
]);

export const RETURN_STATUSES = new Set(['return', 'return_received', 'returned', 'refunded', 'refund']);

export const SALES_CHANNEL_VALUES = ['offline', 'shop', 'online', 'bigcommerce', 'website'];

export const PAYMENT_STATUS_VALUES = ['paid', 'partial', 'unpaid'];

export const HIGH_RETURN_RATE_THRESHOLD = 10;
export const HIGH_CANCEL_RATE_THRESHOLD = 12;
export const STRONG_MARGIN_THRESHOLD = 25;
export const MATERIAL_CHANGE_PCT = 5;

export function normalizeStatusKey(status) {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function formatStatusLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function isDraftStatus(status) {
  return normalizeStatusKey(status) === 'draft';
}

export function isDeliveredStatus(status) {
  return normalizeStatusKey(status) === 'delivered';
}

export function isPendingStatus(status) {
  const s = normalizeStatusKey(status);
  return s === 'pending' || s === 'on_hold' || s === 'placed' || s === 'draft';
}

export function isProcessingStatus(status) {
  const s = normalizeStatusKey(status);
  return s === 'processing' || s === 'confirmed' || s === 'active';
}

export function isPackedStatus(status) {
  const s = normalizeStatusKey(status);
  return s === 'packed' || s === 'shipped';
}

export function isFailedStatus(status) {
  const s = normalizeStatusKey(status);
  return s === 'failed' || s === 'duplicate';
}

export function isCancelledOnlyStatus(status) {
  const s = normalizeStatusKey(status);
  return s === 'cancelled' || s === 'canceled';
}

export function isQualifyingStatus(status) {
  const s = normalizeStatusKey(status);
  if (!s) return true;
  return !NON_QUALIFYING_STATUSES.has(s);
}

/**
 * Paid / partial / unpaid from `amount_paid` vs `remaining_amount`.
 * There is no dedicated payment_status enum on orders.
 */
export function classifyPaymentStatus(order = {}) {
  const explicit = normalizeStatusKey(
    order.payment_status ?? order.paymentStatus ?? order.pay_status
  );
  if (PAYMENT_STATUS_VALUES.includes(explicit)) return explicit;
  if (explicit === 'complete' || explicit === 'completed' || explicit === 'success') return 'paid';

  const total = parsePulseNumber(
    order.total_amount ?? order.totalAmount ?? order.grand_total ?? order.grandTotal,
    0
  );
  const paid = parsePulseNumber(
    order.amount_paid ?? order.amountPaid ?? order.amount_received ?? order.amountReceived,
    0
  );
  const remainingRaw = order.remaining_amount ?? order.remainingAmount ?? order.balance_due;
  const remaining =
    remainingRaw == null || remainingRaw === ''
      ? Math.max(0, roundMoney(total - paid))
      : parsePulseNumber(remainingRaw, 0);

  if (paid <= 0 && remaining > 0) return 'unpaid';
  if (remaining <= 0 && paid > 0) return 'paid';
  if (paid > 0 && remaining > 0) return 'partial';
  if (total <= 0 && paid <= 0) return 'unpaid';
  return remaining <= 0 ? 'paid' : 'unpaid';
}

export function salesChannelOf(order = {}) {
  const raw = String(
    order.order_type ??
      order.orderType ??
      order.order_channel ??
      order.channel ??
      order.source ??
      order.order_source ??
      ''
  )
    .trim()
    .toLowerCase();
  if (!raw) return 'offline';
  if (raw === 'pos') return 'offline';
  return raw;
}

export function paymentMethodLabel(order = {}) {
  const account = order.payment_method_accounts_id;
  if (account && typeof account === 'object') {
    const name = String(account.name ?? account.account_name ?? account.title ?? '').trim();
    if (name) return name;
  }
  const method = order.payment_method;
  if (method && typeof method === 'object') {
    const name = String(method.name ?? method.method_name ?? '').trim();
    if (name) return name;
  }
  return (
    String(
      order.payment_method_name ??
        order.paymentMethodName ??
        order.payment_method_account_name ??
        order.posPayMethodName ??
        ''
    ).trim() || 'Unknown'
  );
}

export function paymentMethodIdOf(order = {}) {
  return (
    refId(order.payment_method_accounts_id) ||
    refId(order.payment_method_id) ||
    refId(order.payment_method) ||
    refId(order.posPayMethod) ||
    refId(order.account_id)
  );
}

export function customerNameOf(order = {}) {
  const customer = order.customer_id ?? order.customerId ?? order.customer;
  if (customer && typeof customer === 'object') {
    const name = String(customer.name ?? customer.customer_name ?? customer.full_name ?? '').trim();
    if (name) return name;
  }
  return String(order.name ?? order.customer_name ?? order.customerName ?? '').trim() || 'Walk-in';
}

export function customerIdOf(order = {}) {
  return refId(order.customer_id ?? order.customerId ?? order.customer);
}

export function warehouseNameOf(order = {}, line = null) {
  const ref = line?.warehouse_id ?? order.warehouse_id ?? order.warehouseId ?? order.warehouse;
  if (ref && typeof ref === 'object') {
    return String(ref.name ?? ref.warehouse_name ?? '').trim();
  }
  return String(order.warehouse_name ?? '').trim();
}

export function warehouseIdOf(order = {}, line = null) {
  return refId(line?.warehouse_id ?? order.warehouse_id ?? order.warehouseId ?? order.warehouse);
}

export function ratePercent(numerator, denominator) {
  const den = parsePulseNumber(denominator, 0);
  if (den === 0) return parsePulseNumber(numerator, 0) > 0 ? 100 : 0;
  return roundPct((parsePulseNumber(numerator, 0) / den) * 100);
}

export function averageOrderValue(netRevenue, qualifyingOrders) {
  const orders = parsePulseNumber(qualifyingOrders, 0);
  if (orders <= 0) return 0;
  return roundMoney(parsePulseNumber(netRevenue, 0) / orders);
}

export function emptyStatusCounts() {
  const counts = {};
  for (const status of ORDER_STATUS_VALUES) counts[status] = 0;
  return counts;
}

export function emptyOverviewMetrics() {
  return {
    totalOrders: 0,
    qualifyingOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    packedOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    failedOrders: 0,
    draftOrders: 0,
    unitsSold: 0,
    itemsSold: 0,
    grossRevenue: 0,
    discount: 0,
    shipping: 0,
    refundAmount: 0,
    netRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    profitMargin: null,
    averageOrderValue: 0,
    itemsPerOrder: null,
    returnRate: 0,
    cancellationRate: 0,
    returnedUnits: 0,
    missingHistoricalCostCount: 0,
    statusCounts: emptyStatusCounts(),
    trend: emptyTrend(),
  };
}

export function emptyTrend() {
  return {
    ordersChangePercent: null,
    revenueChangePercent: null,
    profitChangePercent: null,
    marginChange: null,
    aovChangePercent: null,
    returnRateChange: null,
    cancellationRateChange: null,
    previousOrders: 0,
    previousRevenue: 0,
    previousProfit: 0,
    previousMargin: null,
    previousAov: 0,
    previousReturnRate: 0,
    previousCancellationRate: 0,
  };
}

/**
 * Order-level economics from nested lines + order discount.
 * grossRevenue = sum(qty × selling price)
 * netRevenue   = grossRevenue − line discounts − order discount − refunds
 * COGS         = sum(qty × cost_price_at_sale)
 * grossProfit  = netRevenue − COGS
 */
export function computeOrderEconomics(order, extras = {}) {
  const items = getOrderLineItems(order);
  const productIds = items
    .map((item) => refId(item?.product_id ?? item?.productId))
    .filter(Boolean);
  let unitsSold = 0;
  let grossRevenue = 0;
  let lineDiscount = 0;
  let netFromLines = 0;
  let totalCOGS = 0;
  let missingHistoricalCostCount = 0;
  let returnedUnits = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const lineStatus = item.status ?? item.line_status ?? order.order_status ?? order.status;
    if (isCancelledStatus(lineStatus) && !isReturnedStatus(lineStatus)) continue;
    const economics = computeLineEconomics(item);
    unitsSold += economics.quantity || 0;
    grossRevenue += economics.grossRevenue || 0;
    lineDiscount += economics.discount || 0;
    netFromLines += economics.netRevenue || 0;
    totalCOGS += economics.totalCOGS || 0;
    if (economics.missingHistoricalCost) missingHistoricalCostCount += 1;
    if (isReturnedStatus(lineStatus)) {
      returnedUnits += Math.abs(
        parsePulseNumber(item.returned_qty ?? item.return_qty, economics.absQuantity)
      );
    }
  }

  const orderDiscount = getOrderDiscountAmount(order);
  const shipping = parsePulseNumber(order.shipping ?? order.shipment ?? order.shipping_amount, 0);
  const extraRefund = parsePulseNumber(extras.refundAmount, 0);
  const discount = roundMoney(lineDiscount + orderDiscount);
  const netRevenue = roundMoney(netFromLines - orderDiscount - extraRefund);
  const grossProfit = roundMoney(netRevenue - totalCOGS);

  const itemCountRaw = order.no_of_items ?? order.noOfItems ?? order.items_count;
  const itemCount = Number.isFinite(Number(itemCountRaw))
    ? Number(itemCountRaw)
    : items.length || unitsSold;

  return {
    unitsSold: roundMoney(unitsSold),
    itemCount: Number.isFinite(itemCount) ? itemCount : 0,
    grossRevenue: roundMoney(grossRevenue),
    discount,
    shipping: roundMoney(shipping),
    refundAmount: roundMoney(extraRefund),
    netRevenue,
    totalCOGS: roundMoney(totalCOGS),
    grossProfit,
    profitMargin: marginPercent(grossProfit, netRevenue),
    missingHistoricalCostCount,
    returnedUnits: roundMoney(returnedUnits),
    productIds,
  };
}

export function normalizeOrderRow(order, extras = {}) {
  if (!order || typeof order !== 'object') return null;
  const status = String(order.order_status ?? order.orderStatus ?? order.status ?? '').trim();
  const cancelled = isCancelledOnlyStatus(status) || isFailedStatus(status);
  const returned = isReturnedStatus(status);
  const qualifying = isQualifyingStatus(status) && !returned;
  const soldAt = order.createdAt ?? order.created_at ?? order.date ?? order.order_date;
  const economics = computeOrderEconomics(order, extras);
  const paymentStatus = classifyPaymentStatus(order);

  return {
    orderId: refId(order._id ?? order.id) || null,
    orderNo: String(order.order_no ?? order.orderNo ?? order.invoice_no ?? '').trim() || '—',
    soldAt: soldAt ? String(soldAt) : null,
    soldOn: ymdFromDate(soldAt),
    status,
    statusKey: normalizeStatusKey(status) || 'unknown',
    customerId: customerIdOf(order),
    customerName: customerNameOf(order),
    warehouseId: warehouseIdOf(order),
    warehouseName: warehouseNameOf(order) || '—',
    paymentMethodId: paymentMethodIdOf(order),
    paymentMethodName: paymentMethodLabel(order),
    paymentStatus,
    channel: salesChannelOf(order),
    cancelled,
    returned,
    qualifying,
    draft: isDraftStatus(status),
    ...economics,
  };
}

export function matchesOrderFilters(row, filters = {}) {
  if (!row) return false;
  if (filters.warehouseId && String(row.warehouseId || '') !== String(filters.warehouseId)) return false;
  if (filters.orderStatus && row.statusKey !== normalizeStatusKey(filters.orderStatus)) return false;
  if (filters.paymentStatus && row.paymentStatus !== String(filters.paymentStatus)) return false;
  if (filters.paymentMethodId && String(row.paymentMethodId || '') !== String(filters.paymentMethodId)) {
    return false;
  }
  if (filters.customerId && String(row.customerId || '') !== String(filters.customerId)) return false;
  if (filters.orderType) {
    if (String(row.channel || '') !== String(filters.orderType).trim().toLowerCase()) return false;
  }
  if (filters.productId) {
    const ids = Array.isArray(row.productIds) ? row.productIds.map(String) : [];
    if (!ids.includes(String(filters.productId))) return false;
  }
  if (filters.startDate && row.soldOn && row.soldOn < filters.startDate) return false;
  if (filters.endDate && row.soldOn && row.soldOn > filters.endDate) return false;
  const q = String(filters.search || '')
    .trim()
    .toLowerCase();
  if (q) {
    const hay = `${row.orderNo} ${row.customerName} ${row.status} ${row.paymentMethodName}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function bumpStatusCount(counts, statusKey) {
  const key = statusKey && ORDER_STATUS_VALUES.includes(statusKey) ? statusKey : null;
  if (!key) {
    counts.unknown = (counts.unknown || 0) + 1;
    return;
  }
  counts[key] = (counts[key] || 0) + 1;
}

export function aggregateOverviewFromOrders(rows, extras = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const statusCounts = emptyStatusCounts();
  let totalOrders = 0;
  let qualifyingOrders = 0;
  let deliveredOrders = 0;
  let pendingOrders = 0;
  let processingOrders = 0;
  let packedOrders = 0;
  let cancelledOrders = 0;
  let returnedOrders = 0;
  let failedOrders = 0;
  let draftOrders = 0;
  let unitsSold = 0;
  let itemsSold = 0;
  let grossRevenue = 0;
  let discount = 0;
  let shipping = 0;
  let netRevenue = 0;
  let totalCOGS = 0;
  let returnedUnits = 0;
  let missingHistoricalCostCount = 0;

  for (const row of list) {
    if (!row) continue;
    totalOrders += 1;
    bumpStatusCount(statusCounts, row.statusKey);
    if (row.qualifying) qualifyingOrders += 1;
    if (isDeliveredStatus(row.status)) deliveredOrders += 1;
    if (isPendingStatus(row.status)) pendingOrders += 1;
    if (isProcessingStatus(row.status)) processingOrders += 1;
    if (isPackedStatus(row.status)) packedOrders += 1;
    if (isCancelledOnlyStatus(row.status)) cancelledOrders += 1;
    if (row.returned) returnedOrders += 1;
    if (isFailedStatus(row.status)) failedOrders += 1;
    if (row.draft) draftOrders += 1;

    if (row.cancelled && !row.returned) continue;
    unitsSold += row.unitsSold || 0;
    itemsSold += row.itemCount || 0;
    grossRevenue += row.grossRevenue || 0;
    discount += row.discount || 0;
    shipping += row.shipping || 0;
    netRevenue += row.netRevenue || 0;
    totalCOGS += row.totalCOGS || 0;
    returnedUnits += row.returnedUnits || 0;
    missingHistoricalCostCount += row.missingHistoricalCostCount || 0;
  }

  const extraRefund = parsePulseNumber(extras.refundAmount, 0);
  const extraReturnedUnits = parsePulseNumber(extras.returnedUnits, 0);
  const extraReturnedOrders = Number(extras.returnedOrders) || 0;
  if (extraReturnedOrders > returnedOrders) returnedOrders = extraReturnedOrders;
  if (extraReturnedUnits > 0) returnedUnits = extraReturnedUnits;

  const netAfterRefunds = roundMoney(netRevenue - (extraRefund > 0 && !list.length ? extraRefund : 0));
  const grossProfit = roundMoney(netAfterRefunds - totalCOGS);
  const aov = averageOrderValue(netAfterRefunds, qualifyingOrders);

  return {
    ...emptyOverviewMetrics(),
    totalOrders,
    qualifyingOrders,
    deliveredOrders,
    pendingOrders,
    processingOrders,
    packedOrders,
    cancelledOrders,
    returnedOrders,
    failedOrders,
    draftOrders,
    unitsSold: roundMoney(unitsSold),
    itemsSold: roundMoney(itemsSold),
    grossRevenue: roundMoney(grossRevenue),
    discount: roundMoney(discount),
    shipping: roundMoney(shipping),
    refundAmount: roundMoney(extraRefund || list.reduce((s, r) => s + (r.refundAmount || 0), 0)),
    netRevenue: netAfterRefunds,
    totalCOGS: roundMoney(totalCOGS),
    grossProfit,
    profitMargin: marginPercent(grossProfit, netAfterRefunds),
    averageOrderValue: aov,
    itemsPerOrder:
      qualifyingOrders > 0 ? roundPct(parsePulseNumber(unitsSold, 0) / qualifyingOrders) : null,
    returnRate: ratePercent(returnedOrders, totalOrders),
    cancellationRate: ratePercent(cancelledOrders, totalOrders),
    returnedUnits: roundMoney(returnedUnits),
    missingHistoricalCostCount,
    statusCounts,
  };
}

/**
 * Build overview metrics from server-side profit totals + status counts.
 * Prefer this over scanning every order.
 */
export function metricsFromServerTotals({
  profit = {},
  statusCounts = {},
  extras = {},
  previous = null,
} = {}) {
  const counts = { ...emptyStatusCounts(), ...statusCounts };
  const totalOrders = Number(extras.totalOrders ?? extras.orderCount) || sumStatusCounts(counts);
  const deliveredOrders = Number(counts.delivered) || 0;
  const pendingOrders =
    (Number(counts.pending) || 0) +
    (Number(counts.on_hold) || 0) +
    (Number(counts.placed) || 0) +
    (Number(counts.draft) || 0);
  const processingOrders =
    (Number(counts.processing) || 0) + (Number(counts.confirmed) || 0) + (Number(counts.active) || 0);
  const packedOrders = Number(counts.packed) || 0;
  const cancelledOrders = Number(counts.cancelled) || Number(counts.canceled) || 0;
  const returnedOrders = (Number(counts.return) || 0) + (Number(counts.return_received) || 0);
  const failedOrders = (Number(counts.failed) || 0) + (Number(counts.duplicate) || 0);
  const draftOrders = Number(counts.draft) || 0;
  const qualifyingOrders =
    Number(extras.qualifyingOrders) ||
    Math.max(0, totalOrders - cancelledOrders - failedOrders - draftOrders - returnedOrders);

  const subtotal = roundMoney(profit.subtotal ?? profit.grossRevenue ?? extras.grossRevenue ?? 0);
  const profitAmt = roundMoney(profit.profit ?? profit.grossProfit ?? extras.grossProfit ?? 0);
  const discount = roundMoney(extras.discount ?? profit.discount ?? 0);
  const refundAmount = roundMoney(extras.refundAmount ?? 0);
  const explicitCogs = profit.totalCOGS ?? profit.cost_of_goods_sold ?? extras.totalCOGS;
  const totalCOGS =
    explicitCogs != null && Number.isFinite(Number(explicitCogs))
      ? roundMoney(explicitCogs)
      : roundMoney(subtotal - profitAmt);
  const netRevenue = roundMoney(subtotal - discount - refundAmount);
  const grossProfit = roundMoney(netRevenue - totalCOGS);
  const unitsSold = roundMoney(extras.unitsSold ?? profit.total_qty ?? 0);
  const itemsSold = roundMoney(extras.itemsSold ?? profit.lineCount ?? unitsSold);
  const aov = averageOrderValue(netRevenue, qualifyingOrders);

  const current = {
    ...emptyOverviewMetrics(),
    totalOrders,
    qualifyingOrders,
    deliveredOrders,
    pendingOrders,
    processingOrders,
    packedOrders,
    cancelledOrders,
    returnedOrders,
    failedOrders,
    draftOrders,
    unitsSold,
    itemsSold,
    grossRevenue: subtotal,
    discount,
    shipping: roundMoney(extras.shipping ?? 0),
    refundAmount,
    netRevenue,
    totalCOGS,
    grossProfit,
    profitMargin: marginPercent(grossProfit, netRevenue),
    averageOrderValue: extras.averageOrderValue != null ? roundMoney(extras.averageOrderValue) : aov,
    itemsPerOrder: qualifyingOrders > 0 ? roundPct(unitsSold / qualifyingOrders) : null,
    returnRate: ratePercent(returnedOrders, totalOrders),
    cancellationRate: ratePercent(cancelledOrders, totalOrders),
    returnedUnits: roundMoney(extras.returnedUnits ?? 0),
    missingHistoricalCostCount: Number(extras.missingHistoricalCostCount) || 0,
    statusCounts: counts,
  };

  return previous ? attachOrderTrend(current, previous) : current;
}

export function sumStatusCounts(counts = {}) {
  return Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function attachOrderTrend(currentMetrics, previousMetrics) {
  const current = currentMetrics && typeof currentMetrics === 'object' ? currentMetrics : emptyOverviewMetrics();
  const previous = previousMetrics && typeof previousMetrics === 'object' ? previousMetrics : emptyOverviewMetrics();
  const marginChange =
    current.profitMargin != null && previous.profitMargin != null
      ? roundPct(current.profitMargin - previous.profitMargin)
      : null;
  const returnRateChange =
    current.returnRate != null && previous.returnRate != null
      ? roundPct(current.returnRate - previous.returnRate)
      : null;
  const cancellationRateChange =
    current.cancellationRate != null && previous.cancellationRate != null
      ? roundPct(current.cancellationRate - previous.cancellationRate)
      : null;

  return {
    ...current,
    trend: {
      ordersChangePercent: percentChange(current.totalOrders, previous.totalOrders),
      revenueChangePercent: percentChange(current.netRevenue, previous.netRevenue),
      profitChangePercent: percentChange(current.grossProfit, previous.grossProfit),
      marginChange,
      aovChangePercent: percentChange(current.averageOrderValue, previous.averageOrderValue),
      returnRateChange,
      cancellationRateChange,
      previousOrders: previous.totalOrders,
      previousRevenue: previous.netRevenue,
      previousProfit: previous.grossProfit,
      previousMargin: previous.profitMargin,
      previousAov: previous.averageOrderValue,
      previousReturnRate: previous.returnRate,
      previousCancellationRate: previous.cancellationRate,
    },
  };
}

export function statusDistributionFromCounts(statusCounts = {}) {
  const rows = [];
  for (const status of ORDER_STATUS_VALUES) {
    const count = Number(statusCounts[status]) || 0;
    if (count <= 0) continue;
    rows.push({
      status,
      label: formatStatusLabel(status),
      count,
    });
  }
  const unknown = Number(statusCounts.unknown) || 0;
  if (unknown > 0) rows.push({ status: 'unknown', label: 'Unknown', count: unknown });
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    ...row,
    percent: total > 0 ? roundPct((row.count / total) * 100) : 0,
  }));
}

export function detectIgnoredStatusFilter(statusCounts, totalOrders) {
  const total = Number(totalOrders) || 0;
  if (total <= 0) return false;
  const matching = Object.values(statusCounts || {}).filter((n) => Number(n) === total).length;
  return matching >= 3;
}

export function aggregateTopProducts(rows, limit = 15) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.cancelled) continue;
    const id = String(row.productId || '').trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        productId: id,
        productName: row.productName || row.variantName || 'Product',
        sku: row.sku || '',
        unitsSold: 0,
        ordersCount: 0,
        revenue: 0,
        COGS: 0,
        profit: 0,
        margin: null,
        returnedUnits: 0,
        returnRate: 0,
        _orderIds: new Set(),
      });
    }
    const rec = map.get(id);
    rec.unitsSold += row.quantity || row.unitsSold || 0;
    rec.revenue += row.netRevenue || row.revenue || 0;
    rec.COGS += row.totalCOGS || row.COGS || 0;
    rec.profit += row.grossProfit || row.profit || 0;
    if (row.returned) rec.returnedUnits += row.returnedUnits || row.absQuantity || 0;
    if (row.orderId) rec._orderIds.add(String(row.orderId));
    if (!rec.productName && row.productName) rec.productName = row.productName;
  }
  return [...map.values()]
    .map((row) => {
      const { _orderIds, ...rest } = row;
      return {
        ...rest,
        unitsSold: roundMoney(rest.unitsSold),
        ordersCount: _orderIds.size,
        revenue: roundMoney(rest.revenue),
        COGS: roundMoney(rest.COGS),
        profit: roundMoney(rest.profit),
        margin: marginPercent(rest.profit, rest.revenue),
        returnedUnits: roundMoney(rest.returnedUnits),
        returnRate: ratePercent(rest.returnedUnits, rest.unitsSold),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function aggregateTopCustomers(orderRows, limit = 15) {
  const map = new Map();
  for (const row of Array.isArray(orderRows) ? orderRows : []) {
    if (!row || row.cancelled) continue;
    const id = String(row.customerId || row.customerName || 'walk-in').trim();
    if (!map.has(id)) {
      map.set(id, {
        customerId: row.customerId || '',
        customerName: row.customerName || 'Walk-in',
        orders: 0,
        units: 0,
        revenue: 0,
        profit: 0,
        averageOrderValue: 0,
      });
    }
    const rec = map.get(id);
    rec.orders += 1;
    rec.units += row.unitsSold || 0;
    rec.revenue += row.netRevenue || 0;
    rec.profit += row.grossProfit || 0;
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      units: roundMoney(row.units),
      revenue: roundMoney(row.revenue),
      profit: roundMoney(row.profit),
      averageOrderValue: averageOrderValue(row.revenue, row.orders),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function aggregatePaymentPerformance(orderRows) {
  const map = new Map();
  const ensure = (row) => {
    const id = String(row.paymentMethodId || row.paymentMethodName || 'unknown').trim();
    if (!map.has(id)) {
      map.set(id, {
        paymentMethodId: row.paymentMethodId || '',
        paymentMethodName: row.paymentMethodName || 'Unknown',
        orders: 0,
        revenue: 0,
        averageOrderValue: 0,
        cancelledOrders: 0,
        cancellationRate: 0,
      });
    }
    return map.get(id);
  };
  for (const row of Array.isArray(orderRows) ? orderRows : []) {
    if (!row) continue;
    const rec = ensure(row);
    if (row.cancelled) {
      rec.cancelledOrders += 1;
      continue;
    }
    rec.orders += 1;
    rec.revenue += row.netRevenue || 0;
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      revenue: roundMoney(row.revenue),
      averageOrderValue: averageOrderValue(row.revenue, row.orders),
      cancellationRate: ratePercent(row.cancelledOrders, row.orders + row.cancelledOrders),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateChannelPerformance(orderRows) {
  const map = new Map();
  for (const row of Array.isArray(orderRows) ? orderRows : []) {
    if (!row || row.cancelled) continue;
    const id = String(row.channel || 'offline');
    if (!map.has(id)) {
      map.set(id, { channel: id, label: formatStatusLabel(id), orders: 0, revenue: 0, profit: 0 });
    }
    const rec = map.get(id);
    rec.orders += 1;
    rec.revenue += row.netRevenue || 0;
    rec.profit += row.grossProfit || 0;
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      revenue: roundMoney(row.revenue),
      profit: roundMoney(row.profit),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function sortDimensionRows(rows, key, dir = 'desc') {
  const list = [...(Array.isArray(rows) ? rows : [])];
  const factor = dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor;
  });
  return list;
}

function formatInsightMoney(amount, currency = 'PKR') {
  const n = parsePulseNumber(amount, 0);
  return `${currency} ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function formatInsightPct(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${roundPct(value)}%`;
}

/**
 * Deterministic insights only. Never random / LLM text.
 */
export function buildOrderInsights({
  metrics,
  topProduct,
  payments,
  currency = 'PKR',
} = {}) {
  const insights = [];
  const m = metrics && typeof metrics === 'object' ? metrics : emptyOverviewMetrics();
  const t = m.trend || emptyTrend();

  const ordersPct = formatInsightPct(t.ordersChangePercent);
  if (t.ordersChangePercent != null && Math.abs(t.ordersChangePercent) >= MATERIAL_CHANGE_PCT && ordersPct) {
    insights.push({
      id: 'orders-change',
      tone: t.ordersChangePercent > 0 ? 'success' : 'warning',
      text:
        t.ordersChangePercent > 0
          ? `Orders increased ${ordersPct} compared with the previous period.`
          : `Orders declined ${ordersPct} compared with the previous period.`,
    });
  }

  const profitPct = formatInsightPct(t.profitChangePercent);
  if (t.profitChangePercent != null && Math.abs(t.profitChangePercent) >= MATERIAL_CHANGE_PCT && profitPct) {
    insights.push({
      id: 'profit-change',
      tone: t.profitChangePercent > 0 ? 'success' : 'danger',
      text:
        t.profitChangePercent > 0
          ? `Gross profit increased ${profitPct}.`
          : `Gross profit decreased ${profitPct}.`,
    });
  }

  if (m.grossProfit < 0) {
    insights.push({
      id: 'loss',
      tone: 'danger',
      text: `Orders in this period produced ${formatInsightMoney(m.grossProfit, currency)} gross profit.`,
    });
  }

  if (
    t.returnRateChange != null &&
    t.returnRateChange >= 1 &&
    (m.returnRate || 0) >= HIGH_RETURN_RATE_THRESHOLD / 2
  ) {
    insights.push({
      id: 'return-up',
      tone: 'warning',
      text: `Return rate increased from ${roundPct(t.previousReturnRate)}% to ${roundPct(m.returnRate)}%.`,
    });
  } else if ((m.returnRate || 0) >= HIGH_RETURN_RATE_THRESHOLD) {
    insights.push({
      id: 'return-high',
      tone: 'warning',
      text: `Return rate is ${roundPct(m.returnRate)}% of orders.`,
    });
  }

  if (
    t.cancellationRateChange != null &&
    t.cancellationRateChange >= 2 &&
    (m.cancellationRate || 0) >= HIGH_CANCEL_RATE_THRESHOLD / 2
  ) {
    insights.push({
      id: 'cancel-up',
      tone: 'danger',
      text: `Cancellation rate increased significantly to ${roundPct(m.cancellationRate)}%.`,
    });
  }

  const aovPct = formatInsightPct(t.aovChangePercent);
  if (t.aovChangePercent != null && Math.abs(t.aovChangePercent) >= MATERIAL_CHANGE_PCT && aovPct) {
    insights.push({
      id: 'aov-change',
      tone: t.aovChangePercent > 0 ? 'success' : 'warning',
      text: `Average order value changed ${aovPct}.`,
    });
  }

  if (topProduct && (topProduct.profit > 0 || topProduct.revenue > 0)) {
    insights.push({
      id: 'top-product',
      tone: 'info',
      text: `${topProduct.productName} generated the highest ${
        topProduct.profit >= (topProduct.revenue || 0) * 0.01 ? 'profit' : 'revenue'
      }.`,
    });
  }

  const payList = Array.isArray(payments) ? payments : [];
  if (payList.length >= 2) {
    const ranked = [...payList].sort((a, b) => (b.cancellationRate || 0) - (a.cancellationRate || 0));
    const worst = ranked[0];
    const restAvg =
      ranked.slice(1).reduce((s, p) => s + (p.cancellationRate || 0), 0) / Math.max(ranked.length - 1, 1);
    if (
      worst &&
      (worst.cancellationRate || 0) >= HIGH_CANCEL_RATE_THRESHOLD &&
      worst.cancellationRate - restAvg >= 5
    ) {
      insights.push({
        id: 'pay-cancel',
        tone: 'warning',
        text: `${worst.paymentMethodName} orders have a higher cancellation rate than other payment methods.`,
      });
    }
  }

  if (m.totalOrders === 0) {
    insights.push({
      id: 'empty',
      tone: 'muted',
      text: 'No orders found for the selected period.',
    });
  }

  return insights;
}

export function toOrderHistoryRow(row) {
  if (!row) return null;
  return {
    orderId: row.orderId,
    orderNumber: row.orderNo,
    date: row.soldAt,
    customer: row.customerName || '—',
    items: row.itemCount || row.unitsSold || 0,
    warehouse: row.warehouseName || '—',
    paymentMethod: row.paymentMethodName || '—',
    paymentStatus: row.paymentStatus || '—',
    orderStatus: row.status || '—',
    revenue: row.netRevenue,
    COGS: row.totalCOGS,
    profit: row.grossProfit,
    margin: row.profitMargin,
    missingHistoricalCost: (row.missingHistoricalCostCount || 0) > 0,
  };
}

export function fillTrendFromDailyOrders(buckets, days) {
  const index = new Map((Array.isArray(buckets) ? buckets : []).map((b, i) => [b.date, i]));
  const rows = (Array.isArray(buckets) ? buckets : []).map((b) => ({ ...b }));
  for (const day of Array.isArray(days) ? days : []) {
    const ymd = String(day.date || '').slice(0, 10);
    if (!ymd || !index.has(ymd)) continue;
    const row = rows[index.get(ymd)];
    row.orders = Number(day.orderCount ?? day.orders ?? 0) || 0;
    row.netRevenue = roundMoney(day.totalAmount ?? day.netRevenue ?? 0);
    row.grossRevenue = row.netRevenue;
    if (day.averageOrderValue != null) row.averageOrderValue = roundMoney(day.averageOrderValue);
  }
  return rows.map((row) => ({
    ...row,
    profitMargin: marginPercent(row.profit, row.netRevenue),
  }));
}

export function mergeProfitIntoTrend(points, profitByDate = {}) {
  return (Array.isArray(points) ? points : []).map((row) => {
    const extra = profitByDate[row.date];
    if (!extra) return row;
    const netRevenue = roundMoney(extra.netRevenue ?? extra.subtotal ?? row.netRevenue);
    const profit = roundMoney(extra.profit ?? extra.grossProfit ?? row.profit);
    const cogs =
      extra.totalCOGS != null ? roundMoney(extra.totalCOGS) : roundMoney(netRevenue - profit);
    return {
      ...row,
      netRevenue,
      grossRevenue: netRevenue,
      profit,
      COGS: cogs,
      profitMargin: marginPercent(profit, netRevenue),
      unitsSold: extra.unitsSold != null ? extra.unitsSold : row.unitsSold,
    };
  });
}

export { parseProfitNumber };
