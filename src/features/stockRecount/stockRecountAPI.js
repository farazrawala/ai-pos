import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LIST_PATH = 'stock_recount/get-all-active';
const GET_PATH = 'stock_recount/get';
const CREATE_PATH = 'stock_recount/create';
const UPDATE_PATH = 'stock_recount/update';
const DELETE_PATH = 'stock_recount/delete';
const START_PATH = 'stock_recount/start';
const COUNT_PATH = 'stock_recount/count';
const POST_PATH = 'stock_recount/post';
const WAREHOUSE_LIST_PATH = 'warehouse/get-all-active';

export const STOCK_RECOUNT_LIST_POPULATE = 'product_id,warehouse_id,created_by';
export const STOCK_RECOUNT_SESSION_POPULATE = 'product_id,warehouse_id';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = (token) => {
  const auth = token || getAuthToken();
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  return headers;
};

const logStockRecountError = (operation, details) => {
  console.error(`[Stock recount module] ${operation}`, details);
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
      parsedJson = JSON.parse(trimmed);
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

const assertOkJson = async (response, url, params) => {
  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    throw Object.assign(new Error(details.message), { details, url, params });
  }
  return response.json();
};

const assertApiSuccess = (result, fallback) => {
  if (result && result.success === false) {
    throw new Error(result.message || result.error || result.msg || fallback);
  }
  return result;
};

const isPopulatedRef = (ref) => ref && typeof ref === 'object' && !Array.isArray(ref);

export const refId = (raw) => {
  if (raw == null || raw === '') return '';
  if (isPopulatedRef(raw)) return String(raw._id ?? raw.id ?? '').trim();
  return String(raw).trim();
};

export const roundQty = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
};

export function formatQty(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function shortSessionId(id) {
  const s = String(id || '').trim();
  if (!s) return '—';
  return s.length > 8 ? s.slice(-8).toUpperCase() : s.toUpperCase();
}

export const getProductLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id ?? row.product;
  if (isPopulatedRef(p)) {
    return p.product_name || p.name || p.sku || p.product_code || '—';
  }
  return '—';
};

export const getProductSku = (row) => {
  if (!row || typeof row !== 'object') return '';
  const p = row.product_id ?? row.product;
  if (!isPopulatedRef(p)) return '';
  return String(p.sku || p.product_code || p.barcode || '').trim();
};

export const getWarehouseLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const w = row.warehouse_id ?? row.warehouse;
  if (isPopulatedRef(w)) {
    return w.name || w.warehouse_name || w.code || w.warehouse_code || '—';
  }
  if (typeof w === 'string' && w.trim()) return w;
  return '—';
};

export const getCreatedByLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const u = row.created_by;
  if (isPopulatedRef(u)) {
    return u.name || u.email || '—';
  }
  return '—';
};

export function isCounted(row) {
  return row?.counted_qty != null && row.counted_qty !== '';
}

export function varianceOf(row) {
  if (!isCounted(row)) return null;
  if (row.variance_qty != null && row.variance_qty !== '') {
    const stored = roundQty(row.variance_qty);
    if (stored != null) return stored;
  }
  const counted = roundQty(row.counted_qty);
  const system = roundQty(row.system_qty);
  if (counted == null || system == null) return null;
  return roundQty(counted - system);
}

export function normalizeStockRecountListRows(result) {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result;
  const candidates = [
    result.data,
    result.stock_recount,
    result.stock_recounts,
    result.items,
    result.records,
    result.data?.data,
    result.data?.stock_recount,
    result.data?.stock_recounts,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

const normalizeSingleRow = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.stock_recount != null && typeof result.stock_recount === 'object') {
    return result.stock_recount;
  }
  if (result._id || result.id) return result;
  return null;
};

