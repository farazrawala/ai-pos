import { API_BASE_URL } from '../../config/apiConfig.js';
import { getErrorMessageFromResponse } from '../orders/ordersAPI.js';

function assertPurchaseOrderReturnJsonSuccess(result) {
  if (result == null || typeof result !== 'object' || Array.isArray(result)) return;
  if (Object.prototype.hasOwnProperty.call(result, 'success') && result.success === false) {
    const msg =
      (typeof result.error === 'string' && result.error.trim()) ||
      (typeof result.details === 'string' && result.details.trim()) ||
      (typeof result.message === 'string' && result.message.trim()) ||
      `Request failed (${result.status ?? 'error'})`;
    throw new Error(msg);
  }
}

const BASE_URL = `${API_BASE_URL}/`;

const ENDPOINT_PATH = 'purchase_order_return/get-purchase-order-return-by-purchase-item';
const LIST_ALL_ACTIVE_PATH = 'purchase_return/get-all-active';
const GET_BY_RETURN_NO_PATH = 'purchase_return/get-purchase-return-by-return-no';

/** Appended on GET list/detail for this route so `vendor_id` is populated (e.g. Mongoose). */
const PURCHASE_RETURN_GET_POPULATE = 'vendor_id';
/** @deprecated use PURCHASE_RETURN_GET_POPULATE */
const PURCHASE_ORDER_GET_POPULATE = PURCHASE_RETURN_GET_POPULATE;

/**
 * Query / JSON body keys to try (in order). Backends vary: snake_case, camelCase, generic `id`.
 * Override order via `.env`: `VITE_PURCHASE_ORDER_RETURN_ITEM_PARAM` = single key to use only.
 */
const DEFAULT_PARAM_KEYS = ['purchase_item_id', 'purchaseItemId', 'purchase_item', 'item_id', 'id'];

const getParamKeysToTry = () => {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_PURCHASE_ORDER_RETURN_ITEM_PARAM
      ? String(import.meta.env.VITE_PURCHASE_ORDER_RETURN_ITEM_PARAM).trim()
      : '';
  if (fromEnv) return [fromEnv];
  return DEFAULT_PARAM_KEYS;
};

