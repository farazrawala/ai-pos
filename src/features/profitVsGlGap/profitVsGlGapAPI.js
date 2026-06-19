import { buildApiUrl } from '../../config/apiConfig.js';

const REPORT_PATH = 'account/profit-vs-gl-gap-breakdown';

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

export function buildProfitVsGlGapUrl() {
  return buildApiUrl(REPORT_PATH);
}

/**
 * @param {unknown} result
 */
export function normalizeProfitVsGlGapPayload(result) {
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
    profit_vs_gl_gap: Number(raw.profit_vs_gl_gap) || 0,
    profit_reconciliation_aligned: Boolean(raw.profit_reconciliation_aligned),
    formula: raw.formula ?? {},
    line_profit_method: raw.line_profit_method ?? {},
    gl_bridged_method: raw.gl_bridged_method ?? {},
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    hints: Array.isArray(raw.hints) ? raw.hints : [],
  };
}

/**
 * GET /account/profit-vs-gl-gap-breakdown
 * @returns {Promise<{ report: ReturnType<typeof normalizeProfitVsGlGapPayload> }>}
 */
export async function fetchProfitVsGlGapRequest() {
  const url = buildProfitVsGlGapUrl();
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      result?.message || result?.error || `Failed to load profit vs GL gap (${res.status})`;
    throw new Error(msg);
  }

  const report = normalizeProfitVsGlGapPayload(result);
  if (!report) {
    throw new Error('Invalid profit vs GL gap response');
  }

  return { report };
}
