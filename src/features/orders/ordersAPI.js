import { API_BASE_URL } from '../../config/apiConfig.js';
import { createOrderSaveError } from '../../utils/posOrderErrors.js';
import {
  fetchAccountByIdRequest,
  fetchPublicAccountByIdRequest,
} from '../accounts/accountsAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

/**
 * @param {{ json?: boolean }} [options] Use `json: false` on GET (no JSON body).
 */
const getHeaders = (options = {}) => {
  const useJsonContentType = options.json !== false;
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = {};
  if (useJsonContentType) {
    headers['Content-Type'] = 'application/json';
  } else {
    headers.Accept = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

function stringifyValidationErrors(errors) {
  if (errors == null) return '';
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) {
    return errors
      .map((e) => (e && typeof e === 'object' ? e.message || e.msg : String(e)))
      .join('; ');
  }
  if (typeof errors !== 'object') return String(errors);
  const parts = [];
  for (const [k, v] of Object.entries(errors)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
    else if (v != null && typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
    else if (v != null) parts.push(`${k}: ${v}`);
  }
  return parts.join('; ') || '';
}

async function readOrderSaveFailure(response) {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  let json = null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      json = JSON.parse(trimmed);
    } catch {
      /* ignore */
    }
  }

  if (json && typeof json === 'object' && !Array.isArray(json)) {
    if (typeof json.message === 'string' && json.message) {
      throw createOrderSaveError(json.message, json);
    }
    if (
      json.error &&
      typeof json.error === 'object' &&
      typeof json.error.message === 'string'
    ) {
      throw createOrderSaveError(json.error.message, json);
    }
    if (typeof json.error === 'string' && json.error) {
      throw createOrderSaveError(json.error, json);
    }
    if (typeof json.msg === 'string' && json.msg) {
      throw createOrderSaveError(json.msg, json);
    }
    if (typeof json.detail === 'string' && json.detail) {
      throw createOrderSaveError(json.detail, json);
    }
    if (typeof json.details === 'string' && json.details.trim()) {
      throw createOrderSaveError(json.details.trim(), json);
    }
    if (json.data && typeof json.data === 'object' && typeof json.data.message === 'string') {
      throw createOrderSaveError(json.data.message, json);
    }
    const fromErrors = stringifyValidationErrors(json.errors);
    if (fromErrors) {
      throw createOrderSaveError(fromErrors, json);
    }
  }

  if (trimmed.startsWith('<')) {
    throw createOrderSaveError(`HTTP ${status} (HTML response — server error; check API logs).`, json);
  }

  const oneLine = trimmed.replace(/\s+/g, ' ');
  const message = oneLine
    ? oneLine.length > 500
      ? `${oneLine.slice(0, 500)}…`
      : oneLine
    : status === 500
      ? 'HTTP 500 — server returned an empty body (check API logs / Laravel storage/logs).'
      : `HTTP ${status}`;

  throw createOrderSaveError(message, json);
}

/**
 * Readable message from a failed fetch (JSON envelope, validation errors, or plain/HTML text).
 */
export async function getErrorMessageFromResponse(response) {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) {
    return status === 500
      ? 'HTTP 500 — server returned an empty body (check API logs / Laravel storage/logs).'
      : `HTTP ${status}`;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        if (typeof json.message === 'string' && json.message) return json.message;
        if (
          json.error &&
          typeof json.error === 'object' &&
          typeof json.error.message === 'string'
        ) {
          return json.error.message;
        }
        if (typeof json.error === 'string' && json.error) return json.error;
        if (typeof json.msg === 'string' && json.msg) return json.msg;
        if (typeof json.detail === 'string' && json.detail) return json.detail;
        if (typeof json.details === 'string' && json.details.trim()) return json.details.trim();
        if (json.data && typeof json.data === 'object' && typeof json.data.message === 'string') {
          return json.data.message;
        }
        const fromErrors = stringifyValidationErrors(json.errors);
        if (fromErrors) return fromErrors;
      }
    } catch {
      /* fall through */
    }
  }
  if (trimmed.startsWith('<')) {
    return `HTTP ${status} (HTML response — server error; check API logs).`;
  }
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
}

const TOTAL_SALES_CURRENT_MONTH_PATH = 'order/total-sales-current-month';
const SALES_LAST_30_DAYS_PATH = 'orders/sales-last-30-days';
const PEAK_SALES_HOURS_PATH = 'order/peak-sales-hours';
const TOP_SELLING_PRODUCTS_PATH = 'order/top-selling-products';
const PRODUCT_TOP_SELLING_PATH = 'product/top-selling';

/** Paginated order list (no id in path). Single-order invoice uses `ORDER_BY_ORDER_NO_PATH`. */
const ORDER_BY_ORDER_ITEM_PATH = 'order/get-order-by-order-item';
const ORDER_BY_ORDER_NO_PATH = 'order/get-order-by-order-no';

