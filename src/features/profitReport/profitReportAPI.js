import { API_BASE_URL } from '../../config/apiConfig.js';
import { fetchOrdersRequest, getOrderLineItems } from '../orders/ordersAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

/** Totals with date range + inventory movement check (preferred for summary). */
export const PROFIT_BY_ORDER_ITEM_PATH = 'order_item/profit-by-order-item';

/** Same handler as `order_item/profit-by-order-item` (balance sheet path). */
export const ORDER_PROFIT_BY_ORDER_ITEM_PATH = 'order/profit-by-order-item';

/** Orders with nested `order_items[]` including per-line `profit`. */
export const GET_ORDER_BY_ORDER_ITEM_PATH = 'order/get-order-by-order-item';

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

function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Add calendar days to a YYYY-MM-DD string (local date arithmetic).
 * @param {string} ymd
 * @param {number} days
 */
export function addDaysYmd(ymd, days) {
  const raw = String(ymd || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0));
  return formatDateYmd(d);
}

/**
 * Profit APIs compare datetimes with date-only `to` values coerced to 00:00:00,
 * so an inclusive calendar end day D must be sent as D+1 to include all of D.
 * Callers always pass inclusive YYYY-MM-DD range ends.
 */
function toApiExclusiveEndDate(inclusiveEndYmd) {
  return addDaysYmd(inclusiveEndYmd, 1);
}

function appendDateParams(query, params = {}) {
  if (params.startDate) {
    const start = String(params.startDate);
    query.set('from', start);
    query.set('startDate', start);
  }
  if (params.endDate) {
    const inclusiveEnd = String(params.endDate);
    const apiEnd = toApiExclusiveEndDate(inclusiveEnd);
    query.set('to', apiEnd);
    query.set('endDate', apiEnd);
  }
  if (params.orderId) query.set('order_id', String(params.orderId));
  if (params.productId) query.set('product_id', String(params.productId));
  if (params.warehouseId) query.set('warehouse_id', String(params.warehouseId));
}

function appendListParams(query, params = {}) {
  if (params.page && params.limit) {
    query.set('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', String(params.search));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));
}

export function parseProfitNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
}

/** Order-level discount (POS extra discount / invoice discount). */
export function getOrderDiscountAmount(order) {
  if (!order || typeof order !== 'object') return 0;
  return parseProfitNumber(
    order.discount ??
      order.discount_amount ??
      order.discountAmount ??
      order.extra_discount ??
      order.extraDiscount
  );
}

/**
 * Map order id / order no → discount for rolling discounts into profit groups.
 * @param {unknown[]} orders
 * @returns {Map<string, number>}
 */
export function buildOrderDiscountLookup(orders) {
  const map = new Map();
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order || typeof order !== 'object') continue;
    const discount = getOrderDiscountAmount(order);
    const id = order._id ?? order.id;
    if (id != null && String(id).trim()) map.set(String(id), discount);
    const no = order.order_no ?? order.orderNo;
    if (no != null && String(no).trim()) {
      map.set(`no:${String(no).trim().toLowerCase()}`, discount);
    }
  }
  return map;
}

export function resolveOrderDiscount(lookup, orderId, orderNo) {
  if (!(lookup instanceof Map)) return 0;
  if (orderId != null && lookup.has(String(orderId))) {
    return parseProfitNumber(lookup.get(String(orderId)));
  }
  const no = String(orderNo || '')
    .trim()
    .toLowerCase();
  if (no && lookup.has(`no:${no}`)) {
    return parseProfitNumber(lookup.get(`no:${no}`));
  }
  return 0;
}

function orderMatchesId(order, orderId) {
  const oid = String(orderId || '')
    .trim()
    .toLowerCase();
  if (!oid || !order || typeof order !== 'object') return false;
  const id = String(order._id ?? order.id ?? '')
    .trim()
    .toLowerCase();
  const no = String(order.order_no ?? order.orderNo ?? '')
    .trim()
    .toLowerCase();
  return id === oid || no === oid;
}

