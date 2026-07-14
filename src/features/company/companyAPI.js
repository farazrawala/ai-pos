import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { isUserUploadFilePart } from '../users/usersAPI.js';
import { DEFAULT_PRINTER } from '../printers/printerConstants.js';
import { isValidPrinterIp, isValidPort } from '../printers/printerValidation.js';

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

/** Warehouse ref → id string (populated doc or plain id). */
export function pickWarehouseRefId(raw) {
  return pickAccountRefId(raw);
}

export function getWarehouseFromCompany(company) {
  const raw = company?.warehouse_id ?? company?.warehouseId ?? company?.warehouse;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  return null;
}

export function getWarehouseIdFromCompany(company) {
  return pickWarehouseRefId(company?.warehouse_id ?? company?.warehouseId ?? company?.warehouse);
}

/**
 * Flat map of login company ids (warehouse + default accounts) from cached session.
 * @returns {{ companyId: string; warehouseId: string; [key: string]: string }}
 */
export function resolveLoginSessionParams(user = null, company = null) {
  const resolvedCompany = company || extractCompanyFromUser(user);
  /** @type {Record<string, string>} */
  const params = {
    companyId: getCompanyIdFromUser(user) || pickCompanyIdString(resolvedCompany),
    warehouseId: getWarehouseIdFromCompany(resolvedCompany),
  };

  const userId = user?._id ?? user?.id;
  if (userId != null) params.userId = String(userId).trim();

  for (const key of COMPANY_DEFAULT_ACCOUNT_KEYS) {
    const accountId = pickAccountRefId(resolvedCompany?.[key]);
    if (accountId) params[key] = accountId;
  }

  return params;
}

function companyHasRequiredKeys(company, requiredKeys = []) {
  if (!requiredKeys.length) return true;
  for (const key of requiredKeys) {
    if (key === 'warehouse_id') {
      if (!getWarehouseIdFromCompany(company)) return false;
      continue;
    }
    if (!pickAccountRefId(company?.[key])) return false;
  }
  return true;
}

/**
 * Use populated company from login cache; fetch GET company only when required keys are missing.
 */
export async function ensureCompanyFromCache(
  user = null,
  companyFromStore = null,
  { requiredKeys = [] } = {}
) {
  let company = companyFromStore || extractCompanyFromUser(user);
  const companyId = getCompanyIdFromUser(user) || pickCompanyIdString(company);

  if (companyId && !companyHasRequiredKeys(company, requiredKeys)) {
    try {
      const body = await fetchCompanyById(companyId);
      company = extractCompanyRecord(body) || company;
    } catch (err) {
      console.warn('[Company] Could not load company for missing login cache fields', err);
    }
  }

  return company;
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
  if (
    !company &&
    root.company &&
    typeof root.company === 'object' &&
    !Array.isArray(root.company)
  ) {
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
  setIf('sheetWidthAuto', get('sheetWidthAuto', 'sheet_width_auto'));
  setIf('sheetHeightAuto', get('sheetHeightAuto', 'sheet_height_auto'));
  setIf('sheetHeightMode', get('sheetHeightMode', 'sheet_height_mode'));
  setIf('sheetHeightIn', get('sheetHeightIn', 'sheet_height_in'));
  setIf('sheetWidthMm', get('sheetWidthMm', 'sheet_width_mm'));
  setIf('sheetHeightMm', get('sheetHeightMm', 'sheet_height_mm'));
  setIf('labelWidthMm', get('labelWidthMm', 'label_width_mm'));
  setIf('labelHeightMm', get('labelHeightMm', 'label_height_mm'));
  setIf('totalRows', get('totalRows', 'total_rows'));
  setIf('totalCols', get('totalCols', 'total_cols'));
  setIf('labelGapHorizontalMm', get('labelGapHorizontalMm', 'label_gap_horizontal_mm'));
  setIf('labelGapVerticalMm', get('labelGapVerticalMm', 'label_gap_vertical_mm'));
  setIf('sheetMarginTopMm', get('sheetMarginTopMm', 'sheet_margin_top_mm'));
  setIf('sheetMarginLeftMm', get('sheetMarginLeftMm', 'sheet_margin_left_mm'));
  setIf('sheetMarginBottomMm', get('sheetMarginBottomMm', 'sheet_margin_bottom_mm'));
  setIf('textMarginTopMm', get('textMarginTopMm', 'text_margin_top_mm'));
  setIf('barcodeMarginTopMm', get('barcodeMarginTopMm', 'barcode_margin_top_mm'));
  setIf('autoFitLabel', get('autoFitLabel', 'auto_fit_label'));
  setIf('barCodeWidthField', get('barCodeWidthField', 'bar_code_width'));
  setIf('barCodeHeightField', get('barCodeHeightField', 'bar_code_height'));
  setIf('fontSize', get('fontSize', 'font_size'));
  setIf('showProductName', get('showProductName', 'show_product_name'));
  setIf('showLocation', get('showLocation', 'show_location', 'business_location'));
  setIf('showWarehouse', get('showWarehouse', 'show_warehouse'));
  setIf('showPrice', get('showPrice', 'show_price'));
  setIf('showProductCode', get('showProductCode', 'show_product_code'));
  setIf('showBarcodeNumber', get('showBarcodeNumber', 'show_barcode_number'));
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
    sheet_width_auto: values.sheetWidthAuto,
    sheet_height_auto: values.sheetHeightMode === 'auto',
    sheet_height_mode: values.sheetHeightMode,
    sheet_height_in: values.sheetHeightIn,
    label_width_mm: values.labelWidthMm,
    label_height_mm: values.labelHeightMm,
    total_rows: values.totalRows,
    total_cols: values.totalCols,
    label_gap_horizontal_mm: values.labelGapHorizontalMm,
    label_gap_vertical_mm: values.labelGapVerticalMm,
    sheet_margin_top_mm: values.sheetMarginTopMm,
    sheet_margin_left_mm: values.sheetMarginLeftMm,
    sheet_margin_bottom_mm: values.sheetMarginBottomMm,
    text_margin_top_mm: values.textMarginTopMm,
    barcode_margin_top_mm: values.barcodeMarginTopMm,
    auto_fit_label: values.autoFitLabel !== false,
    bar_code_width: values.barCodeWidthField,
    bar_code_height: values.barCodeHeightField,
    font_size: values.fontSize,
    show_product_name: values.showProductName,
    show_location: values.showLocation,
    show_warehouse: values.showWarehouse,
    show_price: values.showPrice,
    show_product_code: values.showProductCode,
    show_barcode_number: values.showBarcodeNumber,
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

/** Pull the most specific API error string from a JSON envelope. */
function extractCompanyApiErrorMessage(data, status) {
  if (!data || typeof data !== 'object') {
    return `Request failed (${status})`;
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }
  if (data.error && typeof data.error === 'object') {
    if (typeof data.error.message === 'string' && data.error.message.trim()) {
      return data.error.message.trim();
    }
    if (typeof data.error.error === 'string' && data.error.error.trim()) {
      return data.error.error.trim();
    }
  }
  if (typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail.trim();
  }
  if (typeof data.details === 'string' && data.details.trim()) {
    return data.details.trim();
  }
  if (data.data && typeof data.data === 'object' && typeof data.data.message === 'string') {
    const nested = data.data.message.trim();
    if (nested) return nested;
  }
  try {
    const compact = JSON.stringify(data);
    if (compact && compact !== '{}') {
      return compact.length > 500 ? `${compact.slice(0, 500)}…` : compact;
    }
  } catch {
    /* ignore circular payloads */
  }
  return `Request failed (${status})`;
}

function throwCompanyApiError(data, status) {
  const message = extractCompanyApiErrorMessage(data, status);
  const err = new Error(message);
  err.status = status;
  err.payload = data;
  throw err;
}

/** Coerce list-cache rows so `key` is always a string (avoids render issues). */
export function normalizeCompanyCacheEntries(raw) {
  if (raw == null) return [];
  const rows = Array.isArray(raw) ? raw : typeof raw === 'object' ? Object.entries(raw) : [];
  const normalized = [];

  for (const item of rows) {
    let row = item;
    if (Array.isArray(item) && item.length >= 2) {
      const [cacheKey, value] = item;
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        row = { ...value, key: value.key ?? cacheKey };
      } else {
        row = { key: cacheKey, value_summary: value };
      }
    }

    if (row == null) continue;
    if (typeof row === 'string' || typeof row === 'number') {
      normalized.push({ key: String(row) });
      continue;
    }
    if (typeof row !== 'object' || Array.isArray(row)) continue;

    const key = row.key != null && row.key !== '' ? String(row.key) : '';
    normalized.push({ ...row, key });
  }

  return normalized;
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
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return {
    ...data,
    entries: normalizeCompanyCacheEntries(data?.entries),
  };
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
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return data;
}

/** GET URL for all tenant Redis queues (`/api/company/queue`). */
export function buildCompanyQueuesUrl() {
  return `${API_BASE_URL}/company/queue`;
}

/** GET URL for one module queue (`/api/company/queue/:module`). */
export function buildCompanyQueueModuleUrl(module = 'process') {
  const mod = String(module || 'process').trim() || 'process';
  return `${API_BASE_URL}/company/queue/${encodeURIComponent(mod)}`;
}

/** DELETE URL to clear a tenant module queue. */
export function buildCompanyClearQueueUrl(module = 'process') {
  return buildCompanyQueueModuleUrl(module);
}

/** Normalize pending queue rows from API (`jobId` / `member`, `score`). */
export function normalizeQueuePending(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (item == null) return { rank: index + 1, jobId: '', score: null };
    if (typeof item === 'string' || typeof item === 'number') {
      return { rank: index + 1, jobId: String(item), score: null };
    }
    const jobId = item.jobId ?? item.job_id ?? item.member ?? item.id ?? '';
    return {
      rank: index + 1,
      jobId: jobId != null && jobId !== '' ? String(jobId) : '',
      score: item.score ?? null,
    };
  });
}