function parseOrderSalesTotals(result) {
  const raw = result?.total_amount ?? result?.totalAmount ?? result?.sales;
  const totalAmount =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseFloat(String(raw ?? '').replace(/,/g, '').trim());

  const orderCountRaw = result?.order_count ?? result?.orderCount;
  const orderCount =
    typeof orderCountRaw === 'number' && Number.isFinite(orderCountRaw)
      ? orderCountRaw
      : parseInt(String(orderCountRaw ?? ''), 10);

  return {
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    orderCount: Number.isFinite(orderCount) ? orderCount : 0,
    period: result?.period && typeof result.period === 'object' ? result.period : null,
  };
}

/**
 * GET `order/total-sales-current-month`
 * Supports flat `{ total_amount, order_count, period }` or nested
 * `{ current_month, last_month }` month blocks.
 */
export async function fetchTotalSalesCurrentMonthRequest() {
  const url = `${BASE_URL}${TOTAL_SALES_CURRENT_MONTH_PATH}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load current month sales';
    throw new Error(msg);
  }

  const currentBlock =
    result?.current_month && typeof result.current_month === 'object'
      ? result.current_month
      : result;
  const lastBlock =
    result?.last_month && typeof result.last_month === 'object' ? result.last_month : null;

  return {
    currentMonth: parseOrderSalesTotals(currentBlock),
    lastMonth: lastBlock ? parseOrderSalesTotals(lastBlock) : null,
  };
}

function parseSalesDayEntry(day) {
  if (!day || typeof day !== 'object') {
    return { date: '', totalAmount: 0, orderCount: 0 };
  }
  const amountRaw = day.total_amount ?? day.totalAmount ?? 0;
  const totalAmount =
    typeof amountRaw === 'number' && Number.isFinite(amountRaw)
      ? amountRaw
      : parseFloat(String(amountRaw ?? '').replace(/,/g, '').trim());
  const countRaw = day.order_count ?? day.orderCount ?? 0;
  const orderCount =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? countRaw
      : parseInt(String(countRaw ?? ''), 10);
  return {
    date: String(day.date ?? ''),
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    orderCount: Number.isFinite(orderCount) ? orderCount : 0,
  };
}

/**
 * GET `orders/sales-last-30-days` — daily sales for the current month (summary + days[]).
 */
export async function fetchSalesDayWiseRequest() {
  const url = `${BASE_URL}${SALES_LAST_30_DAYS_PATH}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load sales overview';
    throw new Error(msg);
  }

  const days = Array.isArray(result.days) ? result.days.map(parseSalesDayEntry) : [];
  const summary = parseOrderSalesTotals(result.summary ?? result);

  return {
    days,
    summary,
    period: result?.period && typeof result.period === 'object' ? result.period : null,
  };
}

function parsePeakSalesHourEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    return { hour: 0, hourLabel: '', totalAmount: 0, orderCount: 0 };
  }
  const hourRaw = raw.hour;
  const hour =
    typeof hourRaw === 'number' && Number.isFinite(hourRaw)
      ? hourRaw
      : parseInt(String(hourRaw ?? ''), 10);

  const amountRaw = raw.total_amount ?? raw.totalAmount;
  const totalAmount =
    typeof amountRaw === 'number' && Number.isFinite(amountRaw)
      ? amountRaw
      : parseFloat(String(amountRaw ?? '').replace(/,/g, ''));

  const countRaw = raw.order_count ?? raw.orderCount;
  const orderCount =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? countRaw
      : parseInt(String(countRaw ?? ''), 10);

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    hourLabel: String(raw.hour_label ?? raw.hourLabel ?? '').trim(),
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    orderCount: Number.isFinite(orderCount) ? orderCount : 0,
  };
}

