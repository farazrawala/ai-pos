import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { isUserUploadFilePart } from '../users/usersAPI.js';

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
  setIf('sheetHeightAuto', get('sheetHeightAuto', 'sheet_height_auto'));
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
    sheet_height_auto: values.sheetHeightAuto,
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
  return resolveCategoryMediaUrl(raw);
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
  if (fileField?.file && isUserUploadFilePart(fileField.file)) {
    const fileName = fileField.file.name || 'upload';
    fd.append(fileField.name, fileField.file, fileName);
  }

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
  return {
    ...fallback,
    ...fetched,
    ...(printerRaw != null ? { printer_settings: printerRaw, printerSettings: printerRaw } : {}),
    ...(productRaw != null ? { product_settings: productRaw, productSettings: productRaw } : {}),
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