/**
 * GET `company/queue` — list all module queues for the signed-in company.
 */
export async function fetchCompanyQueues() {
  const token = getAuthToken();
  const url = buildCompanyQueuesUrl();
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  const queues = Array.isArray(data?.queues) ? data.queues : [];
  return {
    ...data,
    queues: queues.map((row) => ({
      ...row,
      pending: normalizeQueuePending(row.pending),
    })),
  };
}

/**
 * GET `company/queue/:module` — peek pending jobs for one queue (e.g. `process`).
 */
export async function fetchCompanyQueueModule(module = 'process') {
  const token = getAuthToken();
  const url = buildCompanyQueueModuleUrl(module);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return {
    ...data,
    pending: normalizeQueuePending(data?.pending),
  };
}

/**
 * DELETE `company/queue/:module` — clear all jobs in a tenant module queue.
 */
export async function clearCompanyQueueModule(module = 'process') {
  const token = getAuthToken();
  const url = buildCompanyClearQueueUrl(module);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
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
  if (data && data.success === false) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      'Failed to load company';
    throw new Error(msg);
  }
  return data;
}

/** Company document from GET/PATCH `{ success, data: { ... } }` or a raw company object. */
export function getCompanyFromApiBody(body) {
  return extractCompanyRecord(body);
}

/**
 * PATCH company update with FormData: `barcode_settings` = JSON.stringify(settings).
 */
export async function patchCompanyBarcodeSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    barcode_settings: JSON.stringify(settingsObject),
  });
}

export const COMPANY_LOGO_FIELD = 'company_logo';

export function pickCompanyLogoUrl(company) {
  if (!company || typeof company !== 'object') return '';
  const raw =
    company.company_logo ?? company.companyLogo ?? company.logo ?? company.logo_image ?? '';
  if (raw == null || raw === '') return '';
  // Reject File/Blob leftovers from a bad merge (would stringify to "[object File]").
  if (typeof File !== 'undefined' && raw instanceof File) return '';
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return '';
  if (typeof raw === 'object' && raw !== null && !('url' in raw)) return '';
  const resolved = resolveCategoryMediaUrl(raw);
  if (!resolved || /\[object\s/i.test(resolved)) return '';
  return resolved;
}

function normalizeSingleCompanyPayload(body) {
  const record = extractCompanyRecord(body);
  if (!record || typeof record !== 'object') return null;
  if (record.company_name != null || record.name != null || record._id != null) {
    return record;
  }
  return null;
}

function appendCompanyFieldsToFormData(formData, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });
}

