import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const BALANCE_SHEET_PATH = 'account/balance-sheet';

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

export function buildAdvanceBalanceSheetUrl() {
  return `${BASE_URL}${BALANCE_SHEET_PATH}`;
}

/**
 * Normalize API JSON to the balance sheet report object.
 * Accepts `{ success, data: { ok, assets, ... } }` or root payload.
 */
export function normalizeAdvanceBalanceSheetPayload(result) {
  if (!result || typeof result !== 'object') return null;
  const raw =
    result.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? result.data
      : result;

  if (!raw || typeof raw !== 'object') return null;

  return {
    ok: Boolean(raw.ok),
    company_id: raw.company_id ?? null,
    as_of: raw.as_of ?? null,
    assets: raw.assets ?? {},
    liabilities_and_equity: raw.liabilities_and_equity ?? {},
    summary: raw.summary ?? {},
    diagnostics: raw.diagnostics ?? {},
  };
}

/**
 * GET /account/balance-sheet
 * @returns {Promise<{ report: object }>}
 */
export async function fetchAdvanceBalanceSheetRequest() {
  const url = buildAdvanceBalanceSheetUrl();
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      result?.message || result?.error || `Failed to load balance sheet (${res.status})`;
    throw new Error(msg);
  }

  const report = normalizeAdvanceBalanceSheetPayload(result);
  if (!report) {
    throw new Error('Invalid balance sheet response');
  }

  return { report };
}
