import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LIST_PATH = 'stock_movement/get-all-active';

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

const logStockMovementError = (operation, details) => {
  console.error(`[Stock movement module] ${operation}`, details);
};

const getErrorMessageFromResponse = async (response) => {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json.message === 'string' && json.message) return json.message;
      if (typeof json.error === 'string' && json.error) return json.error;
    } catch {
      /* ignore */
    }
  }
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
};

const normalizeListPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.stock_movements)) return result.stock_movements;
  if (Array.isArray(result)) return result;
  return [];
};

/**
 * GET /stock_movement/get-all-active?populate=product_id,warehouse_id&skip=&limit=&search=&sortBy=&sortOrder=
 */
export async function fetchStockMovementsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('populate', 'product_id,warehouse_id');

  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${LIST_PATH}?${queryString}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logStockMovementError('fetchStockMovementsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logStockMovementError('fetchStockMovementsRequest failed', {
      status: response.status,
      params,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  const data = normalizeListPayload(result);

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;

    if (apiLimit != null && Number(apiLimit) > 0) {
      const limit = Number(apiLimit);
      const page = limit > 0 ? Math.floor(skip / limit) + 1 : 1;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      return {
        data: Array.isArray(data) ? data : [],
        total,
        page,
        limit,
        totalPages,
      };
    }

    const limit = Number(params.limit || Math.max(data.length, 10) || 10);
    return {
      data: Array.isArray(data) ? data : [],
      total,
      page: 1,
      limit,
      totalPages: total > 0 ? 1 : 0,
    };
  }

  const total = Number(result.total ?? data.length ?? 0);
  const limit = Number(params.limit || result.limit || 10);
  return {
    data: Array.isArray(data) ? data : [],
    total,
    page: Number(params.page || result.page || 1),
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export const getProductLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    return p.product_name || p.name || p.sku || '—';
  }
  if (typeof p === 'string' && p.trim()) return p;
  return '—';
};

export const getProductSku = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    return p.sku || p.product_code || '—';
  }
  return '—';
};

export const getWarehouseLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const w = row.warehouse_id;
  if (w && typeof w === 'object' && !Array.isArray(w)) return w.name || w.code || '—';
  if (typeof w === 'string' && w.trim()) return w;
  return '—';
};
