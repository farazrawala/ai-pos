import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

/** All order reads go through this route (paginated list without `order_item_id`, or one order when `order_item_id` is set). */
const ORDER_BY_ORDER_ITEM_PATH = 'order/get-order-by-order-item';

/** True if `o` looks like one order record (matches get-order-by-order-item payload). */
const isOrderShape = (o) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  (Boolean(o._id) ||
    Boolean(o.order_no) ||
    Array.isArray(o.order_items) ||
    o.no_of_items != null);

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
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data) && isOrderShape(result.data)) {
    return result.data;
  }
  if (Array.isArray(result.data) && result.data.length === 1 && isOrderShape(result.data[0])) {
    return result.data[0];
  }
  if (result.order && typeof result.order === 'object' && !Array.isArray(result.order) && isOrderShape(result.order)) {
    return result.order;
  }
  if (isOrderShape(result)) return result;
  return null;
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
 * Normalized line-item array for an order (list or detail).
 * Handles `order_items`, camelCase `orderItems`, `items`, `line_items`, and plain objects of subdocs.
 */
export function getOrderLineItems(order) {
  if (!order || typeof order !== 'object') return [];
  let v = order.order_items ?? order.orderItems ?? order.items ?? order.line_items;
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
