import { API_BASE_URL } from '../../config/apiConfig.js';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

/**
 * Turn Mongo-style refs, populated docs, or plain strings into a single id string.
 * Never returns "[object Object]".
 */
function pickCompanyIdString(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string' || typeof raw === 'number') {
    const s = String(raw).trim();
    if (!s || s === '[object Object]') return '';
    return s;
  }
  if (typeof raw === 'object') {
    if (raw.$oid != null) return pickCompanyIdString(raw.$oid);
    if (raw._id != null) return pickCompanyIdString(raw._id);
    if (raw.id != null) return pickCompanyIdString(raw.id);
    if (raw.company_id != null) return pickCompanyIdString(raw.company_id);
  }
  return '';
}

/** Account ref → id string (populated doc, ObjectId string, or plain id). */
export function pickAccountRefId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const id = raw._id ?? raw.id;
    if (id != null) return String(id).trim();
  }
  const s = String(raw).trim();
  return s && s !== '[object Object]' ? s : '';
}

/** Default account fields on company (login `company_id` populate). */
export const COMPANY_DEFAULT_ACCOUNT_KEYS = [
  'default_account_payable_account',
  'default_account_receivable_account',
  'default_adjustment_account',
  'default_cash_account',
  'default_equity_account_id',
  'default_expense_account',
  'default_other_expense_account',
  'default_purchase_account',
  'default_purchase_discount_account',
  'default_salary_account',
  'default_sales_account',
  'default_sales_discount_account',
  'default_shipping_account',
  'default_utilities_account',
];

/** Map of default account keys → populated account doc or id from company. */
export function extractCompanyDefaultAccounts(company) {
  if (!company || typeof company !== 'object') return {};
  const out = {};
  for (const key of COMPANY_DEFAULT_ACCOUNT_KEYS) {
    if (company[key] != null) out[key] = company[key];
  }
  return out;
}

export function getDefaultAccountFromCompany(company, key) {
  if (!company || typeof company !== 'object') return null;
  return company[key] ?? null;
}

export function getDefaultAccountId(company, key) {
  return pickAccountRefId(getDefaultAccountFromCompany(company, key));
}

/** Populated company doc from login user (`company_id` or `company`). */
export function extractCompanyFromUser(user) {
  if (!user || typeof user !== 'object') return null;

  const cid = user.company_id;
  if (cid && typeof cid === 'object' && !Array.isArray(cid)) {
    const id = pickCompanyIdString(cid);
    if (id || cid.company_name != null || cid.name != null) return { ...cid };
  }

  const c = user.company;
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    const id = pickCompanyIdString(c);
    if (id || c.company_name != null || c.name != null) return { ...c };
  }

  return null;
}

/**
 * Normalize login API body (`POST user/login`).
 * Supports `{ success, message, user }` and nested `{ data: { ... } }`.
 */
export function normalizeLoginApiBody(body) {
  if (!body || typeof body !== 'object') {
    return { user: null, token: '', company: null, message: '', success: false };
  }

  let root = body;
  const nested = body.data;
  if (nested && typeof nested === 'object' && (nested.user != null || nested.success != null)) {
    root = nested;
  }

  const user = root.user ?? null;
  const message = String(root.message ?? body.message ?? '').trim();
  const token = String(
    root.token ?? root.access_token ?? root.accessToken ?? user?.token ?? body.token ?? ''
  ).trim();

  let company = extractCompanyFromUser(user);
  if (!company && root.company && typeof root.company === 'object' && !Array.isArray(root.company)) {
    company = { ...root.company };
  }

  return {
    success: root.success ?? body.success,
    message,
    user,
    token,
    company,
  };
}

/** Resolve company id from login payload; prefers the user's `company_id`. */
export function getCompanyIdFromUser(user) {
  if (!user || typeof user !== 'object') return '';

  const fromCompanyId = pickCompanyIdString(user.company_id);
  if (fromCompanyId) return fromCompanyId;

  const fromCompanyIdAlt = pickCompanyIdString(user.companyId);
  if (fromCompanyIdAlt) return fromCompanyIdAlt;

  const fromUserCompanyId = pickCompanyIdString(user.user_company_id);
  if (fromUserCompanyId) return fromUserCompanyId;

  const c = user.company;
  if (typeof c === 'string' && c.trim()) return c.trim();
  if (c && typeof c === 'object') {
    const nested = pickCompanyIdString(c._id ?? c.id ?? c.company_id);
    if (nested) return nested;
  }

  return '';
}

export function extractCompanyRecord(body) {
  if (!body || typeof body !== 'object') return null;
  return body.data ?? body.company ?? body.result ?? body;
}

export function parseBarcodeSettings(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Read `barcode_settings` from GET company response (string or object).
 */
export function extractBarcodeSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  const raw = company.barcode_settings ?? company.barcodeSettings ?? company.all_fields;
  return parseBarcodeSettings(raw);
}

/**
 * Normalize saved JSON (camelCase or snake_case) into a flat patch for React state.
 */
export function normalizeIncomingBarcodeSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const get = (camel, ...snakes) => {
    const keys = [camel, ...snakes];
    for (const k of keys) {
      if (parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== '') {
        return parsed[k];
      }
    }
    return undefined;
  };

  const out = {};
  const setIf = (key, val) => {
    if (val !== undefined) out[key] = val;
  };

  setIf('bType', get('bType', 'b_type'));
  setIf('labelCount', get('labelCount', 'label_count'));
  setIf('sheetWidthIn', get('sheetWidthIn', 'sheet_width_in'));
  setIf('sheetHeightIn', get('sheetHeightIn', 'sheet_height_in'));
  setIf('sheetWidthMm', get('sheetWidthMm', 'sheet_width_mm'));
  setIf('sheetHeightMm', get('sheetHeightMm', 'sheet_height_mm'));
  setIf('labelWidthMm', get('labelWidthMm', 'label_width_mm'));
  setIf('labelHeightMm', get('labelHeightMm', 'label_height_mm'));
  setIf('totalRows', get('totalRows', 'total_rows'));
  setIf('totalCols', get('totalCols', 'total_cols'));
  setIf('barCodeWidthField', get('barCodeWidthField', 'bar_code_width'));
  setIf('barCodeHeightField', get('barCodeHeightField', 'bar_code_height'));
  setIf('fontSize', get('fontSize', 'font_size'));
  setIf('showProductName', get('showProductName', 'show_product_name'));
  setIf('showLocation', get('showLocation', 'show_location', 'business_location'));
  setIf('showWarehouse', get('showWarehouse', 'show_warehouse'));
  setIf('showPrice', get('showPrice', 'show_price'));
  setIf('showProductCode', get('showProductCode', 'show_product_code'));
  setIf('maxChars', get('maxChars', 'max_chars'));

  if (out.sheetWidthIn == null && out.sheetWidthMm != null) {
    const mm = Number(out.sheetWidthMm);
    if (Number.isFinite(mm)) out.sheetWidthIn = Math.round((mm / 25.4) * 1000) / 1000;
  }
  if (out.sheetHeightIn == null && out.sheetHeightMm != null) {
    const mm = Number(out.sheetHeightMm);
    if (Number.isFinite(mm)) out.sheetHeightIn = Math.round((mm / 25.4) * 1000) / 1000;
  }
  delete out.sheetWidthMm;
  delete out.sheetHeightMm;

  return out;
}

/** Payload stored in `barcode_settings` (JSON). */
export function buildBarcodeSettingsPayload(values) {
  return {
    b_type: values.bType,
    label_count: values.labelCount,
    sheet_width_in: values.sheetWidthIn,
    sheet_height_in: values.sheetHeightIn,
    label_width_mm: values.labelWidthMm,
    label_height_mm: values.labelHeightMm,
    total_rows: values.totalRows,
    total_cols: values.totalCols,
    bar_code_width: values.barCodeWidthField,
    bar_code_height: values.barCodeHeightField,
    font_size: values.fontSize,
    show_product_name: values.showProductName,
    show_location: values.showLocation,
    show_warehouse: values.showWarehouse,
    show_price: values.showPrice,
    show_product_code: values.showProductCode,
    max_chars: values.maxChars,
  };
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 200) };
    }
  }
  return { data, ok: res.ok, status: res.status };
}

/** GET URL to list company-scoped list-cache entries (Redis + memory). */
export function buildCompanyListCacheUrl(includeValues = false) {
  const base = `${API_BASE_URL}/company/list-cache`;
  if (!includeValues) return base;
  return `${base}?include_values=true`;
}

/**
 * GET `company/list-cache` — list cached list entries for the signed-in user's company.
 */
export async function fetchCompanyListCache(includeValues = false) {
  const token = getAuthToken();
  const url = buildCompanyListCacheUrl(includeValues);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok) {
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      `Request failed (${status})`;
    throw new Error(msg);
  }
  if (data && data.success === false) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      'Failed to load company cache';
    throw new Error(msg);
  }
  return data;
}

/** DELETE URL to invalidate company-scoped API cache before balance sheet loads. */
export function buildCompanyRemoveCacheUrl() {
  return `${API_BASE_URL}/company/remove-cache`;
}

/**
 * DELETE `company/remove-cache` — clear cached company data (run before balance sheet fetches).
 */
export async function removeCompanyCacheRequest() {
  const token = getAuthToken();
  const url = buildCompanyRemoveCacheUrl();
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok) {
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      `Request failed (${status})`;
    throw new Error(msg);
  }
  if (data && data.success === false) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      'Failed to clear company cache';
    throw new Error(msg);
  }
  return data;
}

export async function fetchCompanyById(companyId) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/company/get/${encodeURIComponent(companyId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok) {
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      `Request failed (${status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * PATCH company update with FormData: `barcode_settings` = JSON.stringify(settings).
 */
export async function patchCompanyBarcodeSettings(companyId, settingsObject) {
  const token = getAuthToken();
  const fd = new FormData();
  fd.append('barcode_settings', JSON.stringify(settingsObject));

  const url = `${API_BASE_URL}/company/update/${encodeURIComponent(companyId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    body: fd,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok) {
    const msg =
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      `Request failed (${status})`;
    throw new Error(msg);
  }
  return data;
}
