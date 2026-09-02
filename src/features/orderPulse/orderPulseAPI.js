import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  fetchAverageOrderValueRequest,
  fetchDailyOrdersRequest,
  fetchOrdersRequest,
  fetchTopSellingProductsRequest,
  pickOrderDocumentId,
  pickOrderInvoiceNo,
} from '../orders/ordersAPI.js';
import { fetchProfitByOrderItemRequest } from '../profitReport/profitReportAPI.js';
import { fetchSalesReturnsListRequest } from '../salesReturns/salesReturnsAPI.js';
import { fetchWarehousesRequest } from '../warehouse/warehouseAPI.js';
import {
  fetchAccountsRequest,
  buildPosPaymentAccountFilterParams,
  filterPosPaymentAccounts,
} from '../accounts/accountsAPI.js';
import { isMongoObjectId, searchProductsForPulse } from '../productPulse/productPulseAPI.js';
import {
  ORDER_STATUS_VALUES,
  addDaysYmd,
  aggregateChannelPerformance,
  aggregatePaymentPerformance,
  aggregateTopCustomers,
  attachOrderTrend,
  buildOrderInsights,
  buildTimelineBuckets,
  detectIgnoredStatusFilter,
  fillTrendFromDailyOrders,
  inclusiveDayCount,
  matchesOrderFilters,
  metricsFromServerTotals,
  normalizeOrderRow,
  previousEquivalentRange,
  resolveDateRange,
  roundMoney,
  skipLimitFromPage,
  statusDistributionFromCounts,
  toOrderHistoryRow,
} from './orderPulseEngine.js';

const BASE_URL = `${API_BASE_URL}/`;

/** Dedicated OrderPulse paths (tried first; 404 falls back to existing APIs). */
export const ORDER_PULSE_OVERVIEW_PATH = 'order/pulse';
export const ORDER_PULSE_ALT_OVERVIEW_PATH = 'order-pulse';

const ORDER_LIST_POPULATE =
  'created_by,customer_id,warehouse_id,payment_method_accounts_id,payment_method_id';
const BREAKDOWN_PAGE_LIMIT = 100;
const MAX_BREAKDOWN_PAGES = 15;
const STATUS_CONCURRENCY = 6;
const WAREHOUSE_CONCURRENCY = 4;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function parseApiError(response, fallback) {
  const text = await response.text().catch(() => '');
  let message = fallback || `Request failed (${response.status})`;
  if (text) {
    try {
      const j = JSON.parse(text);
      if (j?.message) message = j.message;
      else if (typeof j?.error === 'string' && j.error) message = j.error;
    } catch {
      const one = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
      if (one) message = one;
    }
  }
  const err = new Error(message);
  err.status = response.status;
  throw err;
}

export function buildPulseQuery(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) {
    query.set('from', String(params.startDate));
    query.set('startDate', String(params.startDate));
  }
  if (params.endDate) {
    query.set('to', addDaysYmd(String(params.endDate), 1));
    query.set('endDate', addDaysYmd(String(params.endDate), 1));
  }
  if (params.warehouseId) query.set('warehouse_id', String(params.warehouseId));
  if (params.orderStatus) query.set('order_status', String(params.orderStatus));
  if (params.paymentStatus) query.set('payment_status', String(params.paymentStatus));
  if (params.paymentMethodId) query.set('payment_method_id', String(params.paymentMethodId));
  if (params.customerId) query.set('customer_id', String(params.customerId));
  if (params.orderType) query.set('order_type', String(params.orderType));
  if (params.productId) query.set('product_id', String(params.productId));
  if (params.granularity) query.set('granularity', String(params.granularity));
  if (params.search) query.set('search', String(params.search));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));
  if (params.page && params.limit) {
    const { skip, limit } = skipLimitFromPage(params.page, params.limit);
    query.set('skip', String(skip));
    query.set('limit', String(limit));
  } else if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.cursor) query.set('cursor', String(params.cursor));
  return query;
}