export function groupRecountsBySession(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const map = new Map();

  for (const row of rows) {
    const sessionId = refId(row.stock_recount_id);
    if (!sessionId) continue;

    if (!map.has(sessionId)) {
      map.set(sessionId, {
        stockRecountId: sessionId,
        warehouseId: refId(row.warehouse_id),
        warehouseName: getWarehouseLabel(row),
        createdByName: getCreatedByLabel(row),
        createdAt: row.createdAt ?? row.created_at ?? null,
        updatedAt: row.updatedAt ?? row.updated_at ?? null,
        lineCount: 0,
        countedCount: 0,
        pendingCount: 0,
        varianceCount: 0,
        totalVarianceQty: 0,
      });
    }

    const group = map.get(sessionId);
    group.lineCount += 1;
    if (isCounted(row)) {
      group.countedCount += 1;
      const variance = varianceOf(row);
      if (variance != null && variance !== 0) {
        group.varianceCount += 1;
        group.totalVarianceQty = roundQty((group.totalVarianceQty || 0) + variance) || 0;
      }
    } else {
      group.pendingCount += 1;
    }

    const updatedAt = row.updatedAt ?? row.updated_at;
    if (updatedAt && (!group.updatedAt || updatedAt > group.updatedAt)) {
      group.updatedAt = updatedAt;
    }
    const createdAt = row.createdAt ?? row.created_at;
    if (createdAt && (!group.createdAt || createdAt < group.createdAt)) {
      group.createdAt = createdAt;
    }
    if (!group.warehouseName || group.warehouseName === '—') {
      group.warehouseName = getWarehouseLabel(row);
      group.warehouseId = refId(row.warehouse_id) || group.warehouseId;
    }
    if (!group.createdByName || group.createdByName === '—') {
      group.createdByName = getCreatedByLabel(row);
    }
  }

  return Array.from(map.values()).map((g) => ({
    ...g,
    status: g.pendingCount > 0 ? 'in_progress' : 'counted',
  }));
}