const logPurchaseOrderReturnModuleError = (operation, details) => {
  console.error(`[Purchase order return module] ${operation}`, details);
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
    'purchase_order_returns',
    'purchaseOrderReturns',
    'purchase_returns',
    'purchaseReturns',
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
export const normalizePurchaseOrderReturnByItemPayload = (json) => {
  if (json == null) return null;
  if (Array.isArray(json)) return json;
  if (typeof json !== 'object') return json;

  const direct =
    json.data ??
    json.purchase_order_return ??
    json.purchaseOrderReturn ??
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
 * Primary query key for the SPA URL (`/purchase-order-returns?...`). Defaults to first backend key we try.
 */
export const PURCHASE_ITEM_QUERY_KEY = getParamKeysToTry()[0];

async function fetchJsonOnce(method, url, init = {}) {
  let response;
  try {
    response = await fetch(url, { method, ...init });
  } catch (err) {
    logPurchaseOrderReturnModuleError('fetch network error', { url, method, error: err });
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
 * GET/POST `purchase_order_return/get-purchase-order-return-by-purchase-item` with several param/body key names.
 *
 * @param {string} purchaseItemId
 * @returns {Promise<object|Array|null>}
 */
export const fetchPurchaseOrderReturnByPurchaseItemRequest = async (purchaseItemId) => {
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
    query.set('populate', PURCHASE_RETURN_GET_POPULATE);
    const url = `${baseUrl}?${query.toString()}`;
    try {
      const result = await fetchJsonOnce('GET', url, { headers: getJsonReadHeaders() });
      const normalized = normalizePurchaseOrderReturnByItemPayload(result);
      return normalized;
    } catch (e) {
      lastErr = e;
      const st = e?.status;
      if (st === 400 || st === 404 || st === 422) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.debug('[Purchase order return module] GET try next param', { key, status: st });
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
      const normalized = normalizePurchaseOrderReturnByItemPayload(result);
      return normalized;
    } catch (e) {
      lastErr = e;
      const st = e?.status;
      if (st === 400 || st === 404 || st === 405 || st === 422) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.debug('[Purchase order return module] POST try next param', { key, status: st });
        }
        continue;
      }
      throw e;
    }
  }

  logPurchaseOrderReturnModuleError('fetchPurchaseOrderReturnByPurchaseItemRequest exhausted', {
    purchaseItemId: id,
    lastError: lastErr?.message,
  });
  throw lastErr || new Error('Could not load purchase order return for this item id');
};

/**
 * Normalize list API response to `{ data, total, page, limit, totalPages }` (same shapes as categories).
 * @param {unknown} result
 * @param {{ page?: number; limit?: number }} params
 */
export function normalizePurchaseOrderReturnsListResponse(result, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 10);

  if (
    result &&
    typeof result === 'object' &&
    result.pagination &&
    typeof result.pagination === 'object'
  ) {
    const pagination = result.pagination;
    const raw =
      result.data ||
      result.purchase_returns ||
      result.purchaseReturns ||
      result.purchase_order_returns ||
      result.purchaseOrderReturns ||
      result.purchase_orders ||
      result.purchaseOrders ||
      result.records ||
      result.rows ||
      [];
    const data = Array.isArray(raw) ? raw : [];
    const skip = Number(pagination.skip) || 0;
    const apiLimit = pagination.limit;
    const lim =
      apiLimit != null && Number(apiLimit) > 0 ? Number(apiLimit) : Math.max(1, Number(params.limit) || 10);
    const total = Number(pagination.total ?? data.length ?? 0);
    const p =
      apiLimit != null && Number(apiLimit) > 0
        ? Math.max(1, Math.floor(skip / lim) + 1)
        : Math.max(1, Number(params.page) || 1);

    if (apiLimit == null || Number(apiLimit) <= 0) {
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.max(1, Number(params.limit) || 10);
      const start = (page - 1) * limit;
      const pagedData = data.slice(start, start + limit);
      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
      return {
        data: pagedData,
        total,
        page,
        limit,
        totalPages,
      };
    }

    const totalPages = lim > 0 ? Math.ceil(total / lim) : total > 0 ? 1 : 0;
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
  else if (result && typeof result === 'object') rows = normalizePurchaseOrderReturnByItemPayload(result);
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
 * Paginated list: `GET purchase_return/get-all-active`
 * with optional `populate=vendor_id`, `skip`, `limit`, `search`, `sortBy`, `sortOrder`.
 */
export async function fetchPurchaseOrderReturnsListRequest(params = {}) {
  const queryParams = new URLSearchParams();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 10);
  const skip = (page - 1) * limit;
  queryParams.append('populate', PURCHASE_RETURN_GET_POPULATE);
  queryParams.append('skip', String(skip));
  queryParams.append('limit', String(limit));
  if (params.search != null && String(params.search).trim() !== '') {
    queryParams.append('search', String(params.search).trim());
  }
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${LIST_ALL_ACTIVE_PATH}${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getJsonReadHeaders() });
  } catch (err) {
    logPurchaseOrderReturnModuleError('fetchPurchaseOrderReturnsListRequest network error', { url, err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderReturnModuleError('fetchPurchaseOrderReturnsListRequest failed', {
      status: response.status,
      message,
      url,
    });
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const result = await response.json().catch(() => null);
  assertPurchaseOrderReturnJsonSuccess(result);
  return normalizePurchaseOrderReturnsListResponse(result, { page, limit });
}

/**
 * Unwrap single-record API envelopes.
 */
export function unwrapPurchaseOrderReturnRecord(result) {
  if (result == null) return null;
  if (typeof result !== 'object' || Array.isArray(result)) return result;
  const r =
    result.data ??
    result.purchase_return ??
    result.purchaseReturn ??
    result.purchase_order_return ??
    result.purchaseOrderReturn ??
    result.purchase_order ??
    result.purchaseOrder ??
    result.record ??
    result;
  if (r && typeof r === 'object' && !Array.isArray(r)) return r;
  return result;
}

/**
 * GET `purchase_return/get-purchase-return-by-return-no/:id?populate=vendor_id`
 * — `id` is purchase return `_id` or `purchase_return_no`.
 */
export async function fetchPurchaseOrderReturnByIdRequest(purchaseOrderReturnId) {
  const id = String(purchaseOrderReturnId ?? '').trim();
  if (!id) throw new Error('Purchase order return id is required');
  const qs = new URLSearchParams({ populate: PURCHASE_RETURN_GET_POPULATE }).toString();
  const url = `${BASE_URL}${GET_BY_RETURN_NO_PATH}/${encodeURIComponent(id)}?${qs}`;
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getJsonReadHeaders() });
  } catch (err) {
    logPurchaseOrderReturnModuleError('fetchPurchaseOrderReturnByIdRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderReturnModuleError('fetchPurchaseOrderReturnByIdRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  const json = await response.json().catch(() => null);
  assertPurchaseOrderReturnJsonSuccess(json);
  if (json && typeof json === 'object' && Array.isArray(json.data)) {
    if (json.data.length === 0) {
      const err = new Error('Purchase order return not found');
      err.status = 404;
      throw err;
    }
    const first = json.data[0];
    if (first && typeof first === 'object') return first;
  }
  const unwrapped = unwrapPurchaseOrderReturnRecord(json);
  if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) return unwrapped;
  if (json && typeof json === 'object' && !Array.isArray(json)) return json;
  return json ?? {};
}