function pulseUrl(suffix, params = {}) {
  const qs = buildPulseQuery(params).toString();
  const path = suffix ? `${ORDER_PULSE_OVERVIEW_PATH}/${suffix}` : ORDER_PULSE_OVERVIEW_PATH;
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

export function buildOrderPulseOverviewUrl(params = {}) {
  return pulseUrl('overview', params);
}
export function buildOrderPulseTrendUrl(params = {}) {
  return pulseUrl('trend', params);
}
export function buildOrderPulseStatusUrl(params = {}) {
  return pulseUrl('status', params);
}
export function buildOrderPulseProductsUrl(params = {}) {
  return pulseUrl('products', params);
}
export function buildOrderPulseCustomersUrl(params = {}) {
  return pulseUrl('customers', params);
}
export function buildOrderPulseWarehousesUrl(params = {}) {
  return pulseUrl('warehouses', params);
}
export function buildOrderPulsePaymentsUrl(params = {}) {
  return pulseUrl('payments', params);
}
export function buildOrderPulseReturnsUrl(params = {}) {
  return pulseUrl('returns', params);
}
export function buildOrderPulseCancellationsUrl(params = {}) {
  return pulseUrl('cancellations', params);
}
export function buildOrderPulseOrdersUrl(params = {}) {
  return pulseUrl('orders', params);
}

async function fetchDedicatedOrNull(url) {
  try {
    const response = await fetch(url, { method: 'GET', headers: getHeaders() });
    if (response.status === 404 || response.status === 405) return null;
    if (response.status === 401 || response.status === 403) {
      await parseApiError(response, 'You do not have access to order analytics.');
    }
    if (!response.ok) {
      await parseApiError(response, `Request failed (${response.status})`);
    }
    const result = await response.json().catch(() => ({}));
    if (result && result.success === false) return null;
    return result;
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) throw err;
    if (err?.status === 404 || err?.status === 405) return null;
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) || 0 }, async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(list[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function unwrapDedicatedList(result, keys = ['data', 'rows']) {
  if (!result || typeof result !== 'object') return null;
  for (const key of keys) {
    if (Array.isArray(result[key])) return result[key];
  }
  if (result.data && typeof result.data === 'object') {
    for (const key of keys) {
      if (Array.isArray(result.data[key])) return result.data[key];
    }
  }
  return null;
}

function validateFilterIds(params = {}) {
  const checks = [
    ['warehouseId', 'warehouse'],
    ['productId', 'product'],
    ['customerId', 'customer'],
    ['paymentMethodId', 'payment method'],
  ];
  for (const [key, label] of checks) {
    const value = String(params[key] || '').trim();
    if (value && !isMongoObjectId(value)) {
      const err = new Error(`A valid ${label} id is required.`);
      err.status = 400;
      throw err;
    }
  }
}

function listFilterParams(params = {}) {
  return {
    startDate: params.startDate,
    endDate: params.endDate,
    warehouseId: params.warehouseId || undefined,
    orderStatus: params.orderStatus || undefined,
    orderType: params.orderType || undefined,
    customerId: params.customerId || undefined,
    paymentMethodId: params.paymentMethodId || undefined,
    search: params.search || undefined,
    productId: params.productId || undefined,
  };
}

async function fetchOrderCount(params = {}) {
  const result = await fetchOrdersRequest({
    ...listFilterParams(params),
    page: 1,
    limit: 1,
    populate: 'created_by',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  return Number(result?.total) || 0;
}

export async function fetchStatusCounts(params = {}) {
  const totalOrders = await fetchOrderCount(params);
  const counts = {};
  const perStatus = await mapWithConcurrency(ORDER_STATUS_VALUES, STATUS_CONCURRENCY, async (status) => {
    try {
      const count = await fetchOrderCount({ ...params, orderStatus: status });
      return { status, count };
    } catch {
      return { status, count: 0 };
    }
  });
  for (const row of perStatus) counts[row.status] = row.count;
  const ignored = detectIgnoredStatusFilter(counts, totalOrders);
  return { counts: ignored ? {} : counts, totalOrders, ignoredStatusFilter: ignored };
}

function salesReturnItems(doc) {
  if (!doc || typeof doc !== 'object') return [];
  for (const key of ['sales_return_items', 'salesReturnItems', 'sales_order_return_items', 'items', 'lines']) {
    if (Array.isArray(doc[key])) return doc[key];
  }
  return [];
}

export async function fetchReturnTotals(params = {}) {
  let returnedUnits = 0;
  let refundAmount = 0;
  let returnedOrders = 0;
  let page = 1;
  let totalPages = 1;
  const productRows = new Map();

  while (page <= totalPages && page <= 10) {
    let result;
    try {
      result = await fetchSalesReturnsListRequest({
        page,
        limit: 100,
        startDate: params.startDate,
        endDate: params.endDate,
        product_id: params.productId || undefined,
      });
    } catch {
      break;
    }
    const rows = Array.isArray(result?.data) ? result.data : [];
    returnedOrders = Number(result?.total) || returnedOrders;
    totalPages = Math.max(result?.totalPages || 1, 1);
    for (const doc of rows) {
      const items = salesReturnItems(doc);
      if (!items.length) {
        const qty = Math.abs(Number(doc.qty ?? doc.quantity ?? 0) || 0);
        const amount = Math.abs(Number(doc.total_amount ?? doc.total ?? 0) || 0);
        returnedUnits += qty;
        refundAmount += amount;
        continue;
      }
      for (const item of items) {
        const qty = Math.abs(Number(item.qty ?? item.quantity ?? item.return_qty ?? 0) || 0);
        const price = Number(item.price ?? item.unit_price ?? 0) || 0;
        const amount = Math.abs(Number(item.subtotal ?? item.total ?? qty * price) || 0);
        returnedUnits += qty;
        refundAmount += amount;
        const pid = String(item.product_id?._id ?? item.product_id ?? item.productId ?? '').trim();
        if (!pid) continue;
        if (params.productId && pid !== String(params.productId)) continue;
        if (!productRows.has(pid)) {
          productRows.set(pid, {
            productId: pid,
            productName: String(
              item.product_id?.product_name ?? item.product_name ?? item.name ?? 'Product'
            ).trim(),
            returnedUnits: 0,
            returnedRevenue: 0,
          });
        }
        const rec = productRows.get(pid);
        rec.returnedUnits += qty;
        rec.returnedRevenue += amount;
      }
    }
    if (!rows.length) break;
    page += 1;
  }

  return {
    returnedOrders,
    returnedUnits: roundMoney(returnedUnits),
    refundAmount: roundMoney(refundAmount),
    highReturnProducts: [...productRows.values()]
      .sort((a, b) => b.returnedUnits - a.returnedUnits)
      .slice(0, 10),
  };
}

/**
 * Bounded order scan for dimensional breakdowns only (customers, payments, channels).
 * Never used for company-wide money totals.
 */
async function fetchBreakdownOrderRows(params = {}) {
  const collected = [];
  let page = 1;
  let totalPages = 1;
  let truncated = false;
  const paymentStatus = params.paymentStatus || '';

  while (page <= totalPages && page <= MAX_BREAKDOWN_PAGES) {
    const result = await fetchOrdersRequest({
      ...listFilterParams(params),
      page,
      limit: BREAKDOWN_PAGE_LIMIT,
      populate: ORDER_LIST_POPULATE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    const rows = (Array.isArray(result?.data) ? result.data : [])
      .map((order) => normalizeOrderRow(order))
      .filter(Boolean)
      .filter((row) => (paymentStatus ? row.paymentStatus === paymentStatus : true))
      .filter((row) => matchesOrderFilters(row, params));
    collected.push(...rows);
    totalPages = Math.max(result?.totalPages || 1, 1);
    if (page >= MAX_BREAKDOWN_PAGES && totalPages > MAX_BREAKDOWN_PAGES) truncated = true;
    if (!result?.data?.length) break;
    page += 1;
  }

  return { rows: collected, truncated };
}

async function fetchProfitSafe(params) {
  try {
    const { report } = await fetchProfitByOrderItemRequest({
      startDate: params.startDate,
      endDate: params.endDate,
      warehouseId: params.warehouseId || undefined,
      productId: params.productId || undefined,
    });
    return report || { profit: 0, subtotal: 0, lineCount: 0 };
  } catch {
    return { profit: 0, subtotal: 0, lineCount: 0 };
  }
}

function dedicatedOverviewLooksValid(result) {
  if (!result || typeof result !== 'object') return false;
  const metrics = result.metrics ?? result.data?.metrics ?? result;
  return (
    metrics &&
    typeof metrics === 'object' &&
    (metrics.totalOrders != null ||
      metrics.netRevenue != null ||
      metrics.grossRevenue != null ||
      metrics.grossProfit != null)
  );
}

function normalizeDedicatedOverview(result, range) {
  const root = result?.data && typeof result.data === 'object' ? result.data : result;
  const metricsIn = root.metrics && typeof root.metrics === 'object' ? root.metrics : root;
  const previous = previousEquivalentRange(range.startDate, range.endDate);
  const metrics = metricsFromServerTotals({
    profit: {
      subtotal: metricsIn.grossRevenue ?? metricsIn.subtotal,
      profit: metricsIn.grossProfit ?? metricsIn.profit,
      totalCOGS: metricsIn.totalCOGS ?? metricsIn.cogs,
      discount: metricsIn.discount,
    },
    statusCounts: metricsIn.statusCounts || {},
    extras: {
      totalOrders: metricsIn.totalOrders,
      qualifyingOrders: metricsIn.qualifyingOrders,
      discount: metricsIn.discount,
      refundAmount: metricsIn.refundAmount,
      unitsSold: metricsIn.unitsSold,
      itemsSold: metricsIn.itemsSold,
      returnedUnits: metricsIn.returnedUnits,
      returnedOrders: metricsIn.returnedOrders,
      averageOrderValue: metricsIn.averageOrderValue,
      shipping: metricsIn.shipping,
    },
    previous: metricsFromServerTotals({
      profit: {
        subtotal: metricsIn.trend?.previousRevenue ?? metricsIn.previousRevenue,
        profit: metricsIn.trend?.previousProfit ?? metricsIn.previousProfit,
      },
      extras: {
        totalOrders: metricsIn.trend?.previousOrders ?? metricsIn.previousOrders,
        averageOrderValue: metricsIn.trend?.previousAov,
      },
    }),
  });
  return {
    metrics,
    insights: Array.isArray(root.insights) ? root.insights : null,
    range,
    previousRange: previous,
    source: 'dedicated',
  };
}

export async function fetchWarehousesForOrderPulse() {
  try {
    const result = await fetchWarehousesRequest({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' });
    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    return [];
  }
}

export async function fetchPaymentMethodsForOrderPulse() {
  try {
    const filterParams = await buildPosPaymentAccountFilterParams();
    const result = await fetchAccountsRequest({ ...filterParams, page: 1, limit: 200 });
    const rows = filterPosPaymentAccounts(result?.data || [], filterParams.exclude_id);
    return rows.map((row) => ({
      value: String(row._id || row.id || ''),
      label: String(row.name || row.account_name || 'Account'),
    }));
  } catch {
    return [];
  }
}

export { searchProductsForPulse, isMongoObjectId };

async function composeOverview(params) {
  const previous = previousEquivalentRange(params.startDate, params.endDate);
  const [currentProfit, previousProfit, statusPack, previousStatusPack, returnsInfo, aov, prevAov] =
    await Promise.all([
      fetchProfitSafe(params),
      fetchProfitSafe({ ...params, startDate: previous.startDate, endDate: previous.endDate }),
      fetchStatusCounts(params),
      fetchStatusCounts({ ...params, startDate: previous.startDate, endDate: previous.endDate }),
      fetchReturnTotals(params),
      fetchAverageOrderValueRequest({ from: params.startDate, to: params.endDate }).catch(() => null),
      fetchAverageOrderValueRequest({ from: previous.startDate, to: previous.endDate }).catch(() => null),
    ]);

  const current = metricsFromServerTotals({
    profit: currentProfit,
    statusCounts: statusPack.counts,
    extras: {
      totalOrders: statusPack.totalOrders,
      discount: 0,
      refundAmount: returnsInfo.refundAmount,
      unitsSold: 0,
      itemsSold: currentProfit.lineCount,
      returnedUnits: returnsInfo.returnedUnits,
      returnedOrders: returnsInfo.returnedOrders,
      averageOrderValue: aov?.summary?.averageOrderValue,
    },
  });

  const prev = metricsFromServerTotals({
    profit: previousProfit,
    statusCounts: previousStatusPack.counts,
    extras: {
      totalOrders: previousStatusPack.totalOrders,
      refundAmount: 0,
      itemsSold: previousProfit.lineCount,
      averageOrderValue: prevAov?.summary?.averageOrderValue,
    },
  });

  return {
    metrics: attachOrderTrend(current, prev),
    returns: returnsInfo,
    range: { startDate: params.startDate, endDate: params.endDate, preset: params.preset },
    previousRange: previous,
    source: 'composed',
    ignoredStatusFilter: statusPack.ignoredStatusFilter,
  };
}

export async function fetchOrderPulseOverview(params = {}) {
  validateFilterIds(params);
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    warehouseId: params.warehouseId || '',
    orderStatus: params.orderStatus || '',
    paymentStatus: params.paymentStatus || '',
    paymentMethodId: params.paymentMethodId || '',
    customerId: params.customerId || '',
    orderType: params.orderType || '',
    productId: params.productId || '',
    preset: range.preset,
  };

  const dedicated = await fetchDedicatedOrNull(buildOrderPulseOverviewUrl(query));
  if (dedicatedOverviewLooksValid(dedicated)) {
    const normalized = normalizeDedicatedOverview(dedicated, range);
    return {
      ...normalized,
      insights:
        normalized.insights ||
        buildOrderInsights({ metrics: normalized.metrics }),
    };
  }

  const composed = await composeOverview(query);
  return composed;
}

export async function fetchOrderPulseTrend(params = {}) {
  const granularity = ['daily', 'weekly', 'monthly'].includes(params.granularity)
    ? params.granularity
    : 'daily';
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    warehouseId: params.warehouseId,
    orderStatus: params.orderStatus,
    paymentMethodId: params.paymentMethodId,
    orderType: params.orderType,
    productId: params.productId,
    granularity,
  };

  const dedicated = await fetchDedicatedOrNull(buildOrderPulseTrendUrl(query));
  const dedicatedPoints = unwrapDedicatedList(dedicated, ['points', 'data', 'timeline', 'days']);
  if (dedicatedPoints) {
    return { granularity, points: dedicatedPoints, source: 'dedicated', range };
  }

  const buckets = buildTimelineBuckets(range.startDate, range.endDate, granularity);
  let days = [];
  try {
    const daily = await fetchDailyOrdersRequest({ from: range.startDate, to: range.endDate });
    days = Array.isArray(daily?.days) ? daily.days : [];
  } catch {
    days = [];
  }

  if (granularity === 'daily') {
    const points = fillTrendFromDailyOrders(buckets, days);
    return { granularity, points, source: 'daily-orders', range };
  }

  const points = buckets.map((bucket) => {
    const start = bucket.date;
    let end = bucket.date;
    if (granularity === 'monthly') {
      const [y, m] = bucket.date.split('-');
      end = addDaysYmd(`${y}-${m}-01`, 32).slice(0, 8) + '01';
      end = addDaysYmd(end, -1);
      if (end > range.endDate) end = range.endDate;
    } else {
      end = addDaysYmd(start, 6);
      if (end > range.endDate) end = range.endDate;
    }
    const inBucket = days.filter((d) => {
      const ymd = String(d.date || '').slice(0, 10);
      return ymd >= start && ymd <= end;
    });
    const orders = inBucket.reduce((s, d) => s + (Number(d.orderCount) || 0), 0);
    const netRevenue = roundMoney(inBucket.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0));
    return { ...bucket, orders, netRevenue, grossRevenue: netRevenue, unitsSold: 0, profit: 0, COGS: 0 };
  });

  return { granularity, points, source: 'daily-orders', range };
}

export async function fetchOrderPulseStatus(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulseStatusUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['statuses', 'data', 'rows']);
  if (dedicatedRows) return { rows: dedicatedRows, source: 'dedicated', range };

  const pack = await fetchStatusCounts(query);
  return {
    rows: statusDistributionFromCounts(pack.counts),
    totalOrders: pack.totalOrders,
    ignoredStatusFilter: pack.ignoredStatusFilter,
    source: 'composed',
    range,
  };
}

export async function fetchOrderPulseProducts(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulseProductsUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['products', 'data', 'rows']);
  if (dedicatedRows) return { rows: dedicatedRows, source: 'dedicated', range };

  try {
    const result = await fetchTopSellingProductsRequest({
      from: range.startDate,
      to: range.endDate,
      limit: 15,
      sort_by: 'revenue',
    });
    const raw = Array.isArray(result?.products)
      ? result.products
      : Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : [];
    const rows = raw.map((row) => {
      const revenue = roundMoney(row.totalRevenue ?? row.revenue ?? 0);
      const profit = roundMoney(row.totalProfit ?? row.profit ?? 0);
      const cogs = revenue - profit;
      return {
        productId: String(row.productId ?? row.product_id ?? row._id ?? ''),
        productName: String(row.name ?? row.product_name ?? 'Product'),
        sku: String(row.sku ?? row.code ?? ''),
        unitsSold: roundMoney(row.totalQty ?? row.unitsSold ?? 0),
        ordersCount: Number(row.lineCount ?? row.ordersCount) || 0,
        revenue,
        COGS: roundMoney(cogs),
        profit,
        margin: revenue !== 0 ? Math.round((profit / revenue) * 10000) / 100 : null,
        returnedUnits: 0,
        returnRate: 0,
      };
    });
    return { rows, source: 'top-selling', range };
  } catch {
    return { rows: [], source: 'composed', range };
  }
}

export async function fetchOrderPulseCustomers(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulseCustomersUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['customers', 'data', 'rows']);
  if (dedicatedRows) return { rows: dedicatedRows, source: 'dedicated', range, truncated: false };

  const pack = await fetchBreakdownOrderRows(query);
  return {
    rows: aggregateTopCustomers(pack.rows),
    source: 'composed',
    range,
    truncated: pack.truncated,
  };
}

export async function fetchOrderPulseWarehouses(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulseWarehousesUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['warehouses', 'data', 'rows']);
  if (dedicatedRows) return { rows: dedicatedRows, source: 'dedicated', range };

  const warehouses = await fetchWarehousesForOrderPulse();
  let scoped = warehouses;
  if (query.warehouseId) {
    scoped = warehouses.filter((w) => String(w._id || w.id) === String(query.warehouseId));
    if (query.warehouseId && warehouses.length && !scoped.length) {
      const err = new Error('You do not have access to that warehouse.');
      err.status = 403;
      throw err;
    }
  }

  const rows = await mapWithConcurrency(scoped, WAREHOUSE_CONCURRENCY, async (warehouse) => {
    const id = String(warehouse._id || warehouse.id);
    const [profit, count] = await Promise.all([
      fetchProfitSafe({ ...query, warehouseId: id }),
      fetchOrderCount({ ...query, warehouseId: id }).catch(() => 0),
    ]);
    const revenue = roundMoney(profit.subtotal);
    const profitAmt = roundMoney(profit.profit);
    const cogs = roundMoney(revenue - profitAmt);
    return {
      warehouseId: id,
      warehouseName: String(warehouse.name || warehouse.warehouse_name || 'Warehouse'),
      orders: count,
      units: 0,
      revenue,
      COGS: cogs,
      profit: profitAmt,
      margin: revenue !== 0 ? Math.round((profitAmt / revenue) * 10000) / 100 : null,
      returns: 0,
    };
  });

  return {
    rows: rows.filter((row) => row.orders !== 0 || row.revenue !== 0),
    source: 'composed',
    range,
  };
}

export async function fetchOrderPulsePayments(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulsePaymentsUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['payments', 'data', 'rows']);
  if (dedicatedRows) return { rows: dedicatedRows, source: 'dedicated', range, truncated: false };

  const pack = await fetchBreakdownOrderRows(query);
  return {
    rows: aggregatePaymentPerformance(pack.rows),
    channels: aggregateChannelPerformance(pack.rows),
    source: 'composed',
    range,
    truncated: pack.truncated,
  };
}

