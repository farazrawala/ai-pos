import { API_BASE_URL } from '../../config/apiConfig.js';
import { getErrorMessageFromResponse } from '../orders/ordersAPI.js';

function assertPurchaseOrderJsonSuccess(result) {
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

const ENDPOINT_PATH = 'purchase_order/get-purchase-order-by-purchase-item';

const PURCHASE_ORDER_ITEM_LIST_PATHS = [
  'purchase_order_item/get-all-active',
  'purchase_order_items/get-all-active',
];

const PO_LINE_KEYS = [
  'purchase_order_items',
  'purchaseOrderItems',
  'items',
  'lines',
  'products',
];

/** Appended on GET list/detail so vendor and actor refs are populated (e.g. Mongoose). */
const PURCHASE_ORDER_GET_POPULATE = 'vendor_id,created_by,updated_by';

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
    json.data ?? json.purchase_order ?? json.purchaseOrder ?? json.result ?? json.record;

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
    query.set('populate', PURCHASE_ORDER_GET_POPULATE);
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

  if (
    result &&
    typeof result === 'object' &&
    result.pagination &&
    typeof result.pagination === 'object'
  ) {
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

/** Bare Mongo / string id from a populated ref or primitive. */
export function poRefId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const id = raw._id ?? raw.id ?? raw.$oid;
    return id != null ? String(id).trim() : '';
  }
  return String(raw).trim();
}

function poLineArrays(order) {
  if (!order || typeof order !== 'object') return [];
  const out = [];
  for (const key of PO_LINE_KEYS) {
    const v = order[key];
    if (Array.isArray(v)) out.push(v);
  }
  return out;
}

/**
 * True when the purchase order has a line for `productId`.
 * If the record has no line items, returns false (caller should not use this as the only signal).
 */
export function purchaseOrderContainsProduct(order, productId) {
  const pid = String(productId ?? '').trim();
  if (!pid || !order || typeof order !== 'object') return false;
  if (poRefId(order.product_id ?? order.productId) === pid) return true;
  for (const lines of poLineArrays(order)) {
    for (const line of lines) {
      if (!line || typeof line !== 'object') continue;
      const linePid = poRefId(line.product_id ?? line.productId ?? line.product);
      if (linePid === pid) return true;
    }
  }
  return false;
}

function purchaseOrderIdFromItem(item) {
  if (!item || typeof item !== 'object') return '';
  return (
    poRefId(item.purchase_order_id) ||
    poRefId(item.purchaseOrderId) ||
    poRefId(item.purchase_order) ||
    poRefId(item.purchaseOrder) ||
    poRefId(item.po_id) ||
    poRefId(item.order_id) ||
    ''
  );
}

function itemHasProductId(item, productId) {
  const pid = String(productId ?? '').trim();
  if (!pid || !item || typeof item !== 'object') return false;
  return poRefId(item.product_id ?? item.productId ?? item.product) === pid;
}

/**
 * Collect unique purchase-order ids whose line items match `productId`
 * (`GET purchase_order_item/get-all-active?product_id=`).
 * @returns {Promise<string[]|null>} ids, or null if the item list endpoint is unavailable
 */
export async function fetchPurchaseOrderIdsByProductRequest(productId) {
  const id = String(productId ?? '').trim();
  if (!id) return [];

  let lastErr = null;
  for (const path of PURCHASE_ORDER_ITEM_LIST_PATHS) {
    const ids = [];
    const seen = new Set();
    let skip = 0;
    const pageLimit = 500;
    let sawOk = false;
    try {
      while (skip < 5000) {
        const query = new URLSearchParams();
        query.set('product_id', id);
        query.set('limit', String(pageLimit));
        query.set('skip', String(skip));
        query.set('populate', 'purchase_order_id,product_id');
        const url = `${BASE_URL}${path}?${query.toString()}`;
        const response = await fetch(url, { method: 'GET', headers: getJsonReadHeaders() });
        if (!response.ok) {
          const message = await getErrorMessageFromResponse(response);
          const err = new Error(message);
          err.status = response.status;
          throw err;
        }
        sawOk = true;
        const json = await response.json().catch(() => null);
        const rawList = firstArrayDeep(json);
        const rows = Array.isArray(rawList) ? rawList : [];
        if (rows.length > 0) {
          const withProductField = rows.filter(
            (row) => poRefId(row?.product_id ?? row?.productId ?? row?.product) !== ''
          );
          if (withProductField.length > 0 && !withProductField.some((row) => itemHasProductId(row, id))) {
            const ignored = new Error('product_id filter not applied');
            ignored.status = 422;
            throw ignored;
          }
        }
        const beforeCount = seen.size;
        for (const row of rows) {
          if (poRefId(row?.product_id ?? row?.productId ?? row?.product) && !itemHasProductId(row, id)) {
            continue;
          }
          const poId = purchaseOrderIdFromItem(row);
          if (poId && !seen.has(poId)) {
            seen.add(poId);
            ids.push(poId);
          }
        }
        if (rows.length === 0 || rows.length < pageLimit || seen.size === beforeCount) break;
        skip += rows.length;
      }
      return ids;
    } catch (err) {
      lastErr = err;
      if (sawOk && err?.status !== 404) {
        return null;
      }
      if (err?.status && err.status !== 404 && err.status !== 400 && err.status !== 422) {
        throw err;
      }
    }
  }
  if (lastErr?.status === 404 || lastErr?.status === 400 || lastErr?.status === 422) {
    return null;
  }
  if (lastErr) throw lastErr;
  return null;
}