/** Sum invoice / extra discounts across orders, de-duplicated by id. */
export function sumOrderDiscounts(orders, { orderId } = {}) {
  const oid = String(orderId || '').trim();
  const seen = new Set();
  let total = 0;
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order || typeof order !== 'object') continue;
    if (oid && !orderMatchesId(order, oid)) continue;
    const id = String(order._id ?? order.id ?? '').trim();
    const no = String(order.order_no ?? order.orderNo ?? '')
      .trim()
      .toLowerCase();
    const key = id || (no ? `no:${no}` : '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    total += getOrderDiscountAmount(order);
  }
  return total;
}

/** Orders fetched per API page when loading the profit report list. */
export const PROFIT_ORDERS_PAGE_SIZE = 500;
const ORDERS_FETCH_MAX_PAGES = 100;

/**
 * Sum order-level discounts for the selected date range (all pages).
 */
export async function fetchPeriodOrderDiscountTotal(params = {}) {
  const listParams = {
    limit: PROFIT_ORDERS_PAGE_SIZE,
    startDate: params.startDate,
    endDate: params.endDate,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...(params.productId ? { productId: params.productId } : {}),
    ...(params.orderId ? { search: params.orderId } : {}),
  };

  let page = 1;
  let totalPages = 1;
  let discount = 0;

  while (page <= totalPages) {
    const result = await fetchOrdersRequest({ ...listParams, page });
    const orders = Array.isArray(result.data) ? result.data : [];
    discount += sumOrderDiscounts(orders, { orderId: params.orderId });
    if (params.orderId && orders.some((order) => orderMatchesId(order, params.orderId))) {
      break;
    }
    totalPages = Math.max(Number(result.totalPages) || 1, 1);
    if (orders.length === 0) break;
    page += 1;
    if (page > 100) break;
  }

  return discount;
}

/**
 * Subtract order discounts from grouped line profits.
 * Gross line profit is (qty × price) − (qty × cost); net = gross − order discount.
 */
export function applyDiscountsToOrderProfitGroups(groups, orders) {
  const lookup = buildOrderDiscountLookup(orders);
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const discount = resolveOrderDiscount(lookup, group.orderId, group.orderNo);
    const orderProfit = parseProfitNumber(group.orderProfit) - discount;
    return {
      ...group,
      discount,
      orderProfit,
      marginPct:
        group.orderSubtotal !== 0 ? (orderProfit / group.orderSubtotal) * 100 : null,
    };
  });
}

export function buildProfitByOrderItemUrl(params = {}) {
  const query = new URLSearchParams();
  appendDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${PROFIT_BY_ORDER_ITEM_PATH}${qs ? `?${qs}` : ''}`;
}

export function buildOrderProfitByOrderItemUrl(params = {}) {
  const query = new URLSearchParams();
  appendDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${ORDER_PROFIT_BY_ORDER_ITEM_PATH}${qs ? `?${qs}` : ''}`;
}

export function buildOrdersWithProfitLinesUrl(params = {}) {
  const query = new URLSearchParams();
  appendListParams(query, params);
  if (params.startDate) query.set('startDate', String(params.startDate));
  if (params.endDate) query.set('endDate', String(params.endDate));
  if (params.orderId) query.set('order_id', String(params.orderId));
  const qs = query.toString();
  return `${BASE_URL}${GET_ORDER_BY_ORDER_ITEM_PATH}${qs ? `?${qs}` : ''}`;
}

/**
 * @param {unknown} result
 */
