import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LOW_STOCK_ALERTS_PATHS = ['alerts/low-stock', 'alerts/get-low-stock'];
const FETCH_ALL_PAGE_SIZE = 100;
const FETCH_ALL_MAX_PAGES = 50;

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

function ymdFromIso(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
      barcode: '',
      unit: '',
      stock: 0,
      alertQty: 0,
      shortage: 0,
      price: null,
      wholesalePrice: null,
      image: '',
      status: 'low',
      alertCreatedAt: '',
      lowStock: true,
    };
  }

  const stock = Number(entry.on_hand);
  const alertQty = Number(entry.alert_qty);
  const shortage = Number(entry.shortage);
  const safeStock = Number.isFinite(stock) ? stock : 0;
  const safeAlertQty = Number.isFinite(alertQty) ? alertQty : 0;
  const safeShortage = Number.isFinite(shortage) ? shortage : Math.max(0, safeAlertQty - safeStock);
  const productId = entry.product_id ?? entry.productId ?? '';

  return {
    id: productId != null ? String(productId) : '',
    alertId: entry.alert_id != null ? String(entry.alert_id) : '',
    name: String(entry.product_name ?? entry.productName ?? 'Product').trim() || 'Product',
    code: String(entry.product_code ?? entry.productCode ?? entry.sku ?? '').trim(),
    sku: String(entry.sku ?? '').trim(),
    barcode: entry.barcode != null ? String(entry.barcode).trim() : '',
    unit: entry.unit != null ? String(entry.unit).trim() : '',
    stock: safeStock,
    alertQty: safeAlertQty,
    shortage: safeShortage,
    price: entry.product_price ?? entry.productPrice ?? null,
    wholesalePrice: entry.wholesale_price ?? entry.wholesalePrice ?? null,
    image: entry.product_image != null ? String(entry.product_image) : '',
    status: safeStock <= 0 ? 'out' : 'low',
    alertCreatedAt: ymdFromIso(entry.alert_created_at ?? entry.alertCreatedAt),
    lowStock: entry.low_stock !== false,
  };
}

export function buildLowStockAlertsQuery(params = {}) {
  const query = new URLSearchParams();
  const skip = Number(params.skip);
  const limit = Number(params.limit);
  if (Number.isFinite(skip) && skip >= 0) query.set('skip', String(skip));
  if (Number.isFinite(limit) && limit > 0) query.set('limit', String(limit));
  if (params.search) query.set('search', String(params.search));
  if (params.from) query.set('from', String(params.from));
  if (params.to) query.set('to', String(params.to));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));
  if (params.mode) query.set('mode', String(params.mode));
  return query;
}

function normalizeLowStockResponse(result) {
  const data = Array.isArray(result.data) ? result.data.map(parseLowStockAlertRow) : [];
  const summary = result.summary && typeof result.summary === 'object' ? result.summary : null;
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

async function fetchLowStockAlertsFromPath(path, params = {}) {
  const queryString = buildLowStockAlertsQuery(params).toString();
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const err = new Error(await getErrorMessageFromResponse(response));
    err.status = response.status;
    throw err;
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Could not load low stock alerts';
    throw new Error(msg);
  }

  return normalizeLowStockResponse(result);
}

/**
 * GET `alerts/low-stock` — products at or below alert quantity.
 * Falls back to `alerts/get-low-stock` on 404.
 * @param {{ skip?: number, limit?: number, search?: string, from?: string, to?: string, sortBy?: string, sortOrder?: string, mode?: string }} [params]
 */
export async function fetchLowStockAlertsRequest(params = {}) {
  let lastErr = null;
  for (const path of LOW_STOCK_ALERTS_PATHS) {
    try {
      return await fetchLowStockAlertsFromPath(path, params);
    } catch (e) {
      lastErr = e;
      if (e?.status === 404) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Could not load low stock alerts');
}

/**
 * Walk skip/limit pages until every low-stock row is loaded.
 */
export async function fetchAllLowStockAlerts(params = {}) {
  const pageSize = Number(params.limit) > 0 ? Number(params.limit) : FETCH_ALL_PAGE_SIZE;
  const all = [];
  let skip = 0;
  let total = Infinity;
  let summary = null;
  let mode = null;
  let lastFirstKey = '';

  for (let page = 0; page < FETCH_ALL_MAX_PAGES; page += 1) {
    const result = await fetchLowStockAlertsRequest({
      ...params,
      skip,
      limit: pageSize,
    });
    summary = result.summary ?? summary;
    mode = result.mode ?? mode;
    if (Number.isFinite(result.total)) total = result.total;

    const batch = Array.isArray(result.items) ? result.items : [];
    if (batch.length === 0) break;

    const firstKey = `${batch[0]?.id || ''}:${batch[0]?.alertId || ''}`;
    if (page > 0 && firstKey && firstKey === lastFirstKey) break;
    lastFirstKey = firstKey;

    all.push(...batch);
    if (batch.length < pageSize || all.length >= total) break;
    skip += batch.length;
  }

  return {
    items: all,
    total: all.length,
    count: all.length,
    skip: 0,
    limit: all.length,
    summary: summary || { low_stock_count: all.length },
    mode,
  };
}

export function rowMatchesLowStockSearch(row, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [row.name, row.code, row.sku, row.barcode, row.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function rowMatchesLowStockDate(row, from, to) {
  if (!from && !to) return true;
  const created = row.alertCreatedAt;
  if (!created) return true;
  if (from && created < from) return false;
  if (to && created > to) return false;
  return true;
}

export function sortLowStockRows(rows, key, dir = 'desc') {
  const list = [...(Array.isArray(rows) ? rows : [])];
  const factor = dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null || av === '') return 1;
    if (bv == null || bv === '') return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    const aNum = Number(av);
    const bNum = Number(bv);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && key !== 'name' && key !== 'code' && key !== 'sku') {
      return (aNum - bNum) * factor;
    }
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor;
  });
  return list;
}
