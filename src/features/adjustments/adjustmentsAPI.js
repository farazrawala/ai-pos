import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logAdjustmentModuleError = (operation, details) => {
  console.error(`[Adjustment module] ${operation}`, details);
};

const readResponseErrorDetails = async (response) => {
  const status = response.status;
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (readErr) {
    return {
      status,
      message: `HTTP error! status: ${status}`,
      readBodyError: readErr?.message || String(readErr),
    };
  }
  let parsedJson = null;
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      /* ignore */
    }
  }
  const fromJson =
    parsedJson && (parsedJson.message || parsedJson.error || parsedJson.msg || parsedJson.detail);
  const message =
    (typeof fromJson === 'string' && fromJson) ||
    (Array.isArray(fromJson) ? fromJson.join(', ') : null) ||
    (typeof rawText === 'string' && rawText.length > 0 && rawText.length < 400 ? rawText : null) ||
    `HTTP error! status: ${status}`;
  return {
    status,
    message: typeof message === 'string' ? message : String(message),
    parsedJson,
    rawTextPreview: rawText.slice(0, 1200),
  };
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const ADJUSTMENT_TYPE_OPTIONS = [
  { value: 'add', label: 'Add' },
  { value: 'remove', label: 'Remove' },
];

/** Default `populate` for adjustment list (`GET adjustment/get-all-active`). */
export const ADJUSTMENT_LIST_POPULATE = 'product_id';

export function normalizeAdjustmentsListRows(result) {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result;

  const candidates = [
    result.data,
    result.adjustments,
    result.items,
    result.records,
    result.data?.data,
    result.data?.adjustments,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

/** Product display name from populated `product_id` or fallback when unpopulated. */
export const getAdjustmentProductName = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const name = String(p.product_name ?? p.name ?? '').trim();
    if (name) return name;
    const sku = String(p.sku ?? p.product_code ?? p.barcode ?? '').trim();
    if (sku) return sku;
    return '—';
  }
  return '—';
};

export function formatAdjustmentType(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return '—';
  if (s === 'remove' || s === 'subtract') return 'Remove';
  if (s === 'add') return 'Add';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function fetchAdjustmentsRequest(params = {}) {
  const token = params.token || getAuthToken();
  if (!token) {
    throw new Error('You are not signed in. Please sign in again to load adjustments.');
  }

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : ADJUSTMENT_LIST_POPULATE
  );

  const queryString = queryParams.toString();
  const url = `${BASE_URL}adjustment/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAdjustmentModuleError('fetchAdjustmentsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAdjustmentModuleError('fetchAdjustmentsRequest failed', { url, params, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();

  if (result.success === false) {
    const message = result.message || result.error || result.msg || 'Failed to fetch adjustments';
    logAdjustmentModuleError('fetchAdjustmentsRequest API success=false', { url, params, result });
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  const data = normalizeAdjustmentsListRows(result);

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;

    const limit =
      apiLimit != null && Number(apiLimit) > 0 ? Number(apiLimit) : Number(params.limit || 10);
    const page = limit > 0 ? Math.max(1, Math.floor(skip / limit) + 1) : Number(params.page || 1);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0;

    return { data, total, page, limit, totalPages };
  }

  if (Array.isArray(data)) {
    const total = Number(result.total ?? data.length ?? 0);
    const limit = Number(result.limit || result.per_page || params.limit || 10);
    return {
      data,
      total,
      page: Number(result.page || params.page || 1),
      limit,
      totalPages:
        result.total_pages ??
        result.totalPages ??
        (limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0),
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

const normalizeSingleAdjustmentPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (
    result.adjustment != null &&
    typeof result.adjustment === 'object' &&
    !Array.isArray(result.adjustment)
  ) {
    return result.adjustment;
  }
  if (result._id || result.id) return result;
  return null;
};

/** Body for POST /adjustment/save and PATCH /adjustment/update_record/:id */
export function buildAdjustmentSaveBody(adjustmentData = {}) {
  const body = {
    product_id: String(adjustmentData.product_id ?? '').trim(),
    type: String(adjustmentData.type ?? 'add').trim() || 'add',
    description: String(adjustmentData.description ?? '').trim(),
  };
  const qty = Number(adjustmentData.quantity);
  if (!Number.isNaN(qty)) body.quantity = qty;

  const warehouseId = String(adjustmentData.warehouse_id ?? '').trim();
  if (warehouseId) body.warehouse_id = warehouseId;

  const unitCost = Number(adjustmentData.unit_cost ?? adjustmentData.cost);
  if (Number.isFinite(unitCost) && unitCost > 0) {
    body.unit_cost = unitCost;
  }

  return body;
}

export const buildAdjustmentCreateBody = buildAdjustmentSaveBody;

export async function fetchAdjustmentByIdRequest(adjustmentId, params = {}) {
  const token = getAuthToken();
  const id = String(adjustmentId ?? '').trim();
  if (!id) throw new Error('Missing adjustment id');

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : ADJUSTMENT_LIST_POPULATE
  );
  const url = `${BASE_URL}adjustment/get/${encodeURIComponent(id)}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAdjustmentModuleError('fetchAdjustmentByIdRequest network error', {
      adjustmentId: id,
      url,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAdjustmentModuleError('fetchAdjustmentByIdRequest failed', { adjustmentId: id, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();
  if (result.success === false) {
    const message = result.message || result.error || result.msg || 'Failed to fetch adjustment';
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  const adjustment = normalizeSingleAdjustmentPayload(result);
  if (!adjustment) throw new Error('Adjustment not found');
  return adjustment;
}

/** PATCH /adjustment/update_record/:id */
export async function updateAdjustmentRequest(adjustmentId, adjustmentData = {}) {
  const token = getAuthToken();
  const id = String(adjustmentId ?? '').trim();
  if (!id) throw new Error('Missing adjustment id');

  const url = `${BASE_URL}adjustment/update_record/${encodeURIComponent(id)}`;
  const body = buildAdjustmentSaveBody(adjustmentData);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAdjustmentModuleError('updateAdjustmentRequest network error', {
      adjustmentId: id,
      url,
      payloadKeys: Object.keys(body),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAdjustmentModuleError('updateAdjustmentRequest failed', {
      adjustmentId: id,
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAdjustmentModuleError('updateAdjustmentRequest invalid JSON on success', {
      adjustmentId: id,
      error: parseErr,
    });
    return { success: true };
  }
}

/** POST /adjustment/save */
export async function saveAdjustmentRequest(adjustmentData = {}) {
  const token = getAuthToken();
  const url = `${BASE_URL}adjustment/save`;
  const body = buildAdjustmentSaveBody(adjustmentData);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAdjustmentModuleError('saveAdjustmentRequest network error', {
      url,
      payloadKeys: Object.keys(body),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAdjustmentModuleError('saveAdjustmentRequest failed', {
      url,
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAdjustmentModuleError('saveAdjustmentRequest invalid JSON on success', {
      url,
      error: parseErr,
    });
    return { success: true };
  }
}

/** @deprecated Use saveAdjustmentRequest */
export const createAdjustmentRequest = saveAdjustmentRequest;