async function patchCompanyFormFields(companyId, fields = {}, fileField = null) {
  const token = getAuthToken();
  const fd = new FormData();
  appendCompanyFieldsToFormData(fd, fields);
  const fileEntries = Array.isArray(fileField) ? fileField : fileField ? [fileField] : [];
  fileEntries.forEach((entry) => {
    if (entry?.file && isUserUploadFilePart(entry.file) && entry.name) {
      const fileName = entry.file.name || 'upload';
      fd.append(entry.name, entry.file, fileName);
    }
  });

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
  if (data && data.success === false) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      'Failed to update company';
    throw new Error(msg);
  }
  return normalizeSingleCompanyPayload(data) || data;
}

/** PATCH company profile fields (name, contact, address, logo). */
export async function updateCompanyDetailsRequest(companyId, payload = {}) {
  const { company_logo, ...rest } = payload;
  const fields = {};
  if (rest.company_name !== undefined) fields.company_name = String(rest.company_name).trim();
  if (rest.company_phone !== undefined) fields.company_phone = String(rest.company_phone).trim();
  if (rest.company_email !== undefined) fields.company_email = String(rest.company_email).trim();
  if (rest.company_address !== undefined)
    fields.company_address = String(rest.company_address).trim();

  const useMultipart = isUserUploadFilePart(company_logo);
  if (useMultipart) {
    return patchCompanyFormFields(companyId, fields, {
      name: COMPANY_LOGO_FIELD,
      file: company_logo,
    });
  }
  return patchCompanyFormFields(companyId, fields);
}

/** Printer toggle metadata keyed by `show_*` field name. */
const PRINTER_SETTING_META = {
  show_logo: {
    label: 'Show logo on invoice',
    // hint: 'Uses company_logo image from company details',
    defaultValue: true,
  },
  show_company_name: { label: 'Show company name', defaultValue: true },
  show_phone: { label: 'Show company phone number', defaultValue: true },
  show_email: { label: 'Show company email', defaultValue: true },
  show_address: { label: 'Show company address', defaultValue: true },
  show_invoice_no: { label: 'Show invoice number', defaultValue: true },
  show_qrcode: {
    label: 'Show QR code',
    hint: 'Encodes the invoice public URL',
    defaultValue: true,
  },
  show_invoice_date: { label: 'Show invoice date', defaultValue: true },
  show_change_return: { label: 'Show change / return', defaultValue: true },
  show_payment_method: { label: 'Show payment method', defaultValue: true },
  show_customer_phone: { label: 'Show customer phone', defaultValue: true },
  show_customer_email: { label: 'Show customer email', defaultValue: true },
  show_gross_amount: { label: 'Show gross amount', defaultValue: true },
  show_discount: { label: 'Show discount', defaultValue: true },
  show_shipping: { label: 'Show shipping', defaultValue: true },
  show_payment_made: { label: 'Show payment made', defaultValue: true },
  show_balance_due: { label: 'Show balance due', defaultValue: true },
};

/** Grouped by invoice layout (top → bottom). */
export const PRINTER_SETTING_SECTIONS = [
  {
    title: 'Company header',
    keys: ['show_logo', 'show_company_name', 'show_phone', 'show_email', 'show_address'],
  },
  {
    title: 'Invoice header',
    keys: ['show_invoice_no'],
  },
  {
    title: 'Invoice details',
    keys: [
      'show_invoice_date',
      'show_change_return',
      'show_payment_method',
      'show_customer_phone',
      'show_customer_email',
      'show_gross_amount',
    ],
  },
  {
    title: 'Summary',
    keys: ['show_discount', 'show_shipping', 'show_payment_made', 'show_balance_due'],
  },
  {
    title: 'Bottom section',
    keys: ['show_qrcode'],
  },
];

/** Flat list in invoice layout order (derived from sections). */
export const PRINTER_SETTING_DEFS = PRINTER_SETTING_SECTIONS.flatMap(({ keys }) =>
  keys.map((key) => ({ key, ...PRINTER_SETTING_META[key] }))
);

/** @deprecated use PRINTER_SETTING_DEFS */
export const INVOICE_PRINT_SETTING_DEFS = PRINTER_SETTING_DEFS;

export function defaultPrinterSettings() {
  const out = {};
  PRINTER_SETTING_DEFS.forEach(({ key, defaultValue }) => {
    out[key] = defaultValue;
  });
  return out;
}

/** @deprecated use defaultPrinterSettings */
export function defaultInvoicePrintSettings() {
  return defaultPrinterSettings();
}

export function parsePrinterSettings(raw) {
  return parseBarcodeSettings(raw);
}

/** Coerce API / form values into a boolean printer toggle. */
export function coerceSettingBool(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === 'no' || s === 'off' || s === '') return false;
  }
  return Boolean(value);
}

const PRINTER_SETTING_ALT_KEYS = {
  show_qrcode: ['show_qr_code', 'showQRCode', 'showQrCode'],
};

function readPrinterSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw =
    company.printer_settings ??
    company.printerSettings ??
    company.invoice_settings ??
    company.invoiceSettings;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parsePrinterSettings(allFields);
    if (parsed?.printer_settings != null) return parsed.printer_settings;
    if (parsed?.printerSettings != null) return parsed.printerSettings;
    if (parsed?.show_qrcode !== undefined || parsed?.show_logo !== undefined) return parsed;
    return null;
  }

  if (typeof allFields === 'object') {
    raw =
      allFields.printer_settings ??
      allFields.printerSettings ??
      allFields.invoice_settings ??
      allFields.invoiceSettings;
    if (raw != null) return raw;
    if (allFields.show_qrcode !== undefined || allFields.show_logo !== undefined) {
      return allFields;
    }
  }

  return null;
}