function parsePeakSalesHoursSummary(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      totalAmount: 0,
      orderCount: 0,
      peakHour: null,
      peakHourLabel: '',
      peakTotalAmount: 0,
      peakOrderCount: 0,
      peakBy: 'order_count',
    };
  }
  const peakHourRaw = raw.peak_hour ?? raw.peakHour;
  const peakHour =
    typeof peakHourRaw === 'number' && Number.isFinite(peakHourRaw)
      ? peakHourRaw
      : parseInt(String(peakHourRaw ?? ''), 10);

  const totalAmountRaw = raw.total_amount ?? raw.totalAmount;
  const totalAmount =
    typeof totalAmountRaw === 'number' && Number.isFinite(totalAmountRaw)
      ? totalAmountRaw
      : parseFloat(String(totalAmountRaw ?? '').replace(/,/g, ''));

  const orderCountRaw = raw.order_count ?? raw.orderCount;
  const orderCount =
    typeof orderCountRaw === 'number' && Number.isFinite(orderCountRaw)
      ? orderCountRaw
      : parseInt(String(orderCountRaw ?? ''), 10);

  const peakAmountRaw = raw.peak_total_amount ?? raw.peakTotalAmount;
  const peakTotalAmount =
    typeof peakAmountRaw === 'number' && Number.isFinite(peakAmountRaw)
      ? peakAmountRaw
      : parseFloat(String(peakAmountRaw ?? '').replace(/,/g, ''));

  const peakCountRaw = raw.peak_order_count ?? raw.peakOrderCount;
  const peakOrderCount =
    typeof peakCountRaw === 'number' && Number.isFinite(peakCountRaw)
      ? peakCountRaw
      : parseInt(String(peakCountRaw ?? ''), 10);

  return {
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    orderCount: Number.isFinite(orderCount) ? orderCount : 0,
    peakHour: Number.isFinite(peakHour) ? peakHour : null,
    peakHourLabel: String(raw.peak_hour_label ?? raw.peakHourLabel ?? '').trim(),
    peakTotalAmount: Number.isFinite(peakTotalAmount) ? peakTotalAmount : 0,
    peakOrderCount: Number.isFinite(peakOrderCount) ? peakOrderCount : 0,
    peakBy: String(raw.peak_by ?? raw.peakBy ?? 'order_count').trim() || 'order_count',
  };
}

/**
 * GET `order/peak-sales-hours`
 * @param {{ period?: string, peak_by?: 'order_count'|'total_amount', from?: string, to?: string, timezone?: string }} [params]
 */
export async function fetchPeakSalesHoursRequest(params = {}) {
  const query = new URLSearchParams();
  if (params.from && params.to) {
    query.set('from', String(params.from));
    query.set('to', String(params.to));
    if (params.timezone) query.set('timezone', String(params.timezone));
  } else {
    query.set('period', String(params.period || 'last_30_days'));
  }
  if (params.peak_by) query.set('peak_by', String(params.peak_by));

  const url = `${BASE_URL}${PEAK_SALES_HOURS_PATH}?${query.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load peak sales hours';
    throw new Error(msg);
  }

  const hours = Array.isArray(result.hours) ? result.hours.map(parsePeakSalesHourEntry) : [];
  hours.sort((a, b) => a.hour - b.hour);

  return {
    hours,
    summary: parsePeakSalesHoursSummary(result.summary ?? {}),
    period: result?.period && typeof result.period === 'object' ? result.period : null,
    peakBy: String(result.peak_by ?? result.peakBy ?? params.peak_by ?? 'order_count'),
    timezone: result?.timezone ? String(result.timezone) : null,
  };
}

function parseTopSellingProductEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      productId: '',
      name: 'Product',
      code: '',
      sku: '',
      image: '',
      price: 0,
      totalQty: 0,
      totalRevenue: 0,
      totalProfit: 0,
      lineCount: 0,
    };
  }

  const qtyRaw = raw.total_qty ?? raw.totalQty ?? raw.qty;
  const totalQty =
    typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
      ? qtyRaw
      : parseFloat(String(qtyRaw ?? '').replace(/,/g, ''));

  const revenueRaw = raw.total_revenue ?? raw.totalRevenue ?? raw.amount;
  const totalRevenue =
    typeof revenueRaw === 'number' && Number.isFinite(revenueRaw)
      ? revenueRaw
      : parseFloat(String(revenueRaw ?? '').replace(/,/g, ''));

  const profitRaw = raw.total_profit ?? raw.totalProfit;
  const totalProfit =
    typeof profitRaw === 'number' && Number.isFinite(profitRaw)
      ? profitRaw
      : parseFloat(String(profitRaw ?? '').replace(/,/g, ''));

  const priceRaw = raw.product_price ?? raw.productPrice ?? raw.price;
  const price =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw)
      ? priceRaw
      : parseFloat(String(priceRaw ?? '').replace(/,/g, ''));

  const lineRaw = raw.line_count ?? raw.lineCount;
  const lineCount =
    typeof lineRaw === 'number' && Number.isFinite(lineRaw)
      ? lineRaw
      : parseInt(String(lineRaw ?? ''), 10);

  const productId = raw.product_id ?? raw.productId ?? raw._id ?? raw.id ?? '';

  return {
    productId: productId != null ? String(productId) : '',
    name: String(raw.product_name ?? raw.productName ?? raw.name ?? 'Product').trim() || 'Product',
    code: String(raw.product_code ?? raw.productCode ?? '').trim(),
    sku: String(raw.sku ?? raw.barcode ?? '').trim(),
    image: String(raw.product_image ?? raw.productImage ?? raw.image ?? '').trim(),
    price: Number.isFinite(price) ? price : 0,
    totalQty: Number.isFinite(totalQty) ? totalQty : 0,
    totalRevenue: Number.isFinite(totalRevenue) ? totalRevenue : 0,
    totalProfit: Number.isFinite(totalProfit) ? totalProfit : 0,
    lineCount: Number.isFinite(lineCount) ? lineCount : 0,
  };
}

function normalizeTopSellingProductsResponse(result, params = {}) {
  const rawList = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.products)
      ? result.products
      : [];
  return {
    products: rawList.map(parseTopSellingProductEntry),
    period: result?.period && typeof result.period === 'object' ? result.period : null,
    sortBy: String(result.sort_by ?? result.sortBy ?? params.sort_by ?? params.sortBy ?? 'qty'),
    total: Number(result?.total) || rawList.length,
    count: Number(result?.count) || rawList.length,
  };
}

function buildTopSellingProductsQuery(params = {}) {
  const query = new URLSearchParams();
  if (params.from && params.to) {
    query.set('from', String(params.from));
    query.set('to', String(params.to));
  } else if (params.period) {
    query.set('period', String(params.period));
  }
  query.set('limit', String(params.limit ?? 5));
  query.set('sort_by', String(params.sort_by ?? params.sortBy ?? 'qty'));
  return query;
}

async function fetchTopSellingProductsFromPath(path, params = {}) {
  const query = buildTopSellingProductsQuery(params);
  const url = `${BASE_URL}${path}?${query.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load top selling products';
    throw new Error(msg);
  }

  return normalizeTopSellingProductsResponse(result, params);
}

