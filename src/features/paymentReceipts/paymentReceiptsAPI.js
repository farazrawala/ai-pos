import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const PAYMENT_RECEIPT_SAVE_PATH = 'payment_receipt/save';
const PAYMENT_RECEIPT_LIST_PATH = 'payment_receipt/get-all-active';

/** Comma-separated Mongoose-style paths for GET list (names on rows). */
const PAYMENT_RECEIPT_LIST_POPULATE = 'payment_mode,user_id';

const logPaymentReceiptModuleError = (operation, details) => {
  console.error(`[Payment receipt module] ${operation}`, details);
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function parseErrorMessage(response) {
  const body = await response.json().catch(() => ({}));
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  return `HTTP ${response.status}`;
}

/**
 * GET `api/payment_receipt/get-all-active` — paginated list (skip/limit/search/sort).
 * Sends `populate=payment_mode,user_id` so rows can include mode name and user name.
 * Normalizes `{ data, pagination }` including backends that return `pagination.limit: null`.
 */
export async function fetchPaymentReceiptsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set(
    'populate',
    params.populate != null && String(params.populate).trim()
      ? String(params.populate).trim()
      : PAYMENT_RECEIPT_LIST_POPULATE
  );
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const qs = queryParams.toString();
  const url = `${BASE_URL}${PAYMENT_RECEIPT_LIST_PATH}${qs ? `?${qs}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logPaymentReceiptModuleError('fetchPaymentReceiptsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logPaymentReceiptModuleError('fetchPaymentReceiptsRequest failed', {
      status: response.status,
      params,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();

  if (result.pagination && typeof result.pagination === 'object') {
    const p = result.pagination;
    const rows = Array.isArray(result.data) ? result.data : [];
    const requestedLimit = params.limit || 10;
    const apiLimit = p.limit != null && p.limit > 0 ? p.limit : null;
    const effectiveLimit =
      apiLimit ?? (p.total > 0 && p.count === p.total ? p.total : requestedLimit);
    const limitForMath = effectiveLimit > 0 ? effectiveLimit : requestedLimit;
    const skip = typeof p.skip === 'number' ? p.skip : 0;
    const total = typeof p.total === 'number' ? p.total : rows.length;
    const page =
      limitForMath > 0 ? Math.floor(skip / limitForMath) + 1 : params.page || 1;
    const totalPages =
      total === 0
        ? 0
        : limitForMath > 0
          ? Math.ceil(total / limitForMath)
          : 1;

    return {
      data: rows,
      total,
      page,
      limit: limitForMath,
      totalPages,
    };
  }

  if (Array.isArray(result.data)) {
    return {
      data: result.data,
      total: result.total ?? result.data.length,
      page: result.page || params.page || 1,
      limit: result.limit || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total ?? result.data.length) / (result.limit || params.limit || 10)
        ),
    };
  }

  return {
    data: [],
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  };
}

/** Mongo ref or plain id → id string for forms and API payloads. */
export function paymentReceiptRefId(ref) {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    const id = ref._id ?? ref.id;
    if (id != null) return String(id);
  }
  return String(ref);
}

/**
 * GET `api/payment_receipt/get/:id?populate=...`
 * Response shape: `{ data: { ... } }` or `{ ... }` root document.
 */
export async function fetchPaymentReceiptByIdRequest(receiptId) {
  const id = String(receiptId ?? '').trim();
  if (!id) throw new Error('Missing receipt id');

  const qs = new URLSearchParams();
  qs.set('populate', PAYMENT_RECEIPT_LIST_POPULATE);
  const url = `${BASE_URL}payment_receipt/get/${encodeURIComponent(id)}?${qs}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logPaymentReceiptModuleError('fetchPaymentReceiptByIdRequest network error', { id, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logPaymentReceiptModuleError('fetchPaymentReceiptByIdRequest failed', {
      id,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  const doc = result?.data != null && typeof result.data === 'object' ? result.data : result;
  return doc;
}

/**
 * PATCH `api/payment_receipt/update_receipt/:id` — update an existing receipt (id in URL only).
 */
export async function updatePaymentReceiptRequest(receiptId, payload = {}) {
  const id = String(receiptId ?? '').trim();
  if (!id) throw new Error('Missing receipt id');

  const url = `${BASE_URL}payment_receipt/update_receipt/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logPaymentReceiptModuleError('updatePaymentReceiptRequest network error', { id, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logPaymentReceiptModuleError('updatePaymentReceiptRequest failed', {
      id,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  return response.json().catch(() => ({}));
}

/** POST `api/payment_receipt/save` */
export async function savePaymentReceiptRequest(payload = {}) {
  const url = `${BASE_URL}${PAYMENT_RECEIPT_SAVE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.json().catch(() => ({}));
}