export function normalizeProfitByOrderItemPayload(result) {
  if (!result || typeof result !== 'object') return null;

  const profit = parseProfitNumber(result.profit ?? result.total_profit ?? result.totalProfit);
  const subtotal = parseProfitNumber(
    result.subtotal ?? result.total_subtotal ?? result.totalSubtotal
  );
  const lineCountRaw = result.line_count ?? result.lineCount;
  const lineCount =
    typeof lineCountRaw === 'number' && Number.isFinite(lineCountRaw)
      ? lineCountRaw
      : parseInt(String(lineCountRaw ?? ''), 10) || 0;

  const filters = result.filters && typeof result.filters === 'object' ? result.filters : {};

  const marginPct = subtotal !== 0 ? (profit / subtotal) * 100 : null;

  return {
    success: result.success !== false,
    companyId: result.company_id ?? result.companyId ?? null,
    profit,
    subtotal,
    lineCount,
    marginPct,
    filters: {
      orderId: filters.order_id ?? filters.orderId ?? null,
      productId: filters.product_id ?? filters.productId ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
      defaultRangeDays: filters.default_range_days ?? filters.defaultRangeDays ?? null,
    },
  };
}

/**
 * @param {Record<string, unknown>} item
 * @param {Record<string, unknown>} order
 */
export function normalizeProfitLineItem(item, order) {
  const product = item.product_id ?? item.productId;
  const productName =
    (typeof product === 'object' && product != null
      ? (product.product_name ?? product.name ?? product.title)
      : null) ??
    item.name ??
    item.product_name ??
    item.productName ??
    '—';

  const qty = parseProfitNumber(item.qty ?? item.quantity ?? item.qty_ordered);
  const price = parseProfitNumber(item.price ?? item.unit_price ?? item.unitPrice);
  const subtotal = parseProfitNumber(
    item.subtotal ?? item.sub_total ?? item.subTotal ?? (qty && price ? qty * price : 0)
  );
  const costPriceAtSale = parseProfitNumber(
    item.cost_price_at_sale ?? item.costPriceAtSale ?? item.cost_at_sale
  );
  const costTotal = costPriceAtSale * qty;
  const profit = parseProfitNumber(item.profit ?? subtotal - costTotal);

  const productId =
    typeof product === 'object' && product != null
      ? (product._id ?? product.id)
      : (item.product_id ?? item.productId ?? null);

  return {
    lineId: item._id ?? item.id ?? null,
    orderId: order._id ?? order.id ?? null,
    orderNo: order.order_no ?? order.orderNo ?? '—',
    productId,
    productName: String(productName || '—'),
    qty,
    price,
    subtotal,
    costPriceAtSale,
    costTotal,
    profit,
    orderDate: order.createdAt ?? order.created_at ?? order.date ?? null,
  };
}

/**
 * @param {unknown[]} orders
 */
export function flattenOrdersToProfitLines(orders) {
  if (!Array.isArray(orders)) return [];
  const rows = [];
  for (const order of orders) {
    if (!order || typeof order !== 'object') continue;
    for (const item of getOrderLineItems(order)) {
      if (!item || typeof item !== 'object') continue;
      rows.push(normalizeProfitLineItem(item, order));
    }
  }
  return rows;
}

/**
 * Client-side filters when the list API does not support product_id.
 * @param {ReturnType<typeof normalizeProfitLineItem>[]} lines
 */
export function filterProfitLines(lines, { orderId, productId } = {}) {
  let filtered = Array.isArray(lines) ? lines : [];
  const oid = String(orderId ?? '')
    .trim()
    .toLowerCase();
  if (oid) {
    filtered = filtered.filter(
      (line) =>
        String(line.orderId ?? '').toLowerCase() === oid ||
        String(line.orderNo ?? '').toLowerCase() === oid
    );
  }
  const pid = String(productId ?? '')
    .trim()
    .toLowerCase();
  if (pid) {
    filtered = filtered.filter(
      (line) =>
        String(line.productId ?? '').toLowerCase() === pid ||
        String(line.productName ?? '')
          .toLowerCase()
          .includes(pid)
    );
  }
  return filtered;
}

function summarizeProfitLines(lines) {
  const list = Array.isArray(lines) ? lines : [];
  const profit = list.reduce((sum, line) => sum + line.profit, 0);
  const subtotal = list.reduce((sum, line) => sum + line.subtotal, 0);
  const marginPct = subtotal !== 0 ? (profit / subtotal) * 100 : null;
  return {
    lineCount: list.length,
    profit,
    subtotal,
    marginPct,
  };
}