/**
 * POST `purchase_return/purchase_return_create` — multipart form fields:
 * `vendor_id`, `description`, `ref_no`, `discount`, `shipment`, `account_id`,
 * `payment_method_accounts_id`, `amount_paid` (from UI `amount_received` / `amount_paid`),
 * `remaining_amount`, `total_amount`, `expected_delivery_date`,
 * `product_id[n]`, `qty[n]`, `price[n]`, `warehouse_id[n]`, `warehouse_inventory_id[n]` (optional),
 * `shipping_per_unit[n]`, `total_shipping[n]` (per line, same index as product rows).
 *
 * UI may send `supplier_id`, `purchase_order_no`, `notes`, and `items[]` with per-line
 * `shipping_per_unit` / `total_shipping`; those are mapped to indexed form fields.
 */
export async function createPurchaseOrderReturnRequest(payload = {}) {
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

  if (Object.prototype.hasOwnProperty.call(body, 'discount')) {
    const d = body.discount == null ? '0' : String(body.discount).trim();
    form.append('discount', d === '' ? '0' : d);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'shipment') ||
    Object.prototype.hasOwnProperty.call(body, 'shipping')
  ) {
    const shipmentVal = body.shipment ?? body.shipping;
    const s =
      shipmentVal == null || String(shipmentVal).trim() === '' ? '0' : String(shipmentVal).trim();
    form.append('shipment', s);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'expected_delivery_date') &&
    body.expected_delivery_date != null &&
    String(body.expected_delivery_date).trim() !== ''
  ) {
    form.append('expected_delivery_date', String(body.expected_delivery_date).trim());
  }

  const paymentMethodAccountId = String(
    body.payment_method_accounts_id ?? body.account_id ?? ''
  ).trim();
  if (paymentMethodAccountId) {
    form.append('payment_method_accounts_id', paymentMethodAccountId);
    form.append('account_id', paymentMethodAccountId);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'amount_paid') ||
    Object.prototype.hasOwnProperty.call(body, 'amount_received')
  ) {
    const v = body.amount_paid ?? body.amount_received;
    form.append('amount_paid', v == null ? '' : String(v));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'remaining_amount')) {
    const r = body.remaining_amount == null ? '0' : String(body.remaining_amount).trim();
    form.append('remaining_amount', r === '' ? '0' : r);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'total_amount') ||
    Object.prototype.hasOwnProperty.call(body, 'total')
  ) {
    const t = body.total_amount ?? body.total;
    const s = t == null || String(t).trim() === '' ? '0' : String(t).trim();
    form.append('total_amount', s);
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
    const warehouseId = String(line.warehouseId ?? line.warehouse_id ?? '').trim();
    form.append(`product_id[${idx}]`, productId);
    if (qty != null && qty !== '') form.append(`qty[${idx}]`, String(qty));
    if (price != null && price !== '') form.append(`price[${idx}]`, String(price));
    if (warehouseId) form.append(`warehouse_id[${idx}]`, warehouseId);
    const warehouseInventoryId = String(
      line.warehouse_inventory_id ?? line.warehouseInventoryId ?? ''
    ).trim();
    if (warehouseInventoryId) {
      form.append(`warehouse_inventory_id[${idx}]`, warehouseInventoryId);
    }
    const spu = line.shipping_per_unit ?? line.shippingPerUnit;
    const ts = line.total_shipping ?? line.totalShipping;
    const spuN =
      spu == null || spu === ''
        ? 0
        : (() => {
            const n = Number(spu);
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
          })();
    const tsN =
      ts == null || ts === ''
        ? 0
        : (() => {
            const n = Number(ts);
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
          })();
    form.append(`shipping_per_unit[${idx}]`, String(spuN));
    form.append(`total_shipping[${idx}]`, String(tsN));
    idx += 1;
  });

  const url = `${BASE_URL}purchase_return/purchase_return_create`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getMultipartPostHeaders(),
      body: form,
    });
  } catch (err) {
    logPurchaseOrderReturnModuleError('createPurchaseOrderReturnRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderReturnModuleError('createPurchaseOrderReturnRequest failed', {
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderReturnJsonSuccess(result);
  return result;
}

/**
 * PATCH `purchase_order_return/purchase_order_return_update/:id` — multipart form fields:
 * `name`, `email`, `phone`, `address`, `vendor_id`, `description`, `ref_no`,
 * `product_id[n]`, `qty[n]`, `price[n]`, `warehouse_id[n]`, `warehouse_inventory_id[n]` (optional),
 * `shipping_per_unit[n]`, `total_shipping[n]`, `discount`, `shipment`, `account_id`,
 * `payment_method_accounts_id`,
 * `order_status`, `amount_paid` (from UI `amount_received` / `amount_paid`), `remaining_amount`, `total_amount`
 * (same line-item shape as create).
 */
export async function updatePurchaseOrderReturnRequest(purchaseOrderReturnId, payload = {}) {
  const id = String(purchaseOrderReturnId ?? '').trim();
  if (!id) throw new Error('Purchase order return id is required');
  const body = payload && typeof payload === 'object' ? payload : {};
  const form = new FormData();

  const appendTrimmed = (key, val) => {
    if (val == null) return;
    const s = String(val).trim();
    if (s !== '') form.append(key, s);
  };

  appendTrimmed('name', body.name);
  appendTrimmed('email', body.email);
  appendTrimmed('phone', body.phone);
  appendTrimmed('address', body.address);

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

  if (body.discount != null && String(body.discount).trim() !== '') {
    form.append('discount', String(body.discount).trim());
  }

  const shipmentVal = body.shipment ?? body.shipping;
  if (shipmentVal != null && String(shipmentVal).trim() !== '') {
    form.append('shipment', String(shipmentVal).trim());
  }

  const paymentMethodAccountId = String(
    body.payment_method_accounts_id ?? body.account_id ?? ''
  ).trim();
  if (paymentMethodAccountId) {
    form.append('payment_method_accounts_id', paymentMethodAccountId);
    form.append('account_id', paymentMethodAccountId);
  }

  if (body.order_status != null && String(body.order_status).trim() !== '') {
    form.append('order_status', String(body.order_status).trim());
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'amount_paid') ||
    Object.prototype.hasOwnProperty.call(body, 'amount_received')
  ) {
    const v = body.amount_paid ?? body.amount_received;
    form.append('amount_paid', v == null ? '' : String(v));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'remaining_amount')) {
    const r = body.remaining_amount == null ? '0' : String(body.remaining_amount).trim();
    form.append('remaining_amount', r === '' ? '0' : r);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'total_amount') ||
    Object.prototype.hasOwnProperty.call(body, 'total')
  ) {
    const t = body.total_amount ?? body.total;
    const s = t == null || String(t).trim() === '' ? '0' : String(t).trim();
    form.append('total_amount', s);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'change_given')) {
    form.append('change_given', body.change_given == null ? '' : String(body.change_given));
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
    const warehouseId = String(line.warehouseId ?? line.warehouse_id ?? '').trim();
    form.append(`product_id[${idx}]`, productId);
    if (qty != null && qty !== '') form.append(`qty[${idx}]`, String(qty));
    if (price != null && price !== '') form.append(`price[${idx}]`, String(price));
    if (warehouseId) form.append(`warehouse_id[${idx}]`, warehouseId);
    const warehouseInventoryId = String(
      line.warehouse_inventory_id ?? line.warehouseInventoryId ?? ''
    ).trim();
    if (warehouseInventoryId) {
      form.append(`warehouse_inventory_id[${idx}]`, warehouseInventoryId);
    }
    const spu = line.shipping_per_unit ?? line.shippingPerUnit;
    const ts = line.total_shipping ?? line.totalShipping;
    const spuN =
      spu == null || spu === ''
        ? 0
        : (() => {
            const n = Number(spu);
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
          })();
    const tsN =
      ts == null || ts === ''
        ? 0
        : (() => {
            const n = Number(ts);
            return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
          })();
    form.append(`shipping_per_unit[${idx}]`, String(spuN));
    form.append(`total_shipping[${idx}]`, String(tsN));
    idx += 1;
  });

  const url = `${BASE_URL}purchase_order_return/purchase_order_return_update/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getMultipartPostHeaders(),
      body: form,
    });
  } catch (err) {
    logPurchaseOrderReturnModuleError('updatePurchaseOrderReturnRequest network error', { url, err });
    throw err;
  }
  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderReturnModuleError('updatePurchaseOrderReturnRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderReturnJsonSuccess(result);
  return result;
}

/**
 * DELETE `purchase_return/purchase_return_delete/:purchaseOrderReturnId`
 */
export async function deletePurchaseOrderReturnRequest(purchaseOrderReturnId) {
  const id = String(purchaseOrderReturnId ?? '').trim();
  if (!id) {
    throw new Error('Purchase order return id is required');
  }

  const url = `${BASE_URL}purchase_return/purchase_return_delete/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: getJsonReadHeaders(),
    });
  } catch (err) {
    logPurchaseOrderReturnModuleError('deletePurchaseOrderReturnRequest network error', { url, id, err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderReturnModuleError('deletePurchaseOrderReturnRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderReturnJsonSuccess(result);
  return result;
}