function poMatchesListFilters(row, { search, startDate, endDate } = {}) {
  if (!row || typeof row !== 'object') return false;
  if (startDate || endDate) {
    const created = row.createdAt ?? row.created_at ?? '';
    const day = created ? String(created).slice(0, 10) : '';
    if (startDate && day && day < String(startDate)) return false;
    if (endDate && day && day > String(endDate)) return false;
  }
  const q = String(search ?? '').trim().toLowerCase();
  if (!q) return true;
  const vendor = row.vendor_id;
  const vendorName = vendor && typeof vendor === 'object' ? String(vendor.name ?? '') : '';
  const hay = [
    row.purchase_order_no,
    row.po_no,
    row.reference,
    row.ref_no,
    row.order_no,
    row.transaction_number,
    row.supplier_name,
    vendorName,
  ]
    .map((v) => (v == null ? '' : String(v)))
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

async function fetchPurchaseOrdersByIdsPaged(ids, { page, limit }) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const total = unique.length;
  const lim = Math.max(1, Number(limit) || 10);
  const pg = Math.max(1, Number(page) || 1);
  const totalPages = lim > 0 ? Math.ceil(total / lim) : 0;
  const start = (pg - 1) * lim;
  const pageIds = unique.slice(start, start + lim);
  const records = [];
  const concurrency = 5;
  for (let i = 0; i < pageIds.length; i += concurrency) {
    const batch = pageIds.slice(i, i + concurrency);
    const fetched = await Promise.all(
      batch.map(async (id) => {
        try {
          const raw = await fetchPurchaseOrderByIdRequest(id);
          return unwrapPurchaseOrderRecord(raw) ?? raw;
        } catch {
          return null;
        }
      })
    );
    records.push(...fetched.filter((row) => row && typeof row === 'object'));
  }
  return { data: records, total, page: pg, limit: lim, totalPages };
}

/**
 * Paginated list: `GET purchase_order/get-purchase-order-by-purchase-item`
 * with `populate=vendor_id,created_by,updated_by`, `skip`, `limit`, `search`, `sortBy`, `sortOrder`,
 * optional purchase-order id (path) and optional `product_id` (only POs that include that product).
 */