export function filterSessions(sessions, searchTerm = '') {
  const q = String(searchTerm || '').trim().toLowerCase();
  if (!q || !Array.isArray(sessions)) return sessions;
  return sessions.filter((s) => {
    const hay = [
      s.stockRecountId,
      shortSessionId(s.stockRecountId),
      s.warehouseName,
      s.createdByName,
      s.status,
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ');
    return hay.includes(q);
  });
}

export function sortSessions(sessions, sortBy, sortOrder) {
  if (!sortBy || !Array.isArray(sessions)) return sessions;
  const dir = sortOrder === 'desc' ? -1 : 1;
  const sorted = [...sessions];
  sorted.sort((a, b) => {
    let av;
    let bv;
    switch (sortBy) {
      case 'warehouse':
        av = String(a.warehouseName || '').toLowerCase();
        bv = String(b.warehouseName || '').toLowerCase();
        break;
      case 'lineCount':
        av = Number(a.lineCount) || 0;
        bv = Number(b.lineCount) || 0;
        break;
      case 'countedCount':
        av = Number(a.countedCount) || 0;
        bv = Number(b.countedCount) || 0;
        break;
      case 'status':
        av = String(a.status || '');
        bv = String(b.status || '');
        break;
      case 'createdAt':
      default:
        av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return sorted;
}

export function paginateSessions(sessions, page = 1, limit = 10) {
  const total = Array.isArray(sessions) ? sessions.length : 0;
  const safeLimit = Math.max(1, Number(limit) || 10);
  const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;
  const safePage = Math.min(Math.max(1, Number(page) || 1), Math.max(totalPages, 1));
  const start = (safePage - 1) * safeLimit;
  const data = Array.isArray(sessions) ? sessions.slice(start, start + safeLimit) : [];
  return { data, total, page: safePage, limit: safeLimit, totalPages };
}

function paginationFromResult(result, data, params) {
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;
    const limit =
      apiLimit != null && Number(apiLimit) > 0 ? Number(apiLimit) : Number(params.limit || data.length || 10);
    const page = limit > 0 ? Math.max(1, Math.floor(skip / limit) + 1) : Number(params.page || 1);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0;
    return { data, total, page, limit, totalPages };
  }

  const total = Number(result.total ?? data.length ?? 0);
  const limit = Number(result.limit || result.per_page || params.limit || data.length || 10);
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

/**
 * GET /stock_recount/get-all-active?populate=product_id,warehouse_id
 */
export async function fetchStockRecountsRequest(params = {}) {
  const token = params.token || getAuthToken();
  if (!token) {
    throw new Error('You are not signed in. Please sign in again to load stock recounts.');
  }

  const queryParams = new URLSearchParams();
  if (params.skip != null && params.skip !== '') {
    queryParams.append('skip', String(params.skip));
  } else if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
  if (params.stock_recount_id) queryParams.append('stock_recount_id', String(params.stock_recount_id));
  if (params.warehouse_id) queryParams.append('warehouse_id', String(params.warehouse_id));
  if (params.uncounted === true || params.uncounted === 1 || params.uncounted === '1') {
    queryParams.append('uncounted', '1');
  }
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : STOCK_RECOUNT_LIST_POPULATE
  );

  const url = `${BASE_URL}${LIST_PATH}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders(token) });
  } catch (err) {
    logStockRecountError('fetchStockRecountsRequest network error', { url, params, error: err });
    throw err;
  }

  let result;
  try {
    result = await assertOkJson(response, url, params);
  } catch (err) {
    logStockRecountError('fetchStockRecountsRequest failed', { url, params, ...(err.details || {}) });
    throw new Error(err.message);
  }

  assertApiSuccess(result, 'Failed to fetch stock recounts');
  const data = normalizeStockRecountListRows(result);
  return paginationFromResult(result, data, params);
}

/** GET /stock_recount/get/:id */
export async function fetchStockRecountByIdRequest(lineId, params = {}) {
  const id = String(lineId ?? '').trim();
  if (!id) throw new Error('Missing stock recount line id');

  const queryParams = new URLSearchParams();
  queryParams.set(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : STOCK_RECOUNT_SESSION_POPULATE
  );
  const url = `${BASE_URL}${GET_PATH}/${encodeURIComponent(id)}?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders(params.token) });
  const result = await assertOkJson(response, url, { lineId: id });
  assertApiSuccess(result, 'Failed to fetch stock recount line');
  const row = normalizeSingleRow(result);
  if (!row) throw new Error('Stock recount line not found');
  return row;
}

/** DELETE /stock_recount/delete/:id */
export async function deleteStockRecountRequest(lineId, params = {}) {
  const id = String(lineId ?? '').trim();
  if (!id) throw new Error('Missing stock recount line id');
  const url = `${BASE_URL}${DELETE_PATH}/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE', headers: getHeaders(params.token) });
  const result = await assertOkJson(response, url, { lineId: id });
  assertApiSuccess(result, 'Failed to delete stock recount line');
  return result;
}

/** POST /stock_recount/create — manual row; start is preferred. */
export async function createStockRecountRequest(data = {}) {
  const body = {
    stock_recount_id: String(data.stock_recount_id ?? '').trim(),
    product_id: String(data.product_id ?? '').trim(),
    warehouse_id: String(data.warehouse_id ?? '').trim(),
    warehouse_inventory_id: String(data.warehouse_inventory_id ?? '').trim(),
    status: 'active',
  };
  const system = roundQty(data.system_qty);
  if (system != null) body.system_qty = system;
  if (data.counted_qty != null && data.counted_qty !== '') {
    const counted = roundQty(data.counted_qty);
    if (counted != null) body.counted_qty = counted;
  }
  const url = `${BASE_URL}${CREATE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(data.token),
    body: JSON.stringify(body),
  });
  const result = await assertOkJson(response, url, body);
  assertApiSuccess(result, 'Failed to create stock recount line');
  return normalizeSingleRow(result) ?? result;
}

/**
 * PATCH /stock_recount/update/:id
 * Body: { counted_qty } — model sets variance_qty.
 */
