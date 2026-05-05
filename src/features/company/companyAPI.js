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