/** Merge fetched company with session company, keeping printer settings when GET omits them. */
export function mergeCompanyRecordForSettings(fetched, fallback) {
  if (!fetched) return fallback ?? null;
  if (!fallback) return fetched;
  const printerRaw = readPrinterSettingsRaw(fetched) ?? readPrinterSettingsRaw(fallback) ?? null;
  const productRaw = readProductSettingsRaw(fetched) ?? readProductSettingsRaw(fallback) ?? null;
  const smsRaw = readLocalSmsSettingsRaw(fetched) ?? readLocalSmsSettingsRaw(fallback) ?? null;
  const apiSmsRaw = readApiSmsSettingsRaw(fetched) ?? readApiSmsSettingsRaw(fallback) ?? null;
  const emailAlertsRaw =
    readEmailAlertsSettingsRaw(fetched) ?? readEmailAlertsSettingsRaw(fallback) ?? null;
  const defaultPrinterRaw =
    readDefaultPrinterSettingsRaw(fetched) ?? readDefaultPrinterSettingsRaw(fallback) ?? null;
  return {
    ...fallback,
    ...fetched,
    ...(printerRaw != null ? { printer_settings: printerRaw, printerSettings: printerRaw } : {}),
    ...(productRaw != null ? { product_settings: productRaw, productSettings: productRaw } : {}),
    ...(smsRaw != null ? { local_sms: smsRaw, localSms: smsRaw } : {}),
    ...(apiSmsRaw != null ? { api_sms: apiSmsRaw, apiSms: apiSmsRaw } : {}),
    ...(emailAlertsRaw != null
      ? { email_alerts: emailAlertsRaw, emailAlerts: emailAlertsRaw }
      : {}),
    ...(defaultPrinterRaw != null
      ? { default_printer_settings: defaultPrinterRaw, defaultPrinterSettings: defaultPrinterRaw }
      : {}),
  };
}

/** @deprecated use parsePrinterSettings */
export function parseInvoicePrintSettings(raw) {
  return parsePrinterSettings(raw);
}

export function extractPrinterSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parsePrinterSettings(readPrinterSettingsRaw(company));
}

/** @deprecated use extractPrinterSettingsFromCompanyBody */
export function extractInvoicePrintSettingsFromCompanyBody(body) {
  return extractPrinterSettingsFromCompanyBody(body);
}

export function normalizeIncomingPrinterSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultPrinterSettings();
  const out = { ...defaults };
  PRINTER_SETTING_DEFS.forEach(({ key }) => {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const candidates = [key, camel, ...(PRINTER_SETTING_ALT_KEYS[key] || [])];
    for (const candidate of candidates) {
      if (parsed[candidate] !== undefined) {
        out[key] = coerceSettingBool(parsed[candidate]);
        break;
      }
    }
  });
  return out;
}

/** @deprecated use normalizeIncomingPrinterSettings */
export function normalizeIncomingInvoicePrintSettings(parsed) {
  return normalizeIncomingPrinterSettings(parsed);
}

export function mergePrinterSettings(parsed) {
  return normalizeIncomingPrinterSettings(parsed) || defaultPrinterSettings();
}

/** @deprecated use mergePrinterSettings */
export function mergeInvoicePrintSettings(parsed) {
  return mergePrinterSettings(parsed);
}

/** Full JSON object saved to company `printer_settings`. */
export function buildPrinterSettingsPayload(values) {
  const out = {};
  PRINTER_SETTING_DEFS.forEach(({ key }) => {
    out[key] = Boolean(values[key]);
  });
  return out;
}

/** @deprecated use buildPrinterSettingsPayload */
export function buildInvoicePrintSettingsPayload(values) {
  return buildPrinterSettingsPayload(values);
}

export async function patchCompanyPrinterSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    printer_settings: JSON.stringify(settingsObject),
  });
}

/** @deprecated use patchCompanyPrinterSettings */
export async function patchCompanyInvoicePrintSettings(companyId, settingsObject) {
  return patchCompanyPrinterSettings(companyId, settingsObject);
}

/** Product toggle metadata keyed by snake_case field name. */
const PRODUCT_SETTING_META = {
  allow_add_to_cart_when_stock_insufficient: {
    label: 'Add to cart when stock is insufficient',
    hint: 'When turned off, POS blocks adding products that would exceed available stock.',
    defaultValue: true,
  },
};

export const PRODUCT_SETTING_DEFS = Object.entries(PRODUCT_SETTING_META).map(([key, meta]) => ({
  key,
  ...meta,
}));

export function defaultProductSettings() {
  const out = {};
  PRODUCT_SETTING_DEFS.forEach(({ key, defaultValue }) => {
    out[key] = defaultValue;
  });
  return out;
}

const PRODUCT_SETTING_ALT_KEYS = {
  allow_add_to_cart_when_stock_insufficient: [
    'allowAddToCartWhenStockInsufficient',
    'add_to_cart_when_stock_insufficient',
  ],
};

function readProductSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw = company.product_settings ?? company.productSettings;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.product_settings != null) return parsed.product_settings;
    if (parsed?.productSettings != null) return parsed.productSettings;
    if (parsed?.allow_add_to_cart_when_stock_insufficient !== undefined) return parsed;
    return null;
  }

  if (typeof allFields === 'object') {
    raw = allFields.product_settings ?? allFields.productSettings;
    if (raw != null) return raw;
    if (allFields.allow_add_to_cart_when_stock_insufficient !== undefined) {
      return allFields;
    }
  }

  return null;
}

export function extractProductSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readProductSettingsRaw(company));
}

export function normalizeIncomingProductSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultProductSettings();
  const out = { ...defaults };
  PRODUCT_SETTING_DEFS.forEach(({ key }) => {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const candidates = [key, camel, ...(PRODUCT_SETTING_ALT_KEYS[key] || [])];
    for (const candidate of candidates) {
      if (parsed[candidate] !== undefined) {
        out[key] = coerceSettingBool(parsed[candidate]);
        break;
      }
    }
  });
  return out;
}

export function mergeProductSettings(parsed) {
  return normalizeIncomingProductSettings(parsed) || defaultProductSettings();
}

/** Full JSON object saved to company `product_settings`. */
export function buildProductSettingsPayload(values) {
  const out = {};
  PRODUCT_SETTING_DEFS.forEach(({ key }) => {
    out[key] = Boolean(values[key]);
  });
  return out;
}

export async function patchCompanyProductSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    product_settings: JSON.stringify(settingsObject),
  });
}

/** Big Commerce marketplace branding + visibility — single String field on company. */
export const BIGCOMMERCE_SETTINGS_FIELD = 'bigcommerce_settings';
/** Multipart file field names merged into `bigcommerce_settings` (logo / banner URLs). */
export const BIGCOMMERCE_LOGO_FIELD = 'logo';
export const BIGCOMMERCE_BANNER_FIELD = 'banner';

