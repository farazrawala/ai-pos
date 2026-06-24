import {
  accountDisplayName,
  buildReportPeriodQuery,
  fetchReportJson,
  firstArray,
  parseReportNumber,
  pickDataObject,
  pickPeriod,
} from '../../utils/reportFetch.js';

const EXPENSE_SUMMARY_PATH = 'expense/summary';
const EXPENSE_BY_ACCOUNT_PATH = 'expense/by-account';
const EXPENSE_VS_REVENUE_PATH = 'reports/expense-vs-revenue';

function parseExpenseSummary(raw) {
  const block = pickDataObject({ data: raw, summary: raw });
  const totalAmount = parseReportNumber(
    block.total_amount ?? block.totalAmount ?? block.total ?? block.amount
  );
  const expenseCount =
    parseInt(String(block.expense_count ?? block.expenseCount ?? block.count ?? ''), 10) || 0;
  let averageExpense = parseReportNumber(
    block.average_expense ?? block.averageExpense ?? block.avg_amount,
    NaN
  );
  if (!Number.isFinite(averageExpense) && expenseCount > 0) {
    averageExpense = totalAmount / expenseCount;
  }
  if (!Number.isFinite(averageExpense)) averageExpense = 0;
  return { totalAmount, expenseCount, averageExpense };
}

/** GET `expense/summary` */
export async function fetchExpenseSummaryRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'current_month');
  const result = await fetchReportJson(EXPENSE_SUMMARY_PATH, query, 'Could not load expense summary');
  const raw = result.data ?? result.summary ?? result;
  return {
    summary: parseExpenseSummary(raw),
    period: pickPeriod(result),
  };
}

function parseExpenseAccountRow(raw) {
  if (!raw || typeof raw !== 'object') {
    return { accountId: '', name: 'Unknown', totalAmount: 0, expenseCount: 0 };
  }
  const accountId = String(
    raw.account_id?._id ?? raw.account_id ?? raw._id ?? raw.id ?? ''
  ).trim();
  const name = accountDisplayName(raw) || 'Unknown';
  const totalAmount = parseReportNumber(
    raw.total_amount ?? raw.totalAmount ?? raw.amount ?? raw.total
  );
  const expenseCount =
    parseInt(String(raw.expense_count ?? raw.expenseCount ?? raw.count ?? ''), 10) || 0;
  return { accountId, name, totalAmount, expenseCount };
}

/** GET `expense/by-account` */
export async function fetchExpensesByAccountRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'last_30_days');
  query.set('limit', String(params.limit ?? 10));
  const result = await fetchReportJson(
    EXPENSE_BY_ACCOUNT_PATH,
    query,
    'Could not load expenses by account'
  );
  const accounts = firstArray(result, 'data', 'accounts', 'rows').map(parseExpenseAccountRow);
  const totalAmount = parseReportNumber(
    result.summary?.total_amount ?? result.summary?.totalAmount ?? result.total_amount,
    accounts.reduce((sum, r) => sum + r.totalAmount, 0)
  );
  return {
    accounts,
    summary: { totalAmount, count: accounts.length },
    period: pickPeriod(result),
  };
}

function parseExpenseVsRevenueDay(raw) {
  if (!raw || typeof raw !== 'object') {
    return { date: '', revenue: 0, expense: 0 };
  }
  return {
    date: String(raw.date ?? raw.day ?? ''),
    revenue: parseReportNumber(raw.revenue ?? raw.total_revenue ?? raw.totalRevenue ?? raw.sales),
    expense: parseReportNumber(raw.expense ?? raw.total_expense ?? raw.totalExpense ?? raw.expenses),
  };
}

/** GET `reports/expense-vs-revenue` */
export async function fetchExpenseVsRevenueRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'current_month');
  const result = await fetchReportJson(
    EXPENSE_VS_REVENUE_PATH,
    query,
    'Could not load expense vs revenue'
  );
  const days = firstArray(result, 'days', 'data', 'series').map(parseExpenseVsRevenueDay);
  const summaryRaw = pickDataObject(result);
  const totalRevenue = parseReportNumber(
    summaryRaw.total_revenue ??
      summaryRaw.totalRevenue ??
      summaryRaw.revenue,
    days.reduce((sum, d) => sum + d.revenue, 0)
  );
  const totalExpense = parseReportNumber(
    summaryRaw.total_expense ??
      summaryRaw.totalExpense ??
      summaryRaw.expense,
    days.reduce((sum, d) => sum + d.expense, 0)
  );
  return {
    days,
    summary: {
      totalRevenue,
      totalExpense,
      net: totalRevenue - totalExpense,
    },
    period: pickPeriod(result),
  };
}