/**
 * @param {ReturnType<typeof normalizeProfitLineItem>[]} lines
 */
export function groupProfitLinesByOrder(lines) {
  const groups = [];
  const indexByOrder = new Map();

  for (const line of Array.isArray(lines) ? lines : []) {
    const key = String(line.orderId ?? line.orderNo ?? 'unknown');
    if (!indexByOrder.has(key)) {
      const group = {
        orderId: line.orderId,
        orderNo: line.orderNo,
        orderDate: line.orderDate,
        lines: [],
        orderProfit: 0,
        orderSubtotal: 0,
        discount: 0,
        itemCount: 0,
        marginPct: null,
      };
      indexByOrder.set(key, groups.length);
      groups.push(group);
    }
    const group = groups[indexByOrder.get(key)];
    group.lines.push(line);
    group.orderProfit += line.profit;
    group.orderSubtotal += line.subtotal;
  }

  for (const group of groups) {
    group.itemCount = group.lines.length;
    group.marginPct =
      group.orderSubtotal !== 0 ? (group.orderProfit / group.orderSubtotal) * 100 : null;
  }

  return groups;
}

/**
 * @param {ReturnType<typeof groupProfitLinesByOrder>} orderGroups
 */
export function summarizeOrderProfitGroups(orderGroups) {
  const groups = Array.isArray(orderGroups) ? orderGroups : [];
  const profit = groups.reduce((sum, row) => sum + row.orderProfit, 0);
  const subtotal = groups.reduce((sum, row) => sum + row.orderSubtotal, 0);
  const discount = groups.reduce((sum, row) => sum + parseProfitNumber(row.discount), 0);
  const lineCount = groups.reduce((sum, row) => sum + row.itemCount, 0);
  const marginPct = subtotal !== 0 ? (profit / subtotal) * 100 : null;
  return {
    orderCount: groups.length,
    lineCount,
    profit,
    subtotal,
    discount,
    marginPct,
  };
}

/**
 * Merge period totals from order_item and order profit paths plus page order rollup.
 */
export function mergeProfitSummaries(itemReport, orderPathReport, pageSummary, periodDiscount = 0) {
  if (!itemReport) return null;
  const orderPathProfit =
    orderPathReport?.profit != null && Number.isFinite(orderPathReport.profit)
      ? orderPathReport.profit
      : null;
  const profitsMatch =
    orderPathProfit == null || Math.abs(orderPathProfit - itemReport.profit) < 0.01;
  const discount = parseProfitNumber(periodDiscount);
  const profitAfterDiscount = parseProfitNumber(itemReport.profit) - discount;
  const subtotal = parseProfitNumber(itemReport.subtotal);
  const netMarginPct = subtotal !== 0 ? (profitAfterDiscount / subtotal) * 100 : null;

  return {
    ...itemReport,
    discount,
    profitAfterDiscount,
    netMarginPct,
    orderPathProfit,
    profitsMatch,
    pageOrderCount: pageSummary?.orderCount ?? 0,
    pageOrderProfit: pageSummary?.profit ?? 0,
    pageOrderSubtotal: pageSummary?.subtotal ?? 0,
    pageLineCount: pageSummary?.lineCount ?? 0,
    pageMarginPct: pageSummary?.marginPct ?? null,
  };
}

/**
 * @param {Record<string, unknown>} order
 */
export function normalizeOrderProfitSummary(order) {
  const lines = flattenOrdersToProfitLines([order]);
  const lineRollup = summarizeProfitLines(lines);
  const discount = getOrderDiscountAmount(order);
  // Gross from lines (qty×price − qty×cost). Prefer lines over API total_profit so we can
  // reliably subtract order-level discount without double-counting.
  const grossProfit = lines.length
    ? lineRollup.profit
    : parseProfitNumber(order.total_profit ?? order.totalProfit ?? order.profit);
  const orderProfit = grossProfit - discount;
  const itemsSubtotal = parseProfitNumber(
    order.order_items_total ?? order.orderItemsTotal ?? order.items_total ?? lineRollup.subtotal
  );
  const totalAmount = parseProfitNumber(order.total_amount ?? order.totalAmount);
  const itemCount = parseProfitNumber(order.no_of_items ?? order.noOfItems ?? lines.length);

  return {
    orderId: order._id ?? order.id ?? null,
    orderNo: order.order_no ?? order.orderNo ?? '—',
    orderDate: order.createdAt ?? order.created_at ?? order.date ?? null,
    itemCount: Number.isFinite(itemCount) ? itemCount : lines.length,
    itemsSubtotal,
    discount,
    orderProfit,
    totalAmount,
    marginPct: itemsSubtotal !== 0 ? (orderProfit / itemsSubtotal) * 100 : null,
    lines,
  };
}

