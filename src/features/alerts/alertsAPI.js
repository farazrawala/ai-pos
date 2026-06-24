import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LOW_STOCK_ALERTS_PATH = 'alerts/low-stock';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function getErrorMessageFromResponse(response) {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        if (typeof json.message === 'string' && json.message) return json.message;
        if (typeof json.error === 'string' && json.error) return json.error;
      }
    } catch {
      /* ignore */
    }
  }

  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
}

/** @param {unknown} entry */
export function parseLowStockAlertRow(entry) {
  if (!entry || typeof entry !== 'object') {
    return {
      id: '',
      alertId: '',
      name: 'Product',
      code: '',
      sku: '',
      stock: 0,
      alertQty: 0,
      shortage: 0,
      price: null,
      wholesalePrice: null,
      image: '',
      status: 'low',
    };
  }

  const stock = Number(entry.on_hand);
  const alertQty = Number(entry.alert_qty);
  const shortage = Number(entry.shortage);
  const safeStock = Number.isFinite(stock) ? stock : 0;
  const safeAlertQty = Number.isFinite(alertQty) ? alertQty : 0;
  const safeShortage = Number.isFinite(shortage) ? shortage : Math.max(0, safeAlertQty - safeStock);

  return {
    id: String(entry.product_id ?? entry.alert_id ?? ''),
    alertId: String(entry.alert_id ?? ''),
    name: String(entry.product_name ?? 'Product').trim() || 'Product',
    code: String(entry.product_code ?? entry.sku ?? '').trim(),
    sku: String(entry.sku ?? '').trim(),
    stock: safeStock,
    alertQty: safeAlertQty,
    shortage: safeShortage,
    price: entry.product_price ?? null,
    wholesalePrice: entry.wholesale_price ?? null,
    image: entry.product_image != null ? String(entry.product_image) : '',
    status: safeStock <= 0 ? 'out' : 'low',
  };
}

/**
 * GET `alerts/low-stock` — products at or below alert quantity.
 * @param {{ skip?: number; limit?: number }} [params]
 */
export async function fetchLowStockAlertsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  const skip = Number(params.skip);
  const limit = Number(params.limit);
  if (Number.isFinite(skip) && skip >= 0) queryParams.set('skip', String(skip));
  if (Number.isFinite(limit) && limit > 0) queryParams.set('limit', String(limit));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${LOW_STOCK_ALERTS_PATH}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load low stock alerts';
    throw new Error(msg);
  }

  const data = Array.isArray(result.data) ? result.data.map(parseLowStockAlertRow) : [];
  const summary =
    result.summary && typeof result.summary === 'object' ? result.summary : null;
  const totalFromSummary = Number(summary?.low_stock_count);
  const totalFromRoot = Number(result.total);
  const total = Number.isFinite(totalFromSummary)
    ? totalFromSummary
    : Number.isFinite(totalFromRoot)
      ? totalFromRoot
      : data.length;

  return {
    items: data,
    total,
    count: Number.isFinite(Number(result.count)) ? Number(result.count) : data.length,
    skip: Number.isFinite(Number(result.skip)) ? Number(result.skip) : 0,
    limit: Number.isFinite(Number(result.limit)) ? Number(result.limit) : data.length,
    summary,
    mode: result.mode ?? null,
  };
}
