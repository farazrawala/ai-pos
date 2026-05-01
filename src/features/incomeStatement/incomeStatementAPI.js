import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const REPORT_PATH = 'reports/income-statement';

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

/** Demo payload when the API route is not deployed yet (dev-only fallback). */
export const DEMO_INCOME_STATEMENT = {
  revenue: [
    { label: 'Product sales', amount: 420_000 },
    { label: 'Service income', amount: 85_000 },
  ],
  costOfGoodsSold: [
    { label: 'Cost of materials', amount: 180_000 },
    { label: 'Direct labor', amount: 45_000 },
  ],
  operatingExpenses: [
    { label: 'Rent', amount: 24_000 },
    { label: 'Payroll', amount: 95_000 },
    { label: 'Marketing', amount: 12_000 },
  ],
  otherIncome: [{ label: 'Interest income', amount: 2_100 }],
  otherExpenses: [{ label: 'Bank fees', amount: 800 }],
};

const emptyReport = () => ({
  revenue: [],
  costOfGoodsSold: [],
  operatingExpenses: [],
  otherIncome: [],
  otherExpenses: [],
});

const sumLines = (lines) => {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((acc, row) => acc + (Number(row?.amount) || 0), 0);
};

/**
 * Normalize API JSON to a single report object.
 * Accepts: `data: { revenue, ... }`, root keys, or legacy `income_statement`.
 */
export function normalizeIncomeStatementPayload(result) {
  if (!result || typeof result !== 'object') return emptyReport();
  const raw =
    result.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? result.data
      : result.income_statement || result.incomeStatement || result;

  const pick = (key, ...aliases) => {
    for (const k of [key, ...aliases]) {
      if (raw[k] != null && Array.isArray(raw[k])) return raw[k];
    }
    return [];
  };

  return {
    revenue: pick('revenue', 'revenues', 'income'),
    costOfGoodsSold: pick('costOfGoodsSold', 'cost_of_goods_sold', 'cogs'),
    operatingExpenses: pick('operatingExpenses', 'operating_expenses', 'opex'),
    otherIncome: pick('otherIncome', 'other_income'),
    otherExpenses: pick('otherExpenses', 'other_expenses'),
  };
}

/**
 * GET /reports/income-statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * @param {{ startDate: string; endDate: string }} params
 * @returns {Promise<{ report: object; demo: boolean }>}
 */
export async function fetchIncomeStatementRequest(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', String(params.startDate));
  if (params.endDate) query.set('endDate', String(params.endDate));
  const qs = query.toString();
  const url = `${BASE_URL}${REPORT_PATH}${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    if (import.meta.env.DEV && (response.status === 404 || response.status === 501)) {
      console.warn(
        '[Income statement module] Report endpoint unavailable; using demo data (dev only).'
      );
      return { report: DEMO_INCOME_STATEMENT, demo: true };
    }
    const text = await response.text().catch(() => '');
    let message = `HTTP ${response.status}`;
    if (text) {
      try {
        const j = JSON.parse(text);
        if (j?.message) message = j.message;
        else if (j?.error) message = typeof j.error === 'string' ? j.error : message;
      } catch {
        const one = text.replace(/\s+/g, ' ').slice(0, 200);
        if (one) message = one;
      }
    }
    throw new Error(message);
  }

  const result = await response.json();
  const report = normalizeIncomeStatementPayload(result);
  return { report, demo: false };
}

export function computeIncomeStatementTotals(report) {
  const r = report || emptyReport();
  const totalRevenue = sumLines(r.revenue);
  const totalCOGS = sumLines(r.costOfGoodsSold);
  const grossProfit = totalRevenue - totalCOGS;
  const totalOperatingExpenses = sumLines(r.operatingExpenses);
  const operatingIncome = grossProfit - totalOperatingExpenses;
  const totalOtherIncome = sumLines(r.otherIncome);
  const totalOtherExpenses = sumLines(r.otherExpenses);
  const netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    totalOperatingExpenses,
    operatingIncome,
    totalOtherIncome,
    totalOtherExpenses,
    netIncome,
  };
}