const BIGCOMMERCE_SETTING_META = {
  show_store_for_listing: {
    label: 'Show store for listing',
    hint: 'When on, this company appears in the Big Commerce company listing.',
    defaultValue: true,
  },
  show_store_for_request: {
    label: 'Show store for request',
    hint: 'When on, visitors can submit store / quote requests from the marketplace.',
    defaultValue: false,
  },
};

export const BIGCOMMERCE_SETTING_DEFS = Object.entries(BIGCOMMERCE_SETTING_META).map(
  ([key, meta]) => ({
    key,
    ...meta,
  })
);

export function defaultBigCommerceSettings() {
  const out = {
    logo: '',
    banner: '',
  };
  BIGCOMMERCE_SETTING_DEFS.forEach(({ key, defaultValue }) => {
    out[key] = defaultValue;
  });
  return out;
}

const BIGCOMMERCE_SETTING_ALT_KEYS = {
  show_store_for_listing: ['showStoreForListing', 'show_products', 'showProducts', 'show_product'],
  show_store_for_request: ['showStoreForRequest', 'show_store_request'],
};

function readBigCommerceSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw =
    company.bigcommerce_settings ??
    company.bigcommerceSettings ??
    company.big_commerce_settings ??
    company.bigCommerceSettings;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.bigcommerce_settings != null) return parsed.bigcommerce_settings;
    if (parsed?.bigcommerceSettings != null) return parsed.bigcommerceSettings;
    if (
      parsed?.show_store_for_listing !== undefined ||
      parsed?.show_products !== undefined ||
      parsed?.show_store_for_request !== undefined ||
      parsed?.logo !== undefined ||
      parsed?.banner !== undefined
    ) {
      return parsed;
    }
    return null;
  }

  if (typeof allFields === 'object') {
    raw =
      allFields.bigcommerce_settings ??
      allFields.bigcommerceSettings ??
      allFields.big_commerce_settings ??
      allFields.bigCommerceSettings;
    if (raw != null) return raw;
    if (
      allFields.show_store_for_listing !== undefined ||
      allFields.show_products !== undefined ||
      allFields.show_store_for_request !== undefined
    ) {
      return allFields;
    }
  }

  return null;
}

export function extractBigCommerceSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readBigCommerceSettingsRaw(company));
}

function pickMediaString(parsed, keys) {
  if (!parsed || typeof parsed !== 'object') return '';
  for (const key of keys) {
    const raw = parsed[key];
    if (raw == null || raw === '') continue;
    if (typeof File !== 'undefined' && raw instanceof File) continue;
    if (typeof Blob !== 'undefined' && raw instanceof Blob) continue;
    if (typeof raw === 'object' && raw !== null && 'url' in raw) {
      const url = String(raw.url || '').trim();
      if (url) return url;
      continue;
    }
    const s = String(raw).trim();
    if (s && !/^\[object\s/i.test(s)) return s;
  }
  return '';
}

export function normalizeIncomingBigCommerceSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultBigCommerceSettings();
  const out = { ...defaults };
  BIGCOMMERCE_SETTING_DEFS.forEach(({ key }) => {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const candidates = [key, camel, ...(BIGCOMMERCE_SETTING_ALT_KEYS[key] || [])];
    for (const candidate of candidates) {
      if (parsed[candidate] !== undefined) {
        out[key] = coerceSettingBool(parsed[candidate]);
        break;
      }
    }
  });
  out.logo = pickMediaString(parsed, ['logo', 'bigcommerce_logo', 'bigcommerceLogo']) || '';
  out.banner =
    pickMediaString(parsed, ['banner', 'bigcommerce_banner', 'bigcommerceBanner', 'cover']) || '';
  return out;
}

export function mergeBigCommerceSettings(parsed) {
  return normalizeIncomingBigCommerceSettings(parsed) || defaultBigCommerceSettings();
}

/**
 * Full object stored as JSON in company `bigcommerce_settings` (String field).
 * @param {object} values
 */
export function buildBigCommerceSettingsPayload(values = {}) {
  const out = {
    show_store_for_listing: Boolean(
      values.show_store_for_listing ?? values.show_products
    ),
    show_store_for_request: Boolean(values.show_store_for_request),
  };
  const logo = values.logo != null ? String(values.logo).trim() : '';
  const banner = values.banner != null ? String(values.banner).trim() : '';
  out.logo = logo;
  out.banner = banner;
  return out;
}

/** Resolve logo URL from `bigcommerce_settings` JSON (preferred) or legacy root fields. */
export function pickBigCommerceLogoUrl(company) {
  if (!company || typeof company !== 'object') return '';
  const fromSettings = mergeBigCommerceSettings(extractBigCommerceSettingsFromCompanyBody({ data: company }));
  if (fromSettings.logo) return resolveCategoryMediaUrl(fromSettings.logo);
  const raw =
    company.bigcommerce_logo ??
    company.bigcommerceLogo ??
    company.big_commerce_logo ??
    '';
  return resolveCategoryMediaUrl(raw);
}

/** Resolve banner URL from `bigcommerce_settings` JSON (preferred) or legacy root fields. */
export function pickBigCommerceBannerUrl(company) {
  if (!company || typeof company !== 'object') return '';
  const fromSettings = mergeBigCommerceSettings(extractBigCommerceSettingsFromCompanyBody({ data: company }));
  if (fromSettings.banner) return resolveCategoryMediaUrl(fromSettings.banner);
  const raw =
    company.bigcommerce_banner ??
    company.bigcommerceBanner ??
    company.big_commerce_banner ??
    company.company_cover ??
    company.cover_image ??
    '';
  return resolveCategoryMediaUrl(raw);
}

/**
 * Read an image File as a data URL for embedding in `bigcommerce_settings` (String field).
 * Max ~1.8MB raw file to keep the JSON payload within typical body limits.
 */