/**
 * @param {unknown[]} orders
 */
export function buildOrderProfitSummaries(orders) {
  if (!Array.isArray(orders)) return [];
  return orders
    .filter((order) => order && typeof order === 'object')
    .map((order) => normalizeOrderProfitSummary(order));
}

async function parseApiError(response, fallback) {
  const text = await response.text().catch(() => '');
  let message = fallback || `Request failed (${response.status})`;
  if (text) {
    try {
      const j = JSON.parse(text);
      if (j?.message) message = j.message;
    } catch {
      const one = text.replace(/\s+/g, ' ').slice(0, 200);
      if (one) message = one;
    }
  }
  throw new Error(message);
}

/**
 * GET `order_item/profit-by-order-item` — period totals (date + stock-out rules).
 * @param {{ startDate?: string; endDate?: string; orderId?: string; productId?: string; warehouseId?: string }} [params]
 */
export async function fetchProfitByOrderItemRequest(params = {}) {
  const url = buildProfitByOrderItemUrl(params);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    await parseApiError(response, `Failed to load profit (${response.status})`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Profit request was not successful';
    throw new Error(msg);
  }

  const report = normalizeProfitByOrderItemPayload(result);
  if (!report) {
    throw new Error('Invalid profit response');
  }

  // Keep UI filters as the inclusive calendar range the caller requested.
  if (params.startDate || params.endDate) {
    report.filters = {
      ...report.filters,
      from: params.startDate ? String(params.startDate) : report.filters.from,
      to: params.endDate ? String(params.endDate) : report.filters.to,
    };
  }

  return { report, raw: result };
}

/**
 * GET `order/profit-by-order-item` — same totals handler as order_item path.
 */
export async function fetchOrderProfitByOrderItemRequest(params = {}) {
  const url = buildOrderProfitByOrderItemUrl(params);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    await parseApiError(response, `Failed to load order profit (${response.status})`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Order profit request was not successful';
    throw new Error(msg);
  }

  const report = normalizeProfitByOrderItemPayload(result);
  if (!report) {
    throw new Error('Invalid order profit response');
  }

  if (params.startDate || params.endDate) {
    report.filters = {
      ...report.filters,
      from: params.startDate ? String(params.startDate) : report.filters.from,
      to: params.endDate ? String(params.endDate) : report.filters.to,
    };
  }

  return { report, raw: result };
}

/**
 * Walk every order page in the selected range (the list API is paged).
 */
async function fetchAllOrdersForProfitReport(params = {}) {
  const listParams = {
    startDate: params.startDate,
    endDate: params.endDate,
    sortBy: params.sortBy ?? 'createdAt',
    sortOrder: params.sortOrder ?? 'desc',
    ...(params.search ? { search: params.search } : {}),
    ...(params.orderId && !params.search ? { search: params.orderId } : {}),
    ...(params.productId ? { productId: params.productId } : {}),
  };

  let page = 1;
  let pageSize = PROFIT_ORDERS_PAGE_SIZE;
  let apiTotal = 0;
  const all = [];

  while (page <= ORDERS_FETCH_MAX_PAGES) {
    const result = await fetchOrdersRequest({ ...listParams, page, limit: pageSize });
    const batch = Array.isArray(result.data) ? result.data : [];
    all.push(...batch);
    apiTotal = Math.max(Number(result.total) || 0, apiTotal);
    if (batch.length === 0) break;
    if (apiTotal > 0 && all.length >= apiTotal) break;
    if (batch.length < pageSize) {
      pageSize = batch.length;
    }
    page += 1;
  }

  return { orders: all, total: Math.max(apiTotal, all.length) };
}

