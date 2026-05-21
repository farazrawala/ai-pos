import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LIST_PATH = 'inventory_movements/get-all-active';
const STOCK_TRANSFER_PATH = 'inventory_movements/stock-transfer';
export const STOCK_MOVEMENT_LIST_POPULATE = 'product_id,warehouse_id,created_by';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = (jsonBody = false) => {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (jsonBody) headers['Content-Type'] = 'application/json';
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
  if (Array.isArray(result.inventory_movements)) return result.inventory_movements;
  if (Array.isArray(result)) return result;
  return [];
};

/**
 * GET /inventory_movements/get-all-active?populate=product_id,warehouse_id,created_by&skip=&limit=&search=&sortBy=&sortOrder=
 */
export async function fetchStockMovementsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : STOCK_MOVEMENT_LIST_POPULATE
  );

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

    const limit =
      apiLimit != null && Number(apiLimit) > 0
        ? Number(apiLimit)
        : Number(params.limit || 10);
    const page =
      limit > 0
        ? Math.max(1, Math.floor(skip / limit) + 1)
        : Number(params.page || 1);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total,
      page,
      limit,
      totalPages,
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

const isPopulatedRef = (ref) => ref && typeof ref === 'object' && !Array.isArray(ref);

/** Populated `product_id` display name. */
export const getProductLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id;
  if (isPopulatedRef(p)) {
    return p.product_name || p.name || p.product_slug || p.sku || '—';
  }
  return '—';
};

/** Populated `product_id` barcode / SKU / code. */
export const getProductSku = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id;
  if (isPopulatedRef(p)) {
    return p.barcode || p.sku || p.product_code || '—';
  }
  return '—';
};

const getWarehouseRefLabel = (ref) => {
  if (!ref) return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    return ref.name || ref.warehouse_name || ref.code || ref.warehouse_code || '';
  }
  if (typeof ref === 'string' && ref.trim()) return ref;
  return '';
};

export const getWarehouseLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const from = getWarehouseRefLabel(row.from_warehouse_id);
  const to = getWarehouseRefLabel(row.to_warehouse_id);
  if (from && to) return `${from} → ${to}`;
  if (from || to) return from || to;
  const w = row.warehouse_id;
  const single = getWarehouseRefLabel(w);
  return single || '—';
};

/** Quantity from list row (`quantity` or `qty`). */
export const getMovementQuantity = (row) => {
  if (!row || typeof row !== 'object') return null;
  if (row.quantity != null && row.quantity !== '') return row.quantity;
  if (row.qty != null && row.qty !== '') return row.qty;
  return null;
};

/** `movement_type` (in/out) with legacy `direction` / `type` fallbacks. */
export const getMovementType = (row) => {
  if (!row || typeof row !== 'object') return '';
  const raw = row.movement_type ?? row.direction ?? row.type ?? '';
  return String(raw).trim().toLowerCase();
};

export const getReferenceName = (row) => {
  if (!row || typeof row !== 'object') return '';
  const name = row.reference_name ?? row.reason ?? '';
  return String(name).trim();
};

export const getReferenceType = (row) => {
  if (!row || typeof row !== 'object') return '';
  return String(row.reference_type ?? '').trim();
};

/** Populated `created_by` display name. */
export const getCreatedByLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const user = row.created_by;
  if (isPopulatedRef(user)) {
    const name = String(user.name ?? '').trim();
    if (name) return name;
    const email = String(user.email ?? '').trim();
    if (email) return email;
    return '—';
  }
  return '—';
};

/** POST URL for warehouse stock transfer. */
export function buildStockTransferUrl() {
  return `${BASE_URL}${STOCK_TRANSFER_PATH}`;
}

/**
 * POST `inventory_movements/stock-transfer`
 * @param {{ product_id: string; qty: number | string; from_warehouse_id: string; to_warehouse_id: string }} payload
 */
export async function stockTransferRequest(payload = {}) {
  const url = buildStockTransferUrl();
  const body = {
    product_id: String(payload.product_id ?? '').trim(),
    qty: Number(payload.qty),
    from_warehouse_id: String(payload.from_warehouse_id ?? '').trim(),
    to_warehouse_id: String(payload.to_warehouse_id ?? '').trim(),
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(body),
    });
  } catch (err) {
    logStockMovementError('stockTransferRequest network error', { url, body, error: err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logStockMovementError('stockTransferRequest failed', { status: response.status, body, message });
    throw new Error(message);
  }

  return response.json().catch(() => ({}));
}
