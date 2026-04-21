import { API_BASE_URL } from '../../config/apiConfig.js';
import { getErrorMessageFromResponse } from '../orders/ordersAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

const ENDPOINT_PATH = 'purchase_order/get-purchase-order-by-purchase-item';

/**
 * Query / JSON body keys to try (in order). Backends vary: snake_case, camelCase, generic `id`.
 * Override order via `.env`: `VITE_PURCHASE_ORDER_ITEM_PARAM` = single key to use only.
 */
const DEFAULT_PARAM_KEYS = ['purchase_item_id', 'purchaseItemId', 'purchase_item', 'item_id', 'id'];

const getParamKeysToTry = () => {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_PURCHASE_ORDER_ITEM_PARAM
      ? String(import.meta.env.VITE_PURCHASE_ORDER_ITEM_PARAM).trim()
      : '';
  if (fromEnv) return [fromEnv];
  return DEFAULT_PARAM_KEYS;
};

const logPurchaseOrderModuleError = (operation, details) => {
  console.error(`[Purchase order module] ${operation}`, details);
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

/** Match `ordersAPI` GET style: no JSON Content-Type on GET (some stacks reject it). */
const getJsonReadHeaders = () => {
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const getJsonWriteHeaders = () => {
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

/** FormData POST: do not set Content-Type (browser sets multipart boundary). */
const getMultipartPostHeaders = () => {
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};


/** First non-empty array found on an object (common list wrappers). */
const firstArrayDeep = (obj, depth = 0) => {
  if (obj == null || typeof obj !== 'object' || depth > 4) return null;
  if (Array.isArray(obj)) return obj.length ? obj : obj;
  const listKeys = [
    'data',
    'records',
    'rows',
    'items',
    'list',
    'results',
    'purchase_orders',
    'purchaseOrders',
    'purchase_order_items',
    'purchaseOrderItems',
  ];
  for (const k of listKeys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  for (const k of listKeys) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = firstArrayDeep(v, depth + 1);
      if (inner != null) return inner;
    }
  }
  return null;
};

/**
 * Normalize common API envelopes to a value the UI can render (object, array, or null).
 */
export const normalizePurchaseOrderByItemPayload = (json) => {
  if (json == null) return null;
  if (Array.isArray(json)) return json;
  if (typeof json !== 'object') return json;

  const direct =
    json.data ??
    json.purchase_order ??
    json.purchaseOrder ??
    json.result ??
    json.record;

  if (Array.isArray(direct)) return direct;
  if (direct != null && typeof direct === 'object') {
    const nestedList = firstArrayDeep(direct);
    if (nestedList != null) return nestedList;
    return direct;
  }

  const rootList = firstArrayDeep(json);
  if (rootList != null) return rootList;

  return json;
};

/**
 * Primary query key for the SPA URL (`/purchase-orders?...`). Defaults to first backend key we try.
 */
export const PURCHASE_ITEM_QUERY_KEY = getParamKeysToTry()[0];

async function fetchJsonOnce(method, url, init = {}) {
  let response;
  try {
    response = await fetch(url, { method, ...init });
  } catch (err) {
    logPurchaseOrderModuleError('fetch network error', { url, method, error: err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json().catch(() => null);
}

/**
 * GET/POST `purchase_order/get-purchase-order-by-purchase-item` with several param/body key names.
 *
 * @param {string} purchaseItemId
 * @returns {Promise<object|Array|null>}
 */
export const fetchPurchaseOrderByPurchaseItemRequest = async (purchaseItemId) => {
  const id = String(purchaseItemId ?? '').trim();
  if (!id) {
    throw new Error('Purchase item id is required');
  }

  const paramKeys = getParamKeysToTry();
  const baseUrl = `${BASE_URL}${ENDPOINT_PATH}`;
  let lastErr = null;

  for (const key of paramKeys) {
    const query = new URLSearchParams();
    query.set(key, id);
    const url = `${baseUrl}?${query.toString()}`;
    try {
      const result = await fetchJsonOnce('GET', url, { headers: getJsonReadHeaders() });
      const normalized = normalizePurchaseOrderByItemPayload(result);
      return normalized;
    } catch (e) {
      lastErr = e;
      const st = e?.status;
      if (st === 400 || st === 404 || st === 422) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.debug('[Purchase order module] GET try next param', { key, status: st });
        }
        continue;
      }
      throw e;
    }
  }

  for (const key of paramKeys) {
    const url = baseUrl;
    try {
      const result = await fetchJsonOnce('POST', url, {
        headers: getJsonWriteHeaders(),
        body: JSON.stringify({ [key]: id }),
      });
      const normalized = normalizePurchaseOrderByItemPayload(result);
      return normalized;
    } catch (e) {
      lastErr = e;
      const st = e?.status;
      if (st === 400 || st === 404 || st === 405 || st === 422) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.debug('[Purchase order module] POST try next param', { key, status: st });
        }
        continue;
      }
      throw e;
    }
  }

  logPurchaseOrderModuleError('fetchPurchaseOrderByPurchaseItemRequest exhausted', {
    purchaseItemId: id,
    lastError: lastErr?.message,
  });
  throw lastErr || new Error('Could not load purchase order for this item id');
};

/**
 * Normalize list API response to `{ data, total, page, limit, totalPages }` (same shapes as categories).
 * @param {unknown} result
 * @param {{ page?: number; limit?: number }} params
 */
export function normalizePurchaseOrdersListResponse(result, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 10);

  if (result && typeof result === 'object' && result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const raw =
      result.data ||
      result.purchase_orders ||
      result.purchaseOrders ||
      result.records ||
      result.rows ||
      [];
    const data = Array.isArray(raw) ? raw : [];
    const skip = Number(pagination.skip) || 0;
    const lim = Number(pagination.limit) || limit;
    const p = lim > 0 ? Math.floor(skip / lim) + 1 : page;
    const total = Number(pagination.total) || data.length;
    const totalPages = lim > 0 ? Math.ceil(total / lim) : 0;
    return {
      data,
      total,
      page: p,
      limit: lim,
      totalPages,
    };
  }

  let rows = null;
  if (Array.isArray(result)) rows = result;
  else if (result && typeof result === 'object') rows = normalizePurchaseOrderByItemPayload(result);
  if (!Array.isArray(rows)) {
    if (rows && typeof rows === 'object') rows = [rows];
    else rows = [];
  }

  const total = rows.length;
  const start = (page - 1) * limit;
  const data = rows.slice(start, start + limit);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return { data, total, page, limit, totalPages };
}