/**
 * GET `order/get-order-by-order-item` — orders with nested line items and per-line profit.
 * Loads every page in the date range so the report lists all matching orders.
 * Note: does not apply the same date / inventory-movement rules as profit-by-order-item.
 */
export async function fetchOrdersWithProfitLinesRequest(params = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? PROFIT_ORDERS_PAGE_SIZE;

  const { orders, total } = await fetchAllOrdersForProfitReport(params);
  let lines = flattenOrdersToProfitLines(orders);
  lines = filterProfitLines(lines, {
    orderId: params.orderId,
    productId: params.productId,
  });
  const orderGroups = applyDiscountsToOrderProfitGroups(groupProfitLinesByOrder(lines), orders);
  const orderProfitRows = buildOrderProfitSummaries(orders).map((row) => {
    const group = orderGroups.find(
      (g) =>
        (g.orderId && g.orderId === row.orderId) ||
        String(g.orderNo).toLowerCase() === String(row.orderNo).toLowerCase()
    );
    if (!group) return row;
    return {
      ...row,
      orderProfit: group.orderProfit,
      itemsSubtotal: group.orderSubtotal,
      discount: group.discount,
      itemCount: group.itemCount,
      marginPct: group.marginPct,
      lines: group.lines,
    };
  });

  const rowCount = orderProfitRows.length;
  const safeLimit = Math.max(Number(limit) || PROFIT_ORDERS_PAGE_SIZE, 1);

  return {
    orders,
    orderProfitRows,
    orderGroups,
    lines,
    pagination: {
      page,
      limit: safeLimit,
      total: rowCount || total,
      totalPages: Math.max(1, Math.ceil((rowCount || total) / safeLimit)),
    },
    linesSummary: summarizeProfitLines(lines),
    ordersPageSummary: summarizeOrderProfitGroups(orderGroups),
  };
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Calendar ranges for the last `count` months (oldest → newest).
 * Current month ends today; prior months use the full calendar month.
 */
export function buildLastNMonthRanges(count = 3, now = new Date()) {
  const ranges = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const isCurrent = i === 0;
    const end = isCurrent
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    ranges.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()}`,
      startDate: formatDateYmd(start),
      endDate: formatDateYmd(end),
      isCurrent,
    });
  }
  return ranges;
}

/**
 * Profit totals for each of the last N calendar months.
 */
export async function fetchProfitLastNMonthsRequest(count = 3) {
  const ranges = buildLastNMonthRanges(count);
  const results = await Promise.all(
    ranges.map(async (range) => {
      try {
        const { report } = await fetchProfitByOrderItemRequest({
          startDate: range.startDate,
          endDate: range.endDate,
        });
        return {
          ...range,
          profit: parseProfitNumber(report?.profit),
          subtotal: parseProfitNumber(report?.subtotal),
          lineCount: Number(report?.lineCount) || 0,
          marginPct:
            report?.marginPct != null && Number.isFinite(report.marginPct)
              ? report.marginPct
              : report?.subtotal
                ? (parseProfitNumber(report.profit) / parseProfitNumber(report.subtotal)) * 100
                : null,
        };
      } catch {
        return {
          ...range,
          profit: 0,
          subtotal: 0,
          lineCount: 0,
          marginPct: null,
          error: true,
        };
      }
    })
  );
  return results;
}

/**
 * Calendar today + current month totals (ignores report filters).
 *
 * Today = month-to-date − month-through-yesterday so the card always reconciles
 * with "This month". Inclusive end dates are converted to API exclusive ends in
 * appendDateParams (date-only `to` is start-of-day on the backend).
 */
export async function fetchProfitQuickStatsRequest() {
  const now = new Date();
  const today = formatDateYmd(now);
  const monthStart = formatDateYmd(new Date(now.getFullYear(), now.getMonth(), 1));
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = formatDateYmd(yesterdayDate);
  const isFirstOfMonth = now.getDate() === 1;

  const [monthResult, throughYesterdayResult, last3Months] = await Promise.all([
    fetchProfitByOrderItemRequest({ startDate: monthStart, endDate: today }),
    isFirstOfMonth
      ? Promise.resolve(null)
      : fetchProfitByOrderItemRequest({ startDate: monthStart, endDate: yesterday }),
    fetchProfitLastNMonthsRequest(3),
  ]);

  const monthReport = monthResult.report;
  const monthProfit = parseProfitNumber(monthReport?.profit);
  const monthSubtotal = parseProfitNumber(monthReport?.subtotal);
  const monthLineCount = Number(monthReport?.lineCount) || 0;

  const throughYesterdayProfit = isFirstOfMonth
    ? 0
    : parseProfitNumber(throughYesterdayResult?.report?.profit);
  const throughYesterdaySubtotal = isFirstOfMonth
    ? 0
    : parseProfitNumber(throughYesterdayResult?.report?.subtotal);
  const throughYesterdayLineCount = isFirstOfMonth
    ? 0
    : Number(throughYesterdayResult?.report?.lineCount) || 0;

  const todayProfit = monthProfit - throughYesterdayProfit;
  const todaySubtotal = monthSubtotal - throughYesterdaySubtotal;
  const todayLineCount = Math.max(0, monthLineCount - throughYesterdayLineCount);

  const todayReport = {
    success: true,
    companyId: monthReport?.companyId ?? null,
    profit: todayProfit,
    subtotal: todaySubtotal,
    lineCount: todayLineCount,
    marginPct: todaySubtotal !== 0 ? (todayProfit / todaySubtotal) * 100 : null,
    filters: {
      orderId: null,
      productId: null,
      from: today,
      to: today,
      defaultRangeDays: null,
    },
  };

  // Keep current-month bar aligned with the "this month" card when present.
  const months = (Array.isArray(last3Months) ? last3Months : []).map((row) => {
    if (!row?.isCurrent) return row;
    return {
      ...row,
      profit: monthProfit,
      subtotal: monthSubtotal,
      lineCount: monthLineCount,
      marginPct:
        monthReport?.marginPct != null && Number.isFinite(monthReport.marginPct)
          ? monthReport.marginPct
          : monthSubtotal !== 0
            ? (monthProfit / monthSubtotal) * 100
            : null,
    };
  });

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = months.find((row) => row.key === lastMonthKey) || months[months.length - 2] || null;

  return {
    today: todayReport,
    month: monthReport,
    lastMonth,
    todayDate: today,
    monthStart,
    monthEnd: today,
    last3Months: months,
  };
}

/**
 * Load summary totals and paginated profit lines together.
 */
export async function fetchProfitReportBundleRequest(params = {}) {
  const [summaryResult, orderProfitResult, linesResult, quickStatsResult] = await Promise.all([
    fetchProfitByOrderItemRequest(params),
    fetchOrderProfitByOrderItemRequest(params),
    fetchOrdersWithProfitLinesRequest(params),
    fetchProfitQuickStatsRequest().catch(() => null),
  ]);
  const periodDiscount = sumOrderDiscounts(linesResult.orders, { orderId: params.orderId });

  const mergedReport = mergeProfitSummaries(
    summaryResult.report,
    orderProfitResult.report,
    linesResult.ordersPageSummary,
    periodDiscount
  );

  return {
    report: mergedReport,
    quickStats: quickStatsResult,
    summaryRaw: summaryResult.raw,
    orderProfitRaw: orderProfitResult.raw,
    lines: linesResult.lines,
    orders: linesResult.orders,
    orderProfitRows: linesResult.orderProfitRows,
    orderGroups: linesResult.orderGroups,
    linesPagination: linesResult.pagination,
    linesSummary: linesResult.linesSummary,
    ordersPageSummary: linesResult.ordersPageSummary,
  };
}
