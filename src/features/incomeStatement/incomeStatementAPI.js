import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  buildFetchAccountsByTypeUrl,
  fetchAccountsByTypeRequest,
} from '../accounts/accountsAPI.js';

const BASE_URL = `${API_BASE_URL}/`;
const REPORT_PATH = 'reports/income-statement';
const ORDER_SALES_PATH = 'order/sales';
const SALES_RETURN_SALES_PATH = 'sales_return/sales';
const PURCHASE_ORDER_PURCHASES_PATH = 'purchase_order/purchases';
const PURCHASE_RETURN_PURCHASES_PATH = 'purchase_return/purchases';
const COGS_BY_ORDER_ITEM_PATH = 'order_item/cost-of-goods-sold-by-order-item';

const SALES_LABEL = 'Sales';
const SALES_RETURN_LABEL = 'Sales returns';
const COGS_LABEL = 'Cost of Goods Sold';
const PURCHASES_LABEL = 'Purchases';
const PURCHASE_RETURNS_LABEL = 'Purchase returns';

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
  revenue: [{ label: 'Sales', amount: 420_000 }],
  costOfGoodsSold: [{ label: 'Cost of Goods Sold', amount: 180_000 }],
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

/** Append period params for reporting APIs (`startDate`/`endDate` and `from`/`to` aliases). */
function appendReportDateParams(query, params = {}) {
  if (params.startDate) {
    const start = String(params.startDate);
    query.set('startDate', start);
    query.set('from', start);
  }
  if (params.endDate) {
    const end = String(params.endDate);
    query.set('endDate', end);
    query.set('to', end);
  }
}

function upsertReportLine(lines, label, amount) {
  const arr = Array.isArray(lines) ? [...lines] : [];
  const idx = arr.findIndex(
    (row) => String(row?.label || '').trim().toLowerCase() === String(label).trim().toLowerCase()
  );
  const row = { label, amount: Number(amount) || 0 };
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...row };
  } else {
    arr.push(row);
  }
  return arr;
}

async function parseJsonErrorMessage(response, fallback) {
  const text = await response.text().catch(() => '');
  let message = fallback || `HTTP ${response.status}`;
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
  return message;
}

function parseHeaderTotalAmount(result) {
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Request was not successful';
    throw new Error(msg);
  }
  const raw = result.total_amount ?? result.totalAmount;
  const totalAmount =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  const countRaw = result.document_count ?? result.documentCount ?? result.order_count ?? result.orderCount;
  const documentCount =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? countRaw
      : parseInt(String(countRaw ?? ''), 10);
  return {
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
    documentCount: Number.isFinite(documentCount) ? documentCount : 0,
  };
}

async function fetchHeaderTotalRequest(path, params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    throw new Error(await parseJsonErrorMessage(response, `HTTP ${response.status}`));
  }
  const result = await response.json().catch(() => ({}));
  return parseHeaderTotalAmount(result);
}

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
async function loadIncomeStatementReport(params = {}) {
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
  return { report: normalizeIncomeStatementPayload(result), demo: false };
}