/**
 * Paginated list: `GET purchase_order/get-purchase-order-by-purchase-item`
 * with `skip`, `limit`, `search`, `sortBy`, `sortOrder`, and optional purchase-item filter.
 */
export async function fetchPurchaseOrdersListRequest(params = {}) {
  const queryParams = new URLSearchParams();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 10);
  const skip = (page - 1) * limit;
  queryParams.append('skip', String(skip));
  queryParams.append('limit', String(limit));
  if (params.search != null && String(params.search).trim() !== '') {
    queryParams.append('search', String(params.search).trim());
  }
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const filterId = params.purchase_item_id ?? params.filterPurchaseItemId;
  if (filterId != null && String(filterId).trim() !== '') {
    queryParams.append(getParamKeysToTry()[0], String(filterId).trim());
  }

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${ENDPOINT_PATH}${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getJsonReadHeaders() });
  } catch (err) {
    logPurchaseOrderModuleError('fetchPurchaseOrdersListRequest network error', { url, err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderModuleError('fetchPurchaseOrdersListRequest failed', {
      status: response.status,
      message,
      url,
    });
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const result = await response.json().catch(() => null);
  return normalizePurchaseOrdersListResponse(result, { page, limit });
}

/**
 * Unwrap single-record API envelopes.
 */
export function unwrapPurchaseOrderRecord(result) {
  if (result == null) return null;
  if (typeof result !== 'object' || Array.isArray(result)) return result;
  const r =
    result.data ??
    result.purchase_order ??
    result.purchaseOrder ??
    result.record ??
    result;
  if (r && typeof r === 'object' && !Array.isArray(r)) return r;
  return result;
}

/**
 * GET `purchase_order/get/:id`
 */
export async function fetchPurchaseOrderByIdRequest(purchaseOrderId) {
  const id = String(purchaseOrderId ?? '').trim();
  if (!id) throw new Error('Purchase order id is required');
  const url = `${BASE_URL}purchase_order/get/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getJsonWriteHeaders() });
  } catch (err) {
    logPurchaseOrderModuleError('fetchPurchaseOrderByIdRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderModuleError('fetchPurchaseOrderByIdRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  return response.json().catch(() => ({}));
}

/**
 * POST `purchase_order/purchase_order_create` — multipart form fields:
 * `vendor_id`, `description`, `ref_no`, `product_id[n]`, `qty[n]`, `price[n]`
 * (same line-item shape as POS `order/order_save`).
 *
 * UI may still send `supplier_id`, `purchase_order_no`, `notes`, and `items[]`
 * with `{ product_id, qty, price }`; those are mapped here.
 */
export async function createPurchaseOrderRequest(payload = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const form = new FormData();

  const vendorId = String(body.vendor_id ?? body.supplier_id ?? '').trim();
  if (vendorId) form.append('vendor_id', vendorId);

  const description = body.description ?? body.notes;
  if (description != null && String(description).trim() !== '') {
    form.append('description', String(description));
  }

  const refNo = body.ref_no ?? body.purchase_order_no;
  if (refNo != null && String(refNo).trim() !== '') {
    form.append('ref_no', String(refNo).trim());
  }

  const rawLines = Array.isArray(body.lines)
    ? body.lines
    : Array.isArray(body.items)
      ? body.items
      : [];

  let idx = 0;
  rawLines.forEach((line) => {
    if (!line || typeof line !== 'object') return;
    const productId = String(line.productId ?? line.product_id ?? '').trim();
    if (!productId) return;
    const qty = line.qty;
    const price = line.price ?? line.rate;
    form.append(`product_id[${idx}]`, productId);
    if (qty != null && qty !== '') form.append(`qty[${idx}]`, String(qty));
    if (price != null && price !== '') form.append(`price[${idx}]`, String(price));
    idx += 1;
  });

  const url = `${BASE_URL}purchase_order/purchase_order_create`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getMultipartPostHeaders(),
      body: form,
    });
  } catch (err) {
    logPurchaseOrderModuleError('createPurchaseOrderRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderModuleError('createPurchaseOrderRequest failed', { status: response.status, message });
    throw new Error(message);
  }
  return response.json().catch(() => ({}));
}

/**
 * PATCH `purchase_order/update/:id` — JSON body.
 */
export async function updatePurchaseOrderRequest(purchaseOrderId, payload = {}) {
  const id = String(purchaseOrderId ?? '').trim();
  if (!id) throw new Error('Purchase order id is required');
  const url = `${BASE_URL}purchase_order/update/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getJsonWriteHeaders(),
      body: JSON.stringify(payload && typeof payload === 'object' ? payload : {}),
    });
  } catch (err) {
    logPurchaseOrderModuleError('updatePurchaseOrderRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderModuleError('updatePurchaseOrderRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  return response.json().catch(() => ({}));
}