/**
 * GET `order/top-selling-products` (falls back to `product/top-selling` on 404).
 * @param {{ period?: string, sort_by?: 'qty'|'revenue', sortBy?: string, limit?: number, from?: string, to?: string }} [params]
 */
export async function fetchTopSellingProductsRequest(params = {}) {
  const paths = [TOP_SELLING_PRODUCTS_PATH, PRODUCT_TOP_SELLING_PATH];
  let lastErr = null;

  for (const path of paths) {
    try {
      return await fetchTopSellingProductsFromPath(path, params);
    } catch (e) {
      lastErr = e;
      if (e?.status === 404) continue;
      throw e;
    }
  }

  throw lastErr || new Error('Could not load top selling products');
}

const ORDER_INVOICE_UPDATE_PATH = 'order/invoice-update';

/**
 * True if `o` looks like one **order** record, not an `order_item` line or a `product` subdoc.
 * (Previously any Mongo doc with `_id` matched, so deep extraction returned the first line item and broke the invoice.)
 */
const isOrderShape = (o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;

  const has = (k) => Object.prototype.hasOwnProperty.call(o, k);
  const looksLikeOrderLine =
    has('order_id') &&
    !has('order_items') &&
    !has('orderItems') &&
    (has('product_id') || has('qty') || has('price'));
  if (looksLikeOrderLine) return false;

  const looksLikeProduct =
    (has('product_name') || has('product_code')) &&
    !has('order_items') &&
    !has('orderItems') &&
    !(o.order_no || o.orderNo);
  if (looksLikeProduct) return false;

  return Boolean(
    o.order_no ||
      o.orderNo ||
      has('order_items') ||
      has('orderItems') ||
      o.no_of_items != null ||
      o.noOfItems != null ||
      ((o._id != null || o.id != null) && (o.email != null || o.phone != null))
  );
};

/**
 * Normalized line-item array for an order (list or detail).
 * Defined early so order extraction can compare payloads by line count.
 */
export function getOrderLineItems(order) {
  if (!order || typeof order !== 'object') return [];
  let v =
    order.order_items ??
    order.orderItems ??
    order.items ??
    order.line_items ??
    order.order?.order_items ??
    order.order?.orderItems;
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) v = parsed;
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const vals = Object.values(v);
    if (vals.length === 0) return [];
    const looksLikeLineRows = vals.every((el) => el != null && typeof el === 'object');
    if (looksLikeLineRows) return vals;
  }
  return [];
}

/** Count line items from whatever shape the API returned. */
export function countOrderItems(order) {
  return getOrderLineItems(order).length;
}

/** When multiple objects match `isOrderShape`, prefer the one with the most line items (fixes invoice showing a partial order). */
const pickRichestOrder = (...candidates) => {
  const list = candidates.filter((c) => c != null && typeof c === 'object' && isOrderShape(c));
  if (!list.length) return null;
  return list.reduce((best, cur) =>
    getOrderLineItems(cur).length > getOrderLineItems(best).length ? cur : best
  );
};

/** Keys that commonly wrap a single entity in API envelopes. */
const ORDER_JSON_NEST_KEYS = [
  'data',
  'order',
  'result',
  'payload',
  'record',
  'document',
  'response',
  'body',
];

const maybeParseJsonString = (value) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return value;
  try {
    return JSON.parse(t);
  } catch {
    return value;
  }
};

/**
 * Walk nested objects / arrays to find the first value that looks like an order.
 * Handles `{ data: { order: {...} } }`, double `data`, stringified JSON, and `data: [ order ]`.
 */