/** GET URL for the base income statement report. */
export function buildIncomeStatementReportUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${REPORT_PATH}${qs ? `?${qs}` : ''}`;
}

async function timedIncomeStatementFetch({ key, label, url, run }) {
  const start = performance.now();
  try {
    const value = await run();
    return {
      outcome: { status: 'fulfilled', value },
      source: {
        key,
        label,
        url,
        status: 'success',
        durationMs: Math.round(performance.now() - start),
        error: null,
      },
    };
  } catch (error) {
    return {
      outcome: { status: 'rejected', reason: error },
      source: {
        key,
        label,
        url,
        status: 'error',
        durationMs: Math.round(performance.now() - start),
        error: error?.message || 'Failed',
      },
    };
  }
}

export async function fetchIncomeStatementRequest(params = {}) {
  const wallStart = performance.now();

  const tasks = [
    {
      key: 'report',
      label: 'Income statement',
      url: buildIncomeStatementReportUrl(params),
      run: () => loadIncomeStatementReport(params),
    },
    {
      key: 'sales',
      label: 'Sales',
      url: buildOrderSalesUrl(params),
      run: () => fetchOrderSalesRequest(params),
    },
    {
      key: 'salesReturns',
      label: 'Sales returns',
      url: buildSalesReturnSalesUrl(params),
      run: () => fetchSalesReturnTotalsRequest(params),
    },
    {
      key: 'purchases',
      label: 'Purchases',
      url: buildPurchaseOrderPurchasesUrl(params),
      run: () => fetchPurchaseOrderTotalsRequest(params),
    },
    {
      key: 'purchaseReturns',
      label: 'Purchase returns',
      url: buildPurchaseReturnPurchasesUrl(params),
      run: () => fetchPurchaseReturnTotalsRequest(params),
    },
    {
      key: 'cogs',
      label: 'COGS',
      url: buildCostOfGoodsSoldUrl(params),
      run: () => fetchCostOfGoodsSoldByOrderItemRequest(params),
    },
    {
      key: 'opex',
      label: 'Operating expenses',
      url: buildFetchAccountsByTypeUrl('operating_expense'),
      run: () => fetchOperatingExpensesRequest(),
    },
  ];

  const results = await Promise.all(tasks.map((task) => timedIncomeStatementFetch(task)));
  const sources = results.map((r) => r.source);

  const outcomeByKey = Object.fromEntries(
    results.map((r) => [r.source.key, r.outcome])
  );

  const reportOutcome = outcomeByKey.report;
  if (reportOutcome.status === 'rejected') {
    throw reportOutcome.reason;
  }

  let { report, demo } = reportOutcome.value;
  const salesOutcome = outcomeByKey.sales;
  const salesReturnOutcome = outcomeByKey.salesReturns;
  const purchaseOutcome = outcomeByKey.purchases;
  const purchaseReturnOutcome = outcomeByKey.purchaseReturns;
  const cogsOutcome = outcomeByKey.cogs;
  const opexOutcome = outcomeByKey.opex;

  // Demo payload includes sample other income/expense lines; do not mix those with live sales/COGS/opex.
  if (demo) {
    report = { ...report, otherIncome: [], otherExpenses: [] };
  }

  if (salesOutcome.status === 'fulfilled') {
    report = mergeOrderSalesIntoReport(report, salesOutcome.value);
  } else {
    console.warn('[Income statement module] Could not load order sales', salesOutcome.reason);
    if (!Array.isArray(report.revenue) || report.revenue.length === 0) {
      report = mergeOrderSalesIntoReport(report, { totalAmount: 0 });
    }
  }

  if (salesReturnOutcome.status === 'fulfilled') {
    report = mergeSalesReturnIntoReport(report, salesReturnOutcome.value);
  } else {
    console.warn('[Income statement module] Could not load sales returns', salesReturnOutcome.reason);
    report = mergeSalesReturnIntoReport(report, { totalAmount: 0 });
  }

  if (cogsOutcome.status === 'fulfilled') {
    report = mergeCostOfGoodsIntoReport(report, cogsOutcome.value);
  } else {
    console.warn(
      '[Income statement module] Could not load cost of goods',
      cogsOutcome.reason
    );
    if (!Array.isArray(report.costOfGoodsSold) || report.costOfGoodsSold.length === 0) {
      report = mergeCostOfGoodsIntoReport(report, { costOfGoodsSold: 0 });
    }
  }

  if (purchaseOutcome.status === 'fulfilled') {
    report = mergePurchasesIntoReport(report, purchaseOutcome.value);
  } else {
    console.warn('[Income statement module] Could not load purchases', purchaseOutcome.reason);
    report = mergePurchasesIntoReport(report, { totalAmount: 0 });
  }

  if (purchaseReturnOutcome.status === 'fulfilled') {
    report = mergePurchaseReturnsIntoReport(report, purchaseReturnOutcome.value);
  } else {
    console.warn(
      '[Income statement module] Could not load purchase returns',
      purchaseReturnOutcome.reason
    );
    report = mergePurchaseReturnsIntoReport(report, { totalAmount: 0 });
  }

  if (opexOutcome.status === 'fulfilled') {
    report = mergeOperatingExpensesIntoReport(report, opexOutcome.value);
  } else {
    console.warn(
      '[Income statement module] Could not load operating expenses',
      opexOutcome.reason
    );
    if (!Array.isArray(report.operatingExpenses) || report.operatingExpenses.length === 0) {
      report = mergeOperatingExpensesIntoReport(report, []);
    }
  }

  return {
    report,
    demo,
    sources,
    wallDurationMs: Math.round(performance.now() - wallStart),
  };
}

/** GET URL for order sales (income statement revenue). */
export function buildOrderSalesUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${ORDER_SALES_PATH}${qs ? `?${qs}` : ''}`;
}

export function buildSalesReturnSalesUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${SALES_RETURN_SALES_PATH}${qs ? `?${qs}` : ''}`;
}

export function buildPurchaseOrderPurchasesUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${PURCHASE_ORDER_PURCHASES_PATH}${qs ? `?${qs}` : ''}`;
}

export function buildPurchaseReturnPurchasesUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${PURCHASE_RETURN_PURCHASES_PATH}${qs ? `?${qs}` : ''}`;
}

/**
 * GET `order/sales` — `{ success, total_amount, order_count, order_ids }`.
 * @param {{ startDate?: string; endDate?: string }} [params]
 */
export async function fetchOrderSalesRequest(params = {}) {
  return fetchHeaderTotalRequest(ORDER_SALES_PATH, params);
}

/** GET `sales_return/sales` — period total of sales return headers. */
export async function fetchSalesReturnTotalsRequest(params = {}) {
  return fetchHeaderTotalRequest(SALES_RETURN_SALES_PATH, params);
}

/** GET `purchase_order/purchases` — period total of purchase orders. */
export async function fetchPurchaseOrderTotalsRequest(params = {}) {
  return fetchHeaderTotalRequest(PURCHASE_ORDER_PURCHASES_PATH, params);
}

/** GET `purchase_return/purchases` — period total of purchase returns. */
export async function fetchPurchaseReturnTotalsRequest(params = {}) {
  return fetchHeaderTotalRequest(PURCHASE_RETURN_PURCHASES_PATH, params);
}

/** Inject or update the Sales line from `order/sales`. */
export function mergeOrderSalesIntoReport(report, sales) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const amount = Number(sales?.totalAmount);
  if (!Number.isFinite(amount)) return base;
  return {
    ...base,
    revenue: upsertReportLine(base.revenue, SALES_LABEL, amount),
  };
}

/** Sales returns reduce revenue (stored as negative amount). */
export function mergeSalesReturnIntoReport(report, salesReturn) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const raw = Number(salesReturn?.totalAmount);
  const amount = Number.isFinite(raw) ? -Math.abs(raw) : 0;
  return {
    ...base,
    revenue: upsertReportLine(base.revenue, SALES_RETURN_LABEL, amount),
  };
}

/** GET URL for COGS on the income statement. */
export function buildCostOfGoodsSoldUrl(params = {}) {
  const query = new URLSearchParams();
  appendReportDateParams(query, params);
  const qs = query.toString();
  return `${BASE_URL}${COGS_BY_ORDER_ITEM_PATH}${qs ? `?${qs}` : ''}`;
}

/**
 * GET `order_item/cost-of-goods-sold-by-order-item` — `{ success, cost_of_goods_sold, line_count, order_item_ids }`.
 * @param {{ startDate?: string; endDate?: string }} [params]
 */
export async function fetchCostOfGoodsSoldByOrderItemRequest(params = {}) {
  const url = buildCostOfGoodsSoldUrl(params);
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `HTTP ${response.status}`;
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
        : 'Cost of goods sold request was not successful';
    throw new Error(msg);
  }

  const raw =
    result.cost_of_goods_sold ?? result.costOfGoodsSold ?? result.total_cost_of_goods_sold;
  const costOfGoodsSold =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseFloat(String(raw ?? '').replace(/,/g, '').trim());

  const lineCountRaw = result.line_count ?? result.lineCount;
  const lineCount =
    typeof lineCountRaw === 'number' && Number.isFinite(lineCountRaw)
      ? lineCountRaw
      : parseInt(String(lineCountRaw ?? ''), 10);

  const orderItemIds = Array.isArray(result.order_item_ids)
    ? result.order_item_ids.map(String)
    : Array.isArray(result.orderItemIds)
      ? result.orderItemIds.map(String)
      : [];

  return {
    costOfGoodsSold: Number.isFinite(costOfGoodsSold) ? costOfGoodsSold : 0,
    lineCount: Number.isFinite(lineCount) ? lineCount : 0,
    orderItemIds,
  };
}

/** Inject COGS from `order_item/cost-of-goods-sold-by-order-item`. */
export function mergeCostOfGoodsIntoReport(report, cogs) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const amount = Number(cogs?.costOfGoodsSold);
  const resolved = Number.isFinite(amount) ? amount : 0;
  return {
    ...base,
    costOfGoodsSold: upsertReportLine(base.costOfGoodsSold, COGS_LABEL, resolved),
  };
}

/** Purchases (inventory received) shown under COGS section. */
export function mergePurchasesIntoReport(report, purchases) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const raw = Number(purchases?.totalAmount);
  const amount = Number.isFinite(raw) ? Math.abs(raw) : 0;
  return {
    ...base,
    costOfGoodsSold: upsertReportLine(base.costOfGoodsSold, PURCHASES_LABEL, amount),
  };
}

/** Purchase returns reduce COGS (stored as negative amount). */
export function mergePurchaseReturnsIntoReport(report, purchaseReturn) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const raw = Number(purchaseReturn?.totalAmount);
  const amount = Number.isFinite(raw) ? -Math.abs(raw) : 0;
  return {
    ...base,
    costOfGoodsSold: upsertReportLine(base.costOfGoodsSold, PURCHASE_RETURNS_LABEL, amount),
  };
}

/** GET `account/fetch-account-by-type?account_type=operating_expense`. */
export async function fetchOperatingExpensesRequest() {
  return fetchAccountsByTypeRequest('operating_expense');
}

function mapOperatingExpenseAccount(account) {
  const sum = account?.transactions_sum ?? account?.transactionsSum;
  const raw = sum?.net_debit_minus_credit ?? sum?.netDebitMinusCredit;
  const amount = Number(raw);
  return {
    label: account?.name || '—',
    amount: Number.isFinite(amount) ? amount : 0,
    account_id: account?._id ?? account?.id,
  };
}

/** Replace operating expenses with accounts from `operating_expense` type API. */
export function mergeOperatingExpensesIntoReport(report, accounts) {
  const base = report && typeof report === 'object' ? report : emptyReport();
  const list = Array.isArray(accounts) ? accounts : [];
  const operatingExpenses = list
    .map(mapOperatingExpenseAccount)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return { ...base, operatingExpenses };
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