export async function updateStockRecountRequest(lineId, data = {}) {
  const id = String(lineId ?? '').trim();
  if (!id) throw new Error('Missing stock recount line id');
  if (!Object.prototype.hasOwnProperty.call(data, 'counted_qty')) {
    throw new Error('counted_qty is required');
  }

  const body =
    data.counted_qty == null || data.counted_qty === ''
      ? { counted_qty: null }
      : { counted_qty: roundQty(data.counted_qty) };
  if (body.counted_qty === null && data.counted_qty != null && data.counted_qty !== '') {
    throw new Error('counted_qty must be a number');
  }

  const url = `${BASE_URL}${UPDATE_PATH}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(data.token),
    body: JSON.stringify(body),
  });
  try {
    const result = await assertOkJson(response, url, body);
    assertApiSuccess(result, 'Failed to update stock recount');
    return normalizeSingleRow(result) ?? result;
  } catch (err) {
    logStockRecountError('updateStockRecountRequest failed', { lineId: id, body, error: err });
    throw new Error(err.message || 'Failed to update stock recount');
  }
}

/** PATCH /stock_recount/count/:id — same body as update. */
export async function countStockRecountRequest(lineId, data = {}) {
  const id = String(lineId ?? '').trim();
  if (!id) throw new Error('Missing stock recount line id');
  const counted =
    data.counted_qty == null || data.counted_qty === '' ? null : roundQty(data.counted_qty);
  if (data.counted_qty != null && data.counted_qty !== '' && counted == null) {
    throw new Error('counted_qty must be a number');
  }
  const body = { counted_qty: counted };
  const url = `${BASE_URL}${COUNT_PATH}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(data.token),
    body: JSON.stringify(body),
  });
  const result = await assertOkJson(response, url, body);
  assertApiSuccess(result, 'Failed to count stock recount line');
  return normalizeSingleRow(result) ?? result;
}

/**
 * POST /stock_recount/start
 * Body: { warehouse_id } — server creates stock_recount_id + system_qty snapshot.
 */
export async function startRecountSessionRequest({ warehouseId } = {}) {
  const wid = String(warehouseId || '').trim();
  if (!wid) throw new Error('Select a warehouse to start a recount');

  const body = { warehouse_id: wid };
  const url = `${BASE_URL}${START_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  try {
    const result = await assertOkJson(response, url, body);
    assertApiSuccess(result, 'Failed to start stock recount');
    const stockRecountId = String(result.stock_recount_id || result.data?.stock_recount_id || '').trim();
    if (!stockRecountId) throw new Error('Start recount did not return stock_recount_id');
    return {
      stockRecountId,
      warehouseId: String(result.warehouse_id || wid),
      totalLines: Number(result.total_lines ?? result.data?.length ?? 0),
      data: Array.isArray(result.data) ? result.data : [],
    };
  } catch (err) {
    logStockRecountError('startRecountSessionRequest failed', { body, error: err });
    throw new Error(err.message || 'Failed to start stock recount');
  }
}

/**
 * POST /stock_recount/post
 * Body: { stock_recount_id } — apply counted diffs to warehouse_inventory + movements.
 */
export async function postRecountSessionRequest(stockRecountId, params = {}) {
  const id = String(stockRecountId || '').trim();
  if (!id) throw new Error('Missing stock recount session id');
  const body = { stock_recount_id: id };
  const url = `${BASE_URL}${POST_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(params.token),
    body: JSON.stringify(body),
  });
  try {
    const result = await assertOkJson(response, url, body);
    assertApiSuccess(result, 'Failed to post stock recount');
    return result;
  } catch (err) {
    logStockRecountError('postRecountSessionRequest failed', { stockRecountId: id, error: err });
    throw new Error(err.message || 'Failed to post stock recount');
  }
}

export async function fetchActiveWarehousesRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('skip', String(params.skip ?? 0));
  queryParams.set('limit', String(params.limit ?? 1000));
  queryParams.set('sortBy', params.sortBy || 'name');
  queryParams.set('sortOrder', params.sortOrder || 'asc');
  const url = `${BASE_URL}${WAREHOUSE_LIST_PATH}?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders(params.token) });
  const result = await assertOkJson(response, url, params);
  const rows = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.warehouses)
      ? result.warehouses
      : Array.isArray(result)
        ? result
        : [];
  return rows;
}