const extractOrderDeep = (candidate, depth = 0) => {
  const o = maybeParseJsonString(candidate);
  if (depth > 10 || o == null) return null;
  if (typeof o !== 'object') return null;
  if (isOrderShape(o)) return o;
  if (Array.isArray(o)) {
    const fromArray = [];
    for (const el of o) {
      const found = extractOrderDeep(el, depth + 1);
      if (found) fromArray.push(found);
    }
    return pickRichestOrder(...fromArray);
  }
  const fromKeys = [];
  for (const k of ORDER_JSON_NEST_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(o, k) || o[k] == null) continue;
    const found = extractOrderDeep(o[k], depth + 1);
    if (found) fromKeys.push(found);
  }
  return pickRichestOrder(...fromKeys);
};

/**
 * Normalize list API JSON to an array of orders.
 * Supports: `data[]`, `orders[]`, single order in `data` or at root (your sample shape), `order{}`.
 */
const normalizeOrdersPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    const d = result.data;
    if (isOrderShape(d)) return [d];
  }
  if (Array.isArray(result.orders)) return result.orders;
  if (result.order && typeof result.order === 'object' && !Array.isArray(result.order)) {
    if (isOrderShape(result.order)) return [result.order];
  }
  if (Array.isArray(result.order)) return result.order;
  if (Array.isArray(result)) return result;
  if (isOrderShape(result)) return [result];
  return [];
};

