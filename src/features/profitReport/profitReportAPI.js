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

function appendDateParams(query, params = {}) {
  if (params.startDate) {
    const start = String(params.startDate);
    query.set('from', start);
    query.set('startDate', start);
  }
  if (params.endDate) {
    const end = String(params.endDate);
    query.set('to', end);
    query.set('endDate', end);
  }
  if (params.orderId) query.set('order_id', String(params.orderId));
  if (params.productId) query.set('product_id', String(params.productId));
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
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
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
  const subtotal = parseProfitNumber(result.subtotal ?? result.total_subtotal ?? result.totalSubtotal);
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
      ? product.product_name ?? product.name ?? product.title
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
      ? product._id ?? product.id
      : item.product_id ?? item.productId ?? null;

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
  const oid = String(orderId ?? '').trim().toLowerCase();
  if (oid) {
    filtered = filtered.filter(
      (line) =>
        String(line.orderId ?? '').toLowerCase() === oid ||
        String(line.orderNo ?? '').toLowerCase() === oid
    );
  }
  const pid = String(productId ?? '').trim().toLowerCase();
  if (pid) {
    filtered = filtered.filter(
      (line) =>
        String(line.productId ?? '').toLowerCase() === pid ||
        String(line.productName ?? '').toLowerCase().includes(pid)
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
  const lineCount = groups.reduce((sum, row) => sum + row.itemCount, 0);
  const marginPct = subtotal !== 0 ? (profit / subtotal) * 100 : null;
  return {
    orderCount: groups.length,
    lineCount,
    profit,
    subtotal,
    marginPct,
  };
}

/**
 * Merge period totals from order_item and order profit paths plus page order rollup.
 */
export function mergeProfitSummaries(itemReport, orderPathReport, pageSummary) {
  if (!itemReport) return null;
  const orderPathProfit =
    orderPathReport?.profit != null && Number.isFinite(orderPathReport.profit)
      ? orderPathReport.profit
      : null;
  const profitsMatch =
    orderPathProfit == null || Math.abs(orderPathProfit - itemReport.profit) < 0.01;

  return {
    ...itemReport,
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
  const orderProfit = parseProfitNumber(
    order.total_profit ?? order.totalProfit ?? order.profit ?? lineRollup.profit
  );
  const itemsSubtotal = parseProfitNumber(
    order.order_items_total ??
      order.orderItemsTotal ??
      order.items_total ??
      lineRollup.subtotal
  );
  const totalAmount = parseProfitNumber(order.total_amount ?? order.totalAmount);
  const itemCount = parseProfitNumber(
    order.no_of_items ?? order.noOfItems ?? lines.length
  );

  return {
    orderId: order._id ?? order.id ?? null,
    orderNo: order.order_no ?? order.orderNo ?? '—',
    orderDate: order.createdAt ?? order.created_at ?? order.date ?? null,
    itemCount: Number.isFinite(itemCount) ? itemCount : lines.length,
    itemsSubtotal,
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
 * @param {{ startDate?: string; endDate?: string; orderId?: string; productId?: string }} [params]
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

  return { report, raw: result };
}

/**
 * GET `order/get-order-by-order-item` — orders with nested line items and per-line profit.
 * Note: does not apply the same date / inventory-movement rules as profit-by-order-item.
 */
export async function fetchOrdersWithProfitLinesRequest(params = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 25;

  const result = await fetchOrdersRequest({
    page,
    limit,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });

  const orders = Array.isArray(result.data) ? result.data : [];
  let lines = flattenOrdersToProfitLines(orders);
  lines = filterProfitLines(lines, {
    orderId: params.orderId,
    productId: params.productId,
  });
  const orderGroups = groupProfitLinesByOrder(lines);
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
      itemCount: group.itemCount,
      marginPct: group.marginPct,
      lines: group.lines,
    };
  });

  return {
    orders,
    orderProfitRows,
    orderGroups,
    lines,
    pagination: {
      page: result.page ?? page,
      limit: result.limit ?? limit,
      total: result.total ?? orders.length,
      totalPages: result.totalPages ?? 0,
    },
    linesSummary: summarizeProfitLines(lines),
    ordersPageSummary: summarizeOrderProfitGroups(orderGroups),
  };
}

/**
 * Load summary totals and paginated profit lines together.
 */
export async function fetchProfitReportBundleRequest(params = {}) {
  const [summaryResult, orderProfitResult, linesResult] = await Promise.all([
    fetchProfitByOrderItemRequest(params),
    fetchOrderProfitByOrderItemRequest(params),
    fetchOrdersWithProfitLinesRequest(params),
  ]);

  const mergedReport = mergeProfitSummaries(
    summaryResult.report,
    orderProfitResult.report,
    linesResult.ordersPageSummary
  );

  return {
    report: mergedReport,
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