export async function fetchPurchaseOrdersListRequest(params = {}) {
  const queryParams = new URLSearchParams();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 10);
  const skip = (page - 1) * limit;
  queryParams.append('populate', PURCHASE_ORDER_GET_POPULATE);
  queryParams.append('skip', String(skip));
  queryParams.append('limit', String(limit));
  if (params.search != null && String(params.search).trim() !== '') {
    queryParams.append('search', String(params.search).trim());
  }
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));

  // Backend filters by purchase_order `_id` when id is in the path
  // (`…/get-purchase-order-by-purchase-item/:id`), not via query keys.
  const filterId = String(
    params.purchase_order_id ??
      params.filterPurchaseOrderId ??
      params.purchase_item_id ??
      params.filterPurchaseItemId ??
      ''
  ).trim();
  const productId = String(params.product_id ?? params.filterProductId ?? '').trim();

  if (productId) {
    queryParams.append('product_id', productId);
    try {
      const matchingIds = await fetchPurchaseOrderIdsByProductRequest(productId);
      if (Array.isArray(matchingIds)) {
        const ids = filterId ? matchingIds.filter((id) => id === filterId) : matchingIds;
        const needsClientFilters = Boolean(
          (params.search && String(params.search).trim()) || params.startDate || params.endDate
        );
        if (needsClientFilters && ids.length > 0 && ids.length <= 200) {
          const all = await fetchPurchaseOrdersByIdsPaged(ids, { page: 1, limit: ids.length });
          const filtered = (all.data || []).filter((row) =>
            poMatchesListFilters(row, {
              search: params.search,
              startDate: params.startDate,
              endDate: params.endDate,
            })
          );
          const total = filtered.length;
          const start = (page - 1) * limit;
          return {
            data: filtered.slice(start, start + limit),
            total,
            page,
            limit,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
          };
        }
        return fetchPurchaseOrdersByIdsPaged(ids, { page, limit });
      }
    } catch (err) {
      logPurchaseOrderModuleError('product filter via purchase_order_item failed; using list query', {
        productId,
        error: err?.message,
      });
    }
  }

  const idPath = filterId ? `/${encodeURIComponent(filterId)}` : '';

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${ENDPOINT_PATH}${idPath}${queryString ? `?${queryString}` : ''}`;

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
  const normalized = normalizePurchaseOrdersListResponse(result, { page, limit });
  if (
    productId &&
    Array.isArray(normalized.data) &&
    normalized.data.some((row) => poLineArrays(row).length > 0)
  ) {
    const filtered = normalized.data.filter((row) => purchaseOrderContainsProduct(row, productId));
    return { ...normalized, data: filtered };
  }
  return normalized;
}

/** Fetch every page matching filters (for CSV / Excel / PDF export). */
export async function fetchAllPurchaseOrdersForExportRequest(params = {}) {
  const limit = 500;
  let page = 1;
  let allData = [];
  let totalPages = 1;
  const { page: _p, limit: _l, ...baseParams } = params;

  while (page <= totalPages) {
    const result = await fetchPurchaseOrdersListRequest({ ...baseParams, page, limit });
    const batch = Array.isArray(result.data) ? result.data : [];
    allData = allData.concat(batch);
    totalPages = Math.max(result.totalPages || 1, 1);
    if (batch.length === 0) break;
    page += 1;
  }

  return enrichPurchaseOrdersForExport(allData);
}

const EXPORT_DETAIL_CONCURRENCY = 5;

async function enrichPurchaseOrderForExport(order) {
  const { documentNeedsDetailFetch } = await import('../../utils/documentExportHelpers.js');
  const { PURCHASE_ORDER_ITEM_KEYS } = await import('./purchaseOrderExportMapper.js');
  if (!documentNeedsDetailFetch(order, PURCHASE_ORDER_ITEM_KEYS)) return order;
  const id = String(order?._id ?? order?.id ?? '').trim();
  if (!id) return order;
  try {
    const raw = await fetchPurchaseOrderByIdRequest(id);
    const full = unwrapPurchaseOrderRecord(raw) ?? raw;
    return full && typeof full === 'object' ? full : order;
  } catch {
    return order;
  }
}

async function enrichPurchaseOrdersForExport(orders) {
  const result = [];
  for (let i = 0; i < orders.length; i += EXPORT_DETAIL_CONCURRENCY) {
    const batch = orders.slice(i, i + EXPORT_DETAIL_CONCURRENCY);
    const enriched = await Promise.all(batch.map(enrichPurchaseOrderForExport));
    result.push(...enriched);
  }
  return result;
}

/**
 * Unwrap single-record API envelopes.
 */
export function unwrapPurchaseOrderRecord(result) {
  if (result == null) return null;
  if (typeof result !== 'object' || Array.isArray(result)) return result;
  const r = result.data ?? result.purchase_order ?? result.purchaseOrder ?? result.record ?? result;
  if (r && typeof r === 'object' && !Array.isArray(r)) return r;
  return result;
}

/**
 * GET `purchase_order/get-purchase-order-by-purchase-item/:id?populate=vendor_id,created_by,updated_by`
 * (purchase order id in path). Response shape: `{ data: [ purchaseOrder ], ... }`.
 */
export async function fetchPurchaseOrderByIdRequest(purchaseOrderId) {
  const id = String(purchaseOrderId ?? '').trim();
  if (!id) throw new Error('Purchase order id is required');
  const qs = new URLSearchParams({ populate: PURCHASE_ORDER_GET_POPULATE }).toString();
  const url = `${BASE_URL}${ENDPOINT_PATH}/${encodeURIComponent(id)}?${qs}`;
  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getJsonReadHeaders() });
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
  const json = await response.json().catch(() => null);
  if (json && typeof json === 'object' && Array.isArray(json.data)) {
    if (json.data.length === 0) {
      const err = new Error('Purchase order not found');
      err.status = 404;
      throw err;
    }
    const first = json.data[0];
    if (first && typeof first === 'object') return first;
  }
  const unwrapped = unwrapPurchaseOrderRecord(json);
  if (unwrapped && typeof unwrapped === 'object') return unwrapped;
  return json ?? {};
}

/**
 * POST `purchase_order/purchase_order_create` — multipart form fields:
 * `vendor_id`, `description`, `ref_no`, `discount`, `shipment`, `account_id`,
 * `payment_method_accounts_id`, `amount_paid` (from UI `amount_received` / `amount_paid`),
 * `remaining_amount`, `total_amount`, `expected_delivery_date`,
 * `product_id[n]`, `qty[n]`, `price[n]`, `warehouse_id[n]`, `warehouse_inventory_id[n]` (optional),
 * `shipping_per_unit[n]`, `total_shipping[n]` (per line, same index as product rows).
 *
 * UI may send `supplier_id`, `purchase_order_no`, `notes`, and `items[]` with per-line
 * `shipping_per_unit` / `total_shipping`; those are mapped to indexed form fields.
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

  const createdAt = body.createdAt ?? body.created_at;
  if (createdAt != null && String(createdAt).trim() !== '') {
    const createdVal = String(createdAt).trim();
    form.append('createdAt', createdVal);
    form.append('created_at', createdVal);
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
    logPurchaseOrderModuleError('createPurchaseOrderRequest failed', {
      status: response.status,
      message,
    });
    throw new Error(message);
  }
  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderJsonSuccess(result);
  return result;
}

/**
 * PATCH `purchase_order/purchase_order_update/:id` — multipart form fields:
 * `name`, `email`, `phone`, `address`, `vendor_id`, `description`, `ref_no`,
 * `product_id[n]`, `qty[n]`, `price[n]`, `warehouse_id[n]`, `warehouse_inventory_id[n]` (optional),
 * `shipping_per_unit[n]`, `total_shipping[n]`, `discount`, `shipment`, `account_id`,
 * `payment_method_accounts_id`,
 * `order_status`, `amount_paid` (from UI `amount_received` / `amount_paid`), `remaining_amount`, `total_amount`
 * (same line-item shape as create).
 */
export async function updatePurchaseOrderRequest(purchaseOrderId, payload = {}) {
  const id = String(purchaseOrderId ?? '').trim();
  if (!id) throw new Error('Purchase order id is required');
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
    Object.prototype.hasOwnProperty.call(body, 'expected_delivery_date') &&
    body.expected_delivery_date != null &&
    String(body.expected_delivery_date).trim() !== ''
  ) {
    form.append('expected_delivery_date', String(body.expected_delivery_date).trim());
  }

  const createdAt = body.createdAt ?? body.created_at;
  if (createdAt != null && String(createdAt).trim() !== '') {
    const createdVal = String(createdAt).trim();
    form.append('createdAt', createdVal);
    form.append('created_at', createdVal);
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

  const url = `${BASE_URL}purchase_order/purchase_order_update/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getMultipartPostHeaders(),
      body: form,
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
  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderJsonSuccess(result);
  return result;
}

/**
 * DELETE `purchase_order/purchase_order_delete/:purchaseOrderId`
 */
export async function deletePurchaseOrderRequest(purchaseOrderId) {
  const id = String(purchaseOrderId ?? '').trim();
  if (!id) {
    throw new Error('Purchase order id is required');
  }

  const url = `${BASE_URL}purchase_order/purchase_order_delete/${encodeURIComponent(id)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: getJsonReadHeaders(),
    });
  } catch (err) {
    logPurchaseOrderModuleError('deletePurchaseOrderRequest network error', { url, id, err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logPurchaseOrderModuleError('deletePurchaseOrderRequest failed', {
      id,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json().catch(() => ({}));
  assertPurchaseOrderJsonSuccess(result);
  return result;
}