async function readImageFileAsDataUrl(file, { maxBytes = 1_800_000 } = {}) {
  if (!isUserUploadFilePart(file)) {
    throw new Error('Please choose a valid image file.');
  }
  if (file.size > maxBytes) {
    throw new Error(
      `Image is too large (${Math.round(file.size / 1024)} KB). Use a file under ${Math.round(maxBytes / 1024)} KB.`
    );
  }
  if (file.type && !String(file.type).startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:')) {
        reject(new Error('Failed to read image file.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function sanitizeSettingsMediaUrl(value) {
  const s = String(value || '').trim();
  if (!s || s.startsWith('blob:')) return '';
  return s;
}

/**
 * PATCH company `bigcommerce_settings` (String JSON).
 * Logo/banner Files are embedded as data URLs inside the JSON (schema has no separate file fields).
 * @returns {Promise<{ company: object, settings: object }>}
 */
export async function patchCompanyBigCommerceSettings(companyId, settingsObject, files = {}) {
  const payload = buildBigCommerceSettingsPayload(settingsObject);
  payload.logo = sanitizeSettingsMediaUrl(payload.logo);
  payload.banner = sanitizeSettingsMediaUrl(payload.banner);

  if (isUserUploadFilePart(files.logo)) {
    payload.logo = await readImageFileAsDataUrl(files.logo);
  }
  if (isUserUploadFilePart(files.banner)) {
    payload.banner = await readImageFileAsDataUrl(files.banner);
  }

  const company = await patchCompanyFormFields(companyId, {
    [BIGCOMMERCE_SETTINGS_FIELD]: JSON.stringify(payload),
  });
  return { company, settings: payload };
}

/** Local SMS alert settings saved on company as `local_sms`. */
export const DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE = `Hi {name},

Thank you for your order.
Phone: {phone}
Email: {email}
Amount: {total_amount}
Transaction #: {transaction_number}
Date: {createdAt}`;

export const LOCAL_SMS_SETTING_DEFS = [
  {
    key: 'send_sms_on_order',
    label: 'Send SMS on order',
    hint: 'Send a local SMS alert when an order is placed.',
    type: 'toggle_template',
    templateKey: 'send_sms_on_order_message',
    defaultValue: false,
  },
  {
    key: 'send_sms_greater_than',
    label: 'Send SMS greater than',
    hint: 'Only send when the order total is greater than the amount below.',
    type: 'toggle_amount',
    amountKey: 'send_sms_greater_than_amount',
    defaultValue: false,
    defaultAmount: 0,
  },
];

export function defaultLocalSmsSettings() {
  return {
    send_sms_on_order: false,
    send_sms_on_order_message: DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    send_sms_greater_than: false,
    send_sms_greater_than_amount: 0,
  };
}

function readLocalSmsSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw =
    company.local_sms ??
    company.localSms ??
    company.local_sms_settings ??
    company.localSmsSettings;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.local_sms != null) return parsed.local_sms;
    if (parsed?.localSms != null) return parsed.localSms;
    if (parsed?.local_sms_settings != null) return parsed.local_sms_settings;
    if (parsed?.localSmsSettings != null) return parsed.localSmsSettings;
    if (
      parsed?.send_sms_on_order !== undefined ||
      parsed?.send_sms_greater_than !== undefined
    ) {
      return parsed;
    }
    return null;
  }

  if (typeof allFields === 'object') {
    raw =
      allFields.local_sms ??
      allFields.localSms ??
      allFields.local_sms_settings ??
      allFields.localSmsSettings;
    if (raw != null) return raw;
    if (
      allFields.send_sms_on_order !== undefined ||
      allFields.send_sms_greater_than !== undefined
    ) {
      return allFields;
    }
  }

  return null;
}

export function extractLocalSmsSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readLocalSmsSettingsRaw(company));
}

export function normalizeIncomingLocalSmsSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultLocalSmsSettings();
  const get = (...keys) => {
    for (const k of keys) {
      if (parsed[k] !== undefined && parsed[k] !== null) return parsed[k];
    }
    return undefined;
  };
  const amountRaw = get(
    'send_sms_greater_than_amount',
    'sendSmsGreaterThanAmount',
    'sms_greater_than_amount'
  );
  const amount = Number(amountRaw);
  const messageRaw = get(
    'send_sms_on_order_message',
    'sendSmsOnOrderMessage',
    'sms_on_order_message'
  );
  const message =
    messageRaw != null && String(messageRaw).trim()
      ? String(messageRaw)
      : defaults.send_sms_on_order_message;
  return {
    send_sms_on_order: coerceSettingBool(
      get('send_sms_on_order', 'sendSmsOnOrder') ?? defaults.send_sms_on_order
    ),
    send_sms_on_order_message: message,
    send_sms_greater_than: coerceSettingBool(
      get('send_sms_greater_than', 'sendSmsGreaterThan') ?? defaults.send_sms_greater_than
    ),
    send_sms_greater_than_amount:
      Number.isFinite(amount) && amount >= 0 ? amount : defaults.send_sms_greater_than_amount,
  };
}

export function mergeLocalSmsSettings(parsed) {
  return normalizeIncomingLocalSmsSettings(parsed) || defaultLocalSmsSettings();
}

export function buildLocalSmsSettingsPayload(values) {
  const normalized = normalizeIncomingLocalSmsSettings(values) || defaultLocalSmsSettings();
  return {
    send_sms_on_order: Boolean(normalized.send_sms_on_order),
    send_sms_on_order_message: String(
      normalized.send_sms_on_order_message || DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
    ),
    send_sms_greater_than: Boolean(normalized.send_sms_greater_than),
    send_sms_greater_than_amount: Math.max(
      0,
      Number(normalized.send_sms_greater_than_amount) || 0
    ),
  };
}

export async function patchCompanyLocalSmsSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    local_sms: JSON.stringify(settingsObject),
  });
}

/** API SMS alert settings saved on company as `api_sms`. */
export const API_SMS_SETTING_DEFS = [
  {
    key: 'send_sms_on_order',
    label: 'Send SMS on order',
    hint: 'Send an API SMS alert when an order is placed.',
    type: 'toggle_template',
    templateKey: 'send_sms_on_order_message',
    defaultValue: false,
  },
  {
    key: 'send_sms_greater_than',
    label: 'Send SMS greater than',
    hint: 'Only send when the order total is greater than the amount below.',
    type: 'toggle_amount',
    amountKey: 'send_sms_greater_than_amount',
    defaultValue: false,
    defaultAmount: 0,
  },
];

export function defaultApiSmsSettings() {
  return {
    send_sms_on_order: false,
    send_sms_on_order_message: DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    send_sms_greater_than: false,
    send_sms_greater_than_amount: 0,
    api_url: '',
    api_key: '',
    api_secret: '',
  };
}

function readApiSmsSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw = company.api_sms ?? company.apiSms;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.api_sms != null) return parsed.api_sms;
    if (parsed?.apiSms != null) return parsed.apiSms;
    return null;
  }

  if (typeof allFields === 'object') {
    raw = allFields.api_sms ?? allFields.apiSms;
    if (raw != null) return raw;
  }

  return null;
}

export function extractApiSmsSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readApiSmsSettingsRaw(company));
}

export function normalizeIncomingApiSmsSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultApiSmsSettings();
  const get = (...keys) => {
    for (const k of keys) {
      if (parsed[k] !== undefined && parsed[k] !== null) return parsed[k];
    }
    return undefined;
  };
  const amountRaw = get(
    'send_sms_greater_than_amount',
    'sendSmsGreaterThanAmount',
    'sms_greater_than_amount'
  );
  const amount = Number(amountRaw);
  const messageRaw = get(
    'send_sms_on_order_message',
    'sendSmsOnOrderMessage',
    'sms_on_order_message'
  );
  const message =
    messageRaw != null && String(messageRaw).trim()
      ? String(messageRaw)
      : defaults.send_sms_on_order_message;
  return {
    send_sms_on_order: coerceSettingBool(
      get('send_sms_on_order', 'sendSmsOnOrder') ?? defaults.send_sms_on_order
    ),
    send_sms_on_order_message: message,
    send_sms_greater_than: coerceSettingBool(
      get('send_sms_greater_than', 'sendSmsGreaterThan') ?? defaults.send_sms_greater_than
    ),
    send_sms_greater_than_amount:
      Number.isFinite(amount) && amount >= 0 ? amount : defaults.send_sms_greater_than_amount,
    api_url: String(get('api_url', 'apiUrl') ?? defaults.api_url),
    api_key: String(get('api_key', 'apiKey') ?? defaults.api_key),
    api_secret: String(get('api_secret', 'apiSecret') ?? defaults.api_secret),
  };
}

export function mergeApiSmsSettings(parsed) {
  return normalizeIncomingApiSmsSettings(parsed) || defaultApiSmsSettings();
}

export function buildApiSmsSettingsPayload(values) {
  const normalized = normalizeIncomingApiSmsSettings(values) || defaultApiSmsSettings();
  return {
    send_sms_on_order: Boolean(normalized.send_sms_on_order),
    send_sms_on_order_message: String(
      normalized.send_sms_on_order_message || DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
    ),
    send_sms_greater_than: Boolean(normalized.send_sms_greater_than),
    send_sms_greater_than_amount: Math.max(
      0,
      Number(normalized.send_sms_greater_than_amount) || 0
    ),
    api_url: String(normalized.api_url || '').trim(),
    api_key: String(normalized.api_key || '').trim(),
    api_secret: String(normalized.api_secret || '').trim(),
  };
}

export async function patchCompanyApiSmsSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    api_sms: JSON.stringify(settingsObject),
  });
}

/** Email alert settings saved on company as `email_alerts`. */
export const EMAIL_ALERT_SETTING_DEFS = [
  {
    key: 'send_email_on_order',
    label: 'Send email on order',
    hint: 'Send an email alert when an order is placed.',
    type: 'toggle_template',
    templateKey: 'send_email_on_order_message',
    defaultValue: false,
  },
  {
    key: 'send_email_greater_than',
    label: 'Send email greater than',
    hint: 'Only send when the order total is greater than the amount below.',
    type: 'toggle_amount',
    amountKey: 'send_email_greater_than_amount',
    defaultValue: false,
    defaultAmount: 0,
  },
];

export function defaultEmailAlertsSettings() {
  return {
    send_email_on_order: false,
    send_email_on_order_message: DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    send_email_greater_than: false,
    send_email_greater_than_amount: 0,
    gmail_email: '',
    two_step_password: '',
  };
}

function readEmailAlertsSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw = company.email_alerts ?? company.emailAlerts;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.email_alerts != null) return parsed.email_alerts;
    if (parsed?.emailAlerts != null) return parsed.emailAlerts;
    return null;
  }

  if (typeof allFields === 'object') {
    raw = allFields.email_alerts ?? allFields.emailAlerts;
    if (raw != null) return raw;
  }

  return null;
}

export function extractEmailAlertsSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readEmailAlertsSettingsRaw(company));
}

export function normalizeIncomingEmailAlertsSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultEmailAlertsSettings();
  const get = (...keys) => {
    for (const k of keys) {
      if (parsed[k] !== undefined && parsed[k] !== null) return parsed[k];
    }
    return undefined;
  };
  const amountRaw = get(
    'send_email_greater_than_amount',
    'sendEmailGreaterThanAmount',
    'email_greater_than_amount'
  );
  const amount = Number(amountRaw);
  const messageRaw = get(
    'send_email_on_order_message',
    'sendEmailOnOrderMessage',
    'email_on_order_message'
  );
  const message =
    messageRaw != null && String(messageRaw).trim()
      ? String(messageRaw)
      : defaults.send_email_on_order_message;
  return {
    send_email_on_order: coerceSettingBool(
      get('send_email_on_order', 'sendEmailOnOrder') ?? defaults.send_email_on_order
    ),
    send_email_on_order_message: message,
    send_email_greater_than: coerceSettingBool(
      get('send_email_greater_than', 'sendEmailGreaterThan') ?? defaults.send_email_greater_than
    ),
    send_email_greater_than_amount:
      Number.isFinite(amount) && amount >= 0 ? amount : defaults.send_email_greater_than_amount,
    gmail_email: String(get('gmail_email', 'gmailEmail') ?? defaults.gmail_email).trim(),
    two_step_password: String(
      get('two_step_password', 'twoStepPassword', 'app_password', 'appPassword') ??
        defaults.two_step_password
    ),
  };
}

export function mergeEmailAlertsSettings(parsed) {
  return normalizeIncomingEmailAlertsSettings(parsed) || defaultEmailAlertsSettings();
}

export function buildEmailAlertsSettingsPayload(values) {
  const normalized = normalizeIncomingEmailAlertsSettings(values) || defaultEmailAlertsSettings();
  return {
    send_email_on_order: Boolean(normalized.send_email_on_order),
    send_email_on_order_message: String(
      normalized.send_email_on_order_message || DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
    ),
    send_email_greater_than: Boolean(normalized.send_email_greater_than),
    send_email_greater_than_amount: Math.max(
      0,
      Number(normalized.send_email_greater_than_amount) || 0
    ),
    gmail_email: String(normalized.gmail_email || '').trim(),
    two_step_password: String(normalized.two_step_password || '').trim(),
  };
}

export async function patchCompanyEmailAlertsSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    email_alerts: JSON.stringify(settingsObject),
  });
}

export function defaultDefaultPrinterSettings() {
  return { ...DEFAULT_PRINTER };
}

function readDefaultPrinterSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw = company.default_printer_settings ?? company.defaultPrinterSettings;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseBarcodeSettings(allFields);
    if (parsed?.default_printer_settings != null) return parsed.default_printer_settings;
    if (parsed?.defaultPrinterSettings != null) return parsed.defaultPrinterSettings;
    return null;
  }

  if (typeof allFields === 'object') {
    raw = allFields.default_printer_settings ?? allFields.defaultPrinterSettings;
    if (raw != null) return raw;
  }

  return null;
}

export function extractDefaultPrinterSettingsFromCompanyBody(body) {
  const company = extractCompanyRecord(body);
  if (!company || typeof company !== 'object') return null;
  return parseBarcodeSettings(readDefaultPrinterSettingsRaw(company));
}

export function normalizeIncomingDefaultPrinterSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const defaults = defaultDefaultPrinterSettings();
  const get = (...keys) => {
    for (const k of keys) {
      if (parsed[k] !== undefined && parsed[k] !== null) return parsed[k];
    }
    return undefined;
  };
  return {
    name: String(get('name') ?? defaults.name),
    ip_address: String(get('ip_address', 'ipAddress') ?? defaults.ip_address),
    port: Number(get('port')) || defaults.port,
    printer_type: get('printer_type', 'printerType') ?? defaults.printer_type,
    paper_width: get('paper_width', 'paperWidth') ?? defaults.paper_width,
    character_encoding: get('character_encoding', 'characterEncoding') ?? defaults.character_encoding,
    copies: Math.max(1, Number(get('copies')) || defaults.copies),
    auto_cut: get('auto_cut', 'autoCut') !== false,
    open_cash_drawer: Boolean(get('open_cash_drawer', 'openCashDrawer')),
    status: get('status') === 'disabled' ? 'disabled' : 'enabled',
  };
}

export function mergeDefaultPrinterSettings(parsed) {
  return normalizeIncomingDefaultPrinterSettings(parsed) || defaultDefaultPrinterSettings();
}

export function buildDefaultPrinterSettingsPayload(values) {
  const normalized = normalizeIncomingDefaultPrinterSettings(values) || defaultDefaultPrinterSettings();
  return {
    name: String(normalized.name || '').trim(),
    ip_address: String(normalized.ip_address || '').trim(),
    port: Number(normalized.port) || 9100,
    printer_type: normalized.printer_type || 'esc_pos',
    paper_width: normalized.paper_width || '80mm',
    character_encoding: normalized.character_encoding || 'utf8',
    copies: Math.max(1, Number(normalized.copies) || 1),
    auto_cut: normalized.auto_cut !== false,
    open_cash_drawer: Boolean(normalized.open_cash_drawer),
    status: normalized.status === 'disabled' ? 'disabled' : 'enabled',
  };
}

export function validateDefaultPrinterSettingsPayload(data = {}) {
  const errors = {};
  const status = data.status === 'disabled' ? 'disabled' : 'enabled';
  const hasIp = String(data.ip_address || '').trim();
  const hasName = String(data.name || '').trim();

  if (status === 'enabled') {
    if (!hasName) errors.name = 'Printer name is required';
    if (!isValidPrinterIp(hasIp)) errors.ip_address = 'Enter a valid IPv4 address';
  } else if (hasIp && !isValidPrinterIp(hasIp)) {
    errors.ip_address = 'Enter a valid IPv4 address';
  }

  if (!isValidPort(data.port ?? 9100)) errors.port = 'Port must be 1–65535';
  return errors;
}

export async function patchCompanyDefaultPrinterSettings(companyId, settingsObject) {
  return patchCompanyFormFields(companyId, {
    default_printer_settings: JSON.stringify(settingsObject),
  });
}

/** Normalize `draft_orders` from a company doc (newest first by `updated_at`). */
export function normalizeCompanyDraftOrders(companyOrBody) {
  const company =
    companyOrBody && typeof companyOrBody === 'object'
      ? extractCompanyRecord(companyOrBody) || companyOrBody
      : null;
  const raw = company?.draft_orders ?? company?.draftOrders;
  if (!Array.isArray(raw)) return [];
  return [...raw]
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const id = row._id ?? row.id;
      return {
        ...row,
        _id: id != null ? String(id) : '',
        label: String(row.label ?? '').trim() || 'Draft',
        updated_at: row.updated_at ?? row.updatedAt ?? null,
        payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
      };
    })
    .filter((row) => row && row._id)
    .sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
}

/** Read draft_orders from company store / GET company body. */
export async function fetchCompanyDraftOrders(companyId) {
  if (!companyId) return [];
  const body = await fetchCompanyById(companyId);
  return normalizeCompanyDraftOrders(body);
}

/**
 * POST `company/draft-orders/:companyId` — push `{ payload, label }` onto draft_orders.
 */
export async function addCompanyDraftOrder(companyId, { payload, label } = {}) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/company/draft-orders/${encodeURIComponent(companyId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ payload, label }),
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return data;
}

/**
 * PATCH `company/draft-orders/:companyId/:draftId` — update payload (and optional label).
 */
export async function updateCompanyDraftOrder(companyId, draftId, { payload, label } = {}) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/company/draft-orders/${encodeURIComponent(companyId)}/${encodeURIComponent(draftId)}`;
  const body = { payload };
  if (label !== undefined) body.label = label;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return data;
}

/**
 * DELETE `company/draft-orders/:companyId/:draftId` — `$pull` by subdoc `_id`.
 */
export async function removeCompanyDraftOrder(companyId, draftId) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/company/draft-orders/${encodeURIComponent(companyId)}/${encodeURIComponent(draftId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const { data, ok, status } = await parseJsonResponse(res);
  if (!ok || (data && data.success === false)) {
    throwCompanyApiError(data, status);
  }
  return data;
}