export async function fetchOrdersRequest(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${ORDER_BY_ORDER_ITEM_PATH}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json();
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = normalizeOrdersPayload(result);
    const page = pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page,
      limit: pagination.limit || params.limit || 10,
      totalPages,
    };
  }

  const data = normalizeOrdersPayload(result);
  const total = result.total || data.length;
  const limit = result.limit || params.limit || 10;
  return {
    data,
    total,
    page: result.page || params.page || 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/** Fetch every page matching filters (for CSV / Excel / PDF export). */
export async function fetchAllOrdersForExportRequest(params = {}) {
  const limit = 500;
  let page = 1;
  let allData = [];
  let totalPages = 1;
  const { page: _p, limit: _l, ...baseParams } = params;

  while (page <= totalPages) {
    const result = await fetchOrdersRequest({ ...baseParams, page, limit });
    const batch = Array.isArray(result.data) ? result.data : [];
    allData = allData.concat(batch);
    totalPages = Math.max(result.totalPages || 1, 1);
    if (batch.length === 0) break;
    page += 1;
  }

  return enrichOrdersForExport(allData);
}

const EXPORT_DETAIL_CONCURRENCY = 5;

function orderNeedsDetailFetchForExport(order) {
  const lines = getOrderLineItems(order);
  if (lines.length === 0) return true;
  const expected = getNoOfItemsDisplay(order);
  const expectedCount =
    typeof expected === 'number' ? expected : parseInt(String(expected ?? ''), 10);
  if (Number.isFinite(expectedCount) && expectedCount > 0 && lines.length < expectedCount) {
    return true;
  }
  return false;
}

async function enrichOrderForExport(order) {
  if (!orderNeedsDetailFetchForExport(order)) return order;
  const id = pickInvoiceRouteId(order);
  if (!id) return order;
  try {
    const full = await fetchOrderForInvoiceRequest(id);
    return full || order;
  } catch {
    return order;
  }
}

async function enrichOrdersForExport(orders) {
  const result = [];
  for (let i = 0; i < orders.length; i += EXPORT_DETAIL_CONCURRENCY) {
    const batch = orders.slice(i, i + EXPORT_DETAIL_CONCURRENCY);
    const enriched = await Promise.all(batch.map(enrichOrderForExport));
    result.push(...enriched);
  }
  return result;
}

/**
 * GET full order for one line item id (`order_item_id`).
 * Expected body shape: `_id`, `name`, `company_id`, `email`, `phone`, `address`, `created_by`,
 * `status`, `createdAt`, `updatedAt`, `order_no`, `order_items[]` (with `product_id`, `price`, `qty`, …),
 * `no_of_items`, etc. May be returned at root, under `data`, or under `order`.
 * Query: `order_item_id` (change here if your API uses a different param or path).
 */
export async function fetchOrderByOrderItemRequest(orderItemId) {
  const id = String(orderItemId || '').trim();
  if (!id) {
    throw new Error('order_item_id is required');
  }

  const query = new URLSearchParams();
  query.set('order_item_id', id);

  const url = `${BASE_URL}${ORDER_BY_ORDER_ITEM_PATH}?${query.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  return extractOrderFromApiJson(result);
}

/** Unwrap `{ data: { … } }` (and variants) to a single order object. */
export function extractOrderFromApiJson(result) {
  const root = maybeParseJsonString(result);
  if (!root || typeof root !== 'object') return null;
  if (isOrderShape(root)) return root;
  if (root.data != null && typeof root.data === 'object') {
    const d = root.data;
    if (Array.isArray(d)) {
      const shapes = d.filter((el) => el && isOrderShape(el));
      if (shapes.length) return pickRichestOrder(...shapes);
    } else if (isOrderShape(d)) {
      return pickRichestOrder(
        d,
        d.order && typeof d.order === 'object' && !Array.isArray(d.order) ? d.order : null,
        d.result && typeof d.result === 'object' && !Array.isArray(d.result) ? d.result : null,
        d.record && typeof d.record === 'object' && !Array.isArray(d.record) ? d.record : null
      );
    }
  }
  if (
    root.order &&
    typeof root.order === 'object' &&
    !Array.isArray(root.order) &&
    isOrderShape(root.order)
  ) {
    return root.order;
  }
  return extractOrderDeep(root, 0);
}

/**
 * Load one order for the POS invoice screen.
 * GET `order/get-order-by-order-no/:id` — `id` is order `_id` or order number.
 */
export async function fetchOrderForInvoiceRequest(slug) {
  const id = decodeURIComponent(String(slug || '').trim());
  if (!id) {
    throw new Error('Missing order reference');
  }

  const url = `${BASE_URL}${ORDER_BY_ORDER_NO_PATH}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders({ json: false }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load order';
    throw new Error(msg);
  }

  const order = extractOrderFromApiJson(result);
  if (order) return order;

  const hint =
    result && typeof result === 'object' && !Array.isArray(result)
      ? ` (top-level keys: ${Object.keys(result).join(', ')})`
      : '';
  throw new Error(`Invalid order response format${hint}`);
}

const PUBLIC_ORDER_BY_ORDER_NO_PATH = 'order/public-get-order-by-order-no';

function extractCompanyFromPublicInvoiceJson(result, order) {
  if (!result || typeof result !== 'object') {
    return order?.company_id && typeof order.company_id === 'object' ? order.company_id : null;
  }
  const data = result.data && typeof result.data === 'object' ? result.data : result;
  const direct =
    (data.company && typeof data.company === 'object' ? data.company : null) ||
    (result.company && typeof result.company === 'object' ? result.company : null);
  if (direct) return direct;
  const fromOrder =
    (order?.company_id && typeof order.company_id === 'object' ? order.company_id : null) ||
    (order?.companyId && typeof order.companyId === 'object' ? order.companyId : null);
  return fromOrder;
}

function pickPaymentAccountIdFromOrder(order) {
  if (!order || typeof order !== 'object') return '';
  const payRef = order.payment_method_accounts_id;
  if (payRef && typeof payRef === 'object') {
    const nested = payRef._id ?? payRef.id;
    if (nested != null && String(nested).trim() !== '') return String(nested).trim();
  }
  return String(
    payRef ??
      order.payment_method_id ??
      order.posPayMethod ??
      order.account_id ??
      ''
  ).trim();
}

function accountNameFromRecord(account) {
  if (!account || typeof account !== 'object') return '';
  return String(account.name ?? account.accountName ?? account.account_name ?? '').trim();
}

const COMPANY_DEFAULT_ACCOUNT_LABELS = {
  default_cash_account: 'Cash',
  default_account_receivable_account: 'Accounts Receivable',
  default_account_payable_account: 'Accounts Payable',
  default_withdraw_account: 'Withdraw',
  default_sales_account: 'Sales',
  default_purchase_account: 'Purchase',
  default_expense_account: 'Expense',
  default_adjustment_account: 'Adjustment',
};

function defaultAccountIdFromRef(ref) {
  if (ref == null) return '';
  if (typeof ref === 'object') {
    const id = ref._id ?? ref.id;
    return id != null ? String(id).trim() : '';
  }
  return String(ref).trim();
}

function paymentLabelFromCompanyDefaults(order, company) {
  if (!order || !company || typeof company !== 'object') return '';
  const accountId = pickPaymentAccountIdFromOrder(order);
  if (!accountId || !/^[a-f0-9]{24}$/i.test(accountId)) return '';

  for (const [field, label] of Object.entries(COMPANY_DEFAULT_ACCOUNT_LABELS)) {
    if (defaultAccountIdFromRef(company[field]) === accountId) {
      return label;
    }
  }
  return '';
}

async function enrichPublicInvoiceOrder(order) {
  if (!order || typeof order !== 'object') return order;

  const company =
    order.company_id && typeof order.company_id === 'object' ? order.company_id : null;

  const payRef = order.payment_method_accounts_id;
  if (payRef && typeof payRef === 'object' && accountNameFromRecord(payRef)) {
    return order;
  }

  const fromCompany = paymentLabelFromCompanyDefaults(order, company);
  if (fromCompany) {
    return { ...order, payment_method_name: fromCompany };
  }

  const accountId = pickPaymentAccountIdFromOrder(order);
  if (!accountId || !/^[a-f0-9]{24}$/i.test(accountId)) return order;

  let account = await fetchPublicAccountByIdRequest(accountId);
  if (!account) {
    try {
      account = await fetchAccountByIdRequest(accountId);
    } catch {
      account = null;
    }
  }

  if (!account || typeof account !== 'object') return order;

  const accountName = accountNameFromRecord(account);
  return {
    ...order,
    payment_method_accounts_id: account,
    ...(accountName ? { payment_method_name: accountName } : {}),
  };
}

/**
 * Load one order for the public invoice page (no auth).
 * GET `order/public-get-order-by-order-no/:id`
 */
export async function fetchPublicInvoiceRequest(token) {
  const id = decodeURIComponent(String(token || '').trim());
  if (!id) {
    throw new Error('Missing invoice reference');
  }

  const query = new URLSearchParams({
    populate: 'company_id,created_by',
  });
  const url = `${BASE_URL}${PUBLIC_ORDER_BY_ORDER_NO_PATH}/${encodeURIComponent(id)}?${query}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load invoice';
    throw new Error(msg);
  }

  let order = extractOrderFromApiJson(result);
  if (!order) {
    throw new Error('Invalid invoice response format');
  }

  order = await enrichPublicInvoiceOrder(order);

  return {
    order,
    company: extractCompanyFromPublicInvoiceJson(result, order),
  };
}

/**
 * PATCH `order/invoice-update/:orderId` — sync/persist invoice (payload depends on your backend).
 */
export async function updateOrderInvoiceRequest(orderId, payload = {}) {
  const id = String(orderId || '').trim();
  if (!id) {
    throw new Error('Order id is required');
  }
  const response = await fetch(
    `${BASE_URL}${ORDER_INVOICE_UPDATE_PATH}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload && typeof payload === 'object' ? payload : {}),
    }
  );
  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/** True when `o` is an order line row (has `order_id` + line fields, not a full order header). */