export async function fetchOrderPulseReturns(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = { startDate: range.startDate, endDate: range.endDate, ...listFilterParams(params) };
  const dedicated = await fetchDedicatedOrNull(buildOrderPulseReturnsUrl(query));
  if (dedicated && (dedicated.returnedOrders != null || dedicated.data?.returnedOrders != null)) {
    const root = dedicated.data && typeof dedicated.data === 'object' ? dedicated.data : dedicated;
    return { ...root, source: 'dedicated', range };
  }
  const totals = await fetchReturnTotals(query);
  return { ...totals, source: 'composed', range };
}

export async function fetchOrderPulseOrders(params = {}) {
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 25);
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    ...listFilterParams(params),
    search: params.search,
    page,
    limit,
    sortBy: params.sortBy || 'createdAt',
    sortOrder: params.sortOrder || 'desc',
  };

  const dedicated = await fetchDedicatedOrNull(buildOrderPulseOrdersUrl(query));
  const dedicatedRows = unwrapDedicatedList(dedicated, ['data', 'orders', 'rows']);
  if (dedicatedRows) {
    const pagination = dedicated.pagination || {
      page,
      limit,
      total: dedicated.total ?? dedicatedRows.length,
      totalPages: dedicated.totalPages ?? 0,
      cursor: dedicated.cursor ?? null,
    };
    return { rows: dedicatedRows, pagination, source: 'dedicated', range };
  }

  const result = await fetchOrdersRequest({
    ...listFilterParams(query),
    search: query.search,
    page,
    limit,
    populate: ORDER_LIST_POPULATE,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  let rows = (Array.isArray(result.data) ? result.data : [])
    .map((order) => normalizeOrderRow(order))
    .filter(Boolean)
    .map(toOrderHistoryRow);

  if (params.paymentStatus) {
    rows = rows.filter((row) => row.paymentStatus === params.paymentStatus);
  }

  return {
    rows,
    pagination: {
      page: result.page || page,
      limit: result.limit || limit,
      total: result.total || 0,
      totalPages: result.totalPages || 0,
      cursor: null,
    },
    source: 'composed',
    range,
  };
}

/**
 * Load overview + supporting sections. Status counts and profit totals are
 * server-side; the order table is paginated; dimensional tables use a bounded scan.
 */
export async function fetchOrderPulseBundle(params = {}) {
  validateFilterIds(params);
  const overview = await fetchOrderPulseOverview(params);
  const range = overview.range;
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    warehouseId: params.warehouseId,
    orderStatus: params.orderStatus,
    paymentStatus: params.paymentStatus,
    paymentMethodId: params.paymentMethodId,
    customerId: params.customerId,
    orderType: params.orderType,
    productId: params.productId,
    granularity: params.granularity || 'daily',
    page: params.page || 1,
    limit: params.limit || 25,
    search: params.search,
    preset: range.preset,
  };

  const reusedStatus =
    overview.metrics?.statusCounts && Object.keys(overview.metrics.statusCounts).length
      ? {
          rows: statusDistributionFromCounts(overview.metrics.statusCounts),
          totalOrders: overview.metrics.totalOrders,
          ignoredStatusFilter: overview.ignoredStatusFilter,
          source: overview.source,
          range,
        }
      : null;
  const reusedReturns = overview.returns
    ? { ...overview.returns, source: overview.source, range }
    : null;

  const [
    trend,
    status,
    products,
    warehouses,
    orders,
    customersDedicated,
    paymentsDedicated,
    returnsInfo,
  ] = await Promise.all([
    fetchOrderPulseTrend(query),
    reusedStatus || fetchOrderPulseStatus(query),
    fetchOrderPulseProducts(query),
    fetchOrderPulseWarehouses(query),
    fetchOrderPulseOrders(query),
    fetchDedicatedOrNull(buildOrderPulseCustomersUrl(query)),
    fetchDedicatedOrNull(buildOrderPulsePaymentsUrl(query)),
    reusedReturns || fetchOrderPulseReturns(query),
  ]);

  const dedicatedCustomerRows = unwrapDedicatedList(customersDedicated, ['customers', 'data', 'rows']);
  const dedicatedPaymentRows = unwrapDedicatedList(paymentsDedicated, ['payments', 'data', 'rows']);
  let customers;
  let payments;
  if (dedicatedCustomerRows && dedicatedPaymentRows) {
    customers = { rows: dedicatedCustomerRows, source: 'dedicated', range, truncated: false };
    payments = {
      rows: dedicatedPaymentRows,
      channels: unwrapDedicatedList(paymentsDedicated, ['channels']) || [],
      source: 'dedicated',
      range,
      truncated: false,
    };
  } else if (dedicatedCustomerRows || dedicatedPaymentRows) {
    customers = dedicatedCustomerRows
      ? { rows: dedicatedCustomerRows, source: 'dedicated', range, truncated: false }
      : await fetchOrderPulseCustomers(query);
    payments = dedicatedPaymentRows
      ? {
          rows: dedicatedPaymentRows,
          channels: unwrapDedicatedList(paymentsDedicated, ['channels']) || [],
          source: 'dedicated',
          range,
          truncated: false,
        }
      : await fetchOrderPulsePayments(query);
  } else {
    const pack = await fetchBreakdownOrderRows(query);
    customers = {
      rows: aggregateTopCustomers(pack.rows),
      source: 'composed',
      range,
      truncated: pack.truncated,
    };
    payments = {
      rows: aggregatePaymentPerformance(pack.rows),
      channels: aggregateChannelPerformance(pack.rows),
      source: 'composed',
      range,
      truncated: pack.truncated,
    };
  }

  const metrics = overview.metrics;
  if (returnsInfo?.returnedOrders != null && metrics) {
    metrics.returnedOrders = Math.max(metrics.returnedOrders || 0, returnsInfo.returnedOrders || 0);
    metrics.returnedUnits = returnsInfo.returnedUnits ?? metrics.returnedUnits;
    metrics.refundAmount = returnsInfo.refundAmount ?? metrics.refundAmount;
    metrics.returnRate =
      metrics.totalOrders > 0
        ? Math.round((metrics.returnedOrders / metrics.totalOrders) * 10000) / 100
        : metrics.returnRate;
  }

  const insights =
    overview.insights ||
    buildOrderInsights({
      metrics,
      topProduct: products.rows?.[0],
      payments: payments.rows,
    });

  return {
    overview: {
      ...overview,
      metrics,
      insights,
    },
    trend,
    status,
    products,
    customers,
    warehouses,
    payments,
    returns: returnsInfo,
    cancellations: {
      cancelledOrders: metrics?.cancelledOrders || 0,
      cancellationRate: metrics?.cancellationRate || 0,
      reasons: [],
      source: 'composed',
    },
    orders,
  };
}

export function invoicePathForOrder(row) {
  return row?.orderId || row?.orderNumber || '';
}

export { pickOrderDocumentId, pickOrderInvoiceNo, inclusiveDayCount };
