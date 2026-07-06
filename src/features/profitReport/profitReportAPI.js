import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const PROFIT_BY_ORDER_ITEM_PATH = 'order_item/profit-by-order-item';

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

function appendDateParams(query, params = {}) {
  if (params.startDate) {
    const start = String(params.startDate);
    query.set('from', start);
    query.set('startDate', start);
  }
  if (params.endDate) {
    const end = String(params.endDate);
    query.set('to', end);
    query.set('endDate', end);
  }
  if (params.orderId) query.set('order_id', String(params.orderId));
  if (params.productId) query.set('product_id', String(params.productId));
}

export function buildProfitByOrderItemUrl(params = {}) {
  const query = new URLSearchParams();
  appendDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${PROFIT_BY_ORDER_ITEM_PATH}${qs ? `?${qs}` : ''}`;
}

function parseNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {unknown} result
 */
export function normalizeProfitByOrderItemPayload(result) {
  if (!result || typeof result !== 'object') return null;

  const profit = parseNumber(result.profit ?? result.total_profit ?? result.totalProfit);
  const subtotal = parseNumber(result.subtotal ?? result.total_subtotal ?? result.totalSubtotal);
  const lineCountRaw = result.line_count ?? result.lineCount;
  const lineCount =
    typeof lineCountRaw === 'number' && Number.isFinite(lineCountRaw)
      ? lineCountRaw
      : parseInt(String(lineCountRaw ?? ''), 10) || 0;

  const filters = result.filters && typeof result.filters === 'object' ? result.filters : {};

  const marginPct = subtotal !== 0 ? (profit / subtotal) * 100 : null;

  return {
    success: result.success !== false,
    companyId: result.company_id ?? result.companyId ?? null,
    profit,
    subtotal,
    lineCount,
    marginPct,
    filters: {
      orderId: filters.order_id ?? filters.orderId ?? null,
      productId: filters.product_id ?? filters.productId ?? null,
      from: filters.from ?? null,
      to: filters.to ?? null,
      defaultRangeDays: filters.default_range_days ?? filters.defaultRangeDays ?? null,
    },
  };
}

/**
 * GET `order_item/profit-by-order-item`
 * @param {{ startDate?: string; endDate?: string; orderId?: string; productId?: string }} [params]
 */
export async function fetchProfitByOrderItemRequest(params = {}) {
  const url = buildProfitByOrderItemUrl(params);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `Failed to load profit (${response.status})`;
    if (text) {
      try {
        const j = JSON.parse(text);
        if (j?.message) message = j.message;
      } catch {
        const one = text.replace(/\s+/g, ' ').slice(0, 200);
        if (one) message = one;
      }
    }
    throw new Error(message);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Profit request was not successful';
    throw new Error(msg);
  }

  const report = normalizeProfitByOrderItemPayload(result);
  if (!report) {
    throw new Error('Invalid profit response');
  }

  return { report, raw: result };
}