const looksLikeOrderLineRow = (o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const has = (k) => Object.prototype.hasOwnProperty.call(o, k);
  return (
    has('order_id') &&
    !has('order_items') &&
    !has('orderItems') &&
    (has('product_id') || has('qty') || has('price'))
  );
};

const idFromRef = (ref) => {
  if (ref == null) return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    const id = ref._id ?? ref.id;
    return id != null ? String(id).trim() : '';
  }
  return String(ref).trim();
};

/** Resolve the parent order document `_id` (not line-item id, not order number). */
export function pickOrderDocumentId(order) {
  if (!order || typeof order !== 'object') return '';

  if (looksLikeOrderLineRow(order)) {
    return idFromRef(order.order_id ?? order.orderId);
  }

  const candidates = [order._id, order.id];
  const found = candidates.find((v) => v != null && String(v).trim() !== '');
  return found != null ? String(found).trim() : '';
}

/** Pick id for the POS invoice URL — prefer order Mongo `_id` over human-readable order number. */
export function pickInvoiceRouteId(order) {
  const docId = pickOrderDocumentId(order);
  if (docId) return docId;

  return pickOrderInvoiceNo(order);
}

/** Human-readable invoice / order number for receipts and UI (never prefers Mongo `_id`). */
export function pickOrderInvoiceNo(order) {
  if (!order || typeof order !== 'object') return '';
  const candidates = [
    order.order_no,
    order.orderNo,
    order.invoice_no,
    order.invoiceNo,
    order.ref_no,
    order.reference,
  ];
  const found = candidates.find((v) => v != null && String(v).trim() !== '');
  return found != null ? String(found).trim() : '';
}

/** Invoice number from `order_save` / create-order API envelope. */
export function pickOrderInvoiceNoFromSaveResponse(result) {
  if (!result || typeof result !== 'object') return '';

  const order = extractOrderFromSaveResponse(result);
  const fromOrder = pickOrderInvoiceNo(order);
  if (fromOrder) return fromOrder;

  const roots = [result.data, result].filter((r) => r && typeof r === 'object' && !Array.isArray(r));
  for (const root of roots) {
    const direct = pickOrderInvoiceNo(root);
    if (direct) return direct;
  }
  return '';
}

function extractOrderFromSaveResponse(result) {
  if (!result || typeof result !== 'object') return null;
  const data = result.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.order && typeof data.order === 'object') return data.order;
    if (isOrderShape(data)) return data;
  }
  if (result.order && typeof result.order === 'object') return result.order;
  if (isOrderShape(result)) return result;
  return null;
}

/**
 * Value for "No. of items" column: prefer API counters, then derived line count.
 */
export function getNoOfItemsDisplay(order) {
  if (!order || typeof order !== 'object') return '—';
  const raw =
    order.no_of_items ??
    order.noOfItems ??
    order.items_count ??
    order.order_items_count ??
    order.line_items_count;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  const fromLines = countOrderItems(order);
  return fromLines > 0 ? fromLines : '—';
}

