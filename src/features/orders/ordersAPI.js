import { API_BASE_URL } from '../../config/apiConfig.js';

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

/**
 * Readable message from a failed fetch (JSON envelope, validation errors, or plain/HTML text).
 */
async function getErrorMessageFromResponse(response) {
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

/** All order reads go through this route (paginated list without `order_item_id`, or one order when `order_item_id` is set). */
const ORDER_BY_ORDER_ITEM_PATH = 'order/get-order-by-order-item';

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
 * Load one order for the POS invoice screen from `order/get-order-by-order-item`.
 * Tries query params in order: for Mongo-like ids → `order_id`, then `order_item_id`; otherwise `order_no` then `order_item_id`.
 * Adjust param names in `attempts` if your backend uses different keys.
 */
export async function fetchOrderForInvoiceRequest(slug) {
  const id = decodeURIComponent(String(slug || '').trim());
  if (!id) {
    throw new Error('Missing order reference');
  }

  const isLikelyMongoId = /^[a-f0-9]{24}$/i.test(id);
  const attempts = isLikelyMongoId
    ? [{ order_id: id }, { order_item_id: id }]
    : [{ order_no: id }, { order_item_id: id }];

  let lastError = null;
  for (const params of attempts) {
    try {
      const q = new URLSearchParams(params);
      const url = `${BASE_URL}${ORDER_BY_ORDER_ITEM_PATH}?${q.toString()}`;
      const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });
      if (!response.ok) {
        const err = new Error(await getErrorMessageFromResponse(response));
        err.status = response.status;
        throw err;
      }
      const result = await response.json().catch(() => ({}));
      const order = extractOrderFromApiJson(result);
      if (order) return order;
      const hint =
        result && typeof result === 'object' && !Array.isArray(result)
          ? ` (top-level keys: ${Object.keys(result).join(', ')})`
          : '';
      throw new Error(`Invalid order response format${hint}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Could not load order');
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

/** Pick a stable id for the POS invoice URL from an order object. Prefer human-readable `order_no`. */
export function pickInvoiceRouteId(order) {
  if (!order || typeof order !== 'object') return '';
  const candidates = [
    order.order_no,
    order.orderNo,
    order.invoice_no,
    order.invoiceNo,
    order.reference,
    order._id,
    order.id,
  ];
  const found = candidates.find((v) => v != null && String(v).trim() !== '');
  return found != null ? String(found).trim() : '';
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
  if (payload.order_status != null) {
    form.append('order_status', String(payload.order_status));
  }
  if (payload.amount_received != null) {
    form.append('amount_received', String(payload.amount_received));
  }
  if (payload.change_given != null) {
    form.append('change_given', String(payload.change_given));
  }

  const response = await fetch(`${BASE_URL}order/order_save`, {
    method: 'POST',
    headers: getHeaders({ json: false }),
    body: form,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
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

  const response = await fetch(`${BASE_URL}order/order_update/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getHeaders({ json: false }),
    body: form,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}