/**
 * Create POS order from cart.
 * Backend: POST /api/order/order_save
 */
export async function createPosOrderRequest(payload = {}) {
  const form = new FormData();

  if (payload.name != null) form.append('name', String(payload.name));
  if (payload.email != null) form.append('email', String(payload.email));
  if (payload.phone != null) form.append('phone', String(payload.phone));
  if (payload.address != null) form.append('address', String(payload.address));

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  lines.forEach((line, idx) => {
    if (!line || typeof line !== 'object') return;
    if (line.productId != null) {
      form.append(`product_id[${idx}]`, String(line.productId));
    }
    if (line.qty != null) {
      form.append(`qty[${idx}]`, String(line.qty));
    }
    if (line.price != null) {
      form.append(`price[${idx}]`, String(line.price));
    }
  });

  if (payload.discount != null) {
    form.append('discount', String(payload.discount));
  }
  if (payload.shipping != null) {
    form.append('shipping', String(payload.shipping));
  }
  if (payload.shipment != null) {
    form.append('shipment', String(payload.shipment));
  }
  if (payload.order_status != null) {
    form.append('order_status', String(payload.order_status));
  }
  if (payload.amount_received != null) {
    form.append('amount_received', String(payload.amount_received));
  }
  if (payload.change_given != null) {
    form.append('change_given', String(payload.change_given));
  }
  if (payload.posPayMethod != null) {
    form.append('posPayMethod', String(payload.posPayMethod));
  }
  if (payload.payment_method_id != null) {
    form.append('payment_method_id', String(payload.payment_method_id));
  }
  if (payload.customer_id != null) {
    form.append('customer_id', String(payload.customer_id));
  }

  const response = await fetch(`${BASE_URL}order/order_save`, {
    method: 'POST',
    headers: getHeaders({ json: false }),
    body: form,
  });

  if (!response.ok) {
    await readOrderSaveFailure(response);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return { success: true };
  }

  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not save order';
    throw createOrderSaveError(msg, result);
  }

  return result;
}

/**
 * Update POS order / invoice (same multipart field shape as `order_save`).
 * Backend: PATCH /api/order/order_update/:orderId
 */
export async function updatePosOrderRequest(orderId, payload = {}) {
  const id = String(orderId || '').trim();
  if (!id) {
    throw new Error('Order id is required');
  }

  const form = new FormData();

  if (payload.name != null) form.append('name', String(payload.name));
  if (payload.email != null) form.append('email', String(payload.email));
  if (payload.phone != null) form.append('phone', String(payload.phone));
  if (payload.address != null) form.append('address', String(payload.address));

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  lines.forEach((line, idx) => {
    if (!line || typeof line !== 'object') return;
    if (line.productId != null) {
      form.append(`product_id[${idx}]`, String(line.productId));
    }
    if (line.qty != null) {
      form.append(`qty[${idx}]`, String(line.qty));
    }
    if (line.price != null) {
      form.append(`price[${idx}]`, String(line.price));
    }
  });

  if (payload.discount != null) {
    form.append('discount', String(payload.discount));
  }
  if (payload.shipping != null) {
    form.append('shipping', String(payload.shipping));
  }
  if (payload.shipment != null) {
    form.append('shipment', String(payload.shipment));
  }
  if (payload.order_status != null) {
    form.append('order_status', String(payload.order_status));
  }
  form.append(
    'amount_received',
    payload.amount_received != null && payload.amount_received !== ''
      ? String(payload.amount_received)
      : ''
  );
  form.append(
    'change_given',
    payload.change_given != null && payload.change_given !== '' ? String(payload.change_given) : ''
  );
  if (payload.posPayMethod != null) {
    form.append('posPayMethod', String(payload.posPayMethod));
  }
  if (payload.payment_method_id != null) {
    form.append('payment_method_id', String(payload.payment_method_id));
  }
  if (payload.payment_method_accounts_id != null) {
    form.append('payment_method_accounts_id', String(payload.payment_method_accounts_id));
  }
  if (payload.customer_id != null) {
    form.append('customer_id', String(payload.customer_id));
  }

  const response = await fetch(`${BASE_URL}order/order_update/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getHeaders({ json: false }),
    body: form,
  });

  if (!response.ok) {
    await readOrderSaveFailure(response);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return { success: true };
  }

  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not update order';
    throw createOrderSaveError(msg, result);
  }

  return result;
}

const ORDER_DELETE_PATH = 'order/order_delete';

/**
 * DELETE `order/order_delete/:orderId`
 */
export async function deleteOrderRequest(orderId) {
  const id = String(orderId ?? '').trim();
  if (!id) {
    throw new Error('Order id is required');
  }

  const url = `${BASE_URL}${ORDER_DELETE_PATH}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders({ json: false }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return { success: true };
  }

  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not delete order';
    throw new Error(msg);
  }

  return result;
}
