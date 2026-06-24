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
  const block =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw
      : pickDataObject({ data: raw, summary: raw });
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
  const raw = result.data ?? result.summary ?? {};
  return {
    summary: parseExpenseSummary(raw),
    period: pickPeriod(result),
  };
}

function parseExpenseAccountRow(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      accountId: '',
      name: 'Unknown',
      accountType: '',
      accountNumber: '',
      totalAmount: 0,
      expenseCount: 0,
    };
  }
  const accountId = String(
    raw.account_id?._id ?? raw.account_id ?? raw._id ?? raw.id ?? ''
  ).trim();
  const name = String(raw.account_name ?? raw.accountName ?? accountDisplayName(raw) ?? 'Unknown').trim() || 'Unknown';
  const accountType = String(raw.account_type ?? raw.accountType ?? '').trim();
  const accountNumber = String(raw.account_number ?? raw.accountNumber ?? '').trim();
  const totalAmount = parseReportNumber(
    raw.total_amount ?? raw.totalAmount ?? raw.amount ?? raw.total
  );
  const expenseCount =
    parseInt(String(raw.expense_count ?? raw.expenseCount ?? raw.count ?? ''), 10) || 0;
  return { accountId, name, accountType, accountNumber, totalAmount, expenseCount };
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
  const summaryRaw = result.summary ?? {};
  const totalAmount = parseReportNumber(
    summaryRaw.total_amount ?? summaryRaw.totalAmount ?? result.total_amount,
    accounts.reduce((sum, r) => sum + r.totalAmount, 0)
  );
  const expenseCount =
    parseInt(String(summaryRaw.expense_count ?? summaryRaw.expenseCount ?? ''), 10) || 0;
  const accountCount =
    parseInt(String(summaryRaw.account_count ?? summaryRaw.accountCount ?? accounts.length), 10) ||
    accounts.length;

  return {
    accounts,
    summary: { totalAmount, expenseCount, accountCount, count: accounts.length },
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

function parseExpenseVsRevenueSummary(raw) {
  const block =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw
      : pickDataObject({ data: raw, summary: raw });
  const totalRevenue = parseReportNumber(
    block.total_revenue ?? block.totalRevenue ?? block.revenue
  );
  const totalExpense = parseReportNumber(
    block.total_expense ?? block.totalExpense ?? block.expense
  );
  const orderCount =
    parseInt(String(block.order_count ?? block.orderCount ?? ''), 10) || 0;
  const expenseCount =
    parseInt(String(block.expense_count ?? block.expenseCount ?? ''), 10) || 0;
  let netProfit = parseReportNumber(block.net_profit ?? block.netProfit ?? block.net, NaN);
  if (!Number.isFinite(netProfit)) netProfit = totalRevenue - totalExpense;
  let expenseRatioPercent = parseReportNumber(
    block.expense_ratio_percent ?? block.expenseRatioPercent,
    NaN
  );
  if (!Number.isFinite(expenseRatioPercent) && totalRevenue > 0) {
    expenseRatioPercent = (totalExpense / totalRevenue) * 100;
  }
  if (!Number.isFinite(expenseRatioPercent)) expenseRatioPercent = 0;

  return {
    totalRevenue,
    totalExpense,
    orderCount,
    expenseCount,
    netProfit,
    expenseRatioPercent,
    net: netProfit,
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
  const days = firstArray(result, 'days', 'series').map(parseExpenseVsRevenueDay);
  const dataBlock = result.data;
  const summary =
    dataBlock && typeof dataBlock === 'object' && !Array.isArray(dataBlock)
      ? parseExpenseVsRevenueSummary(dataBlock)
      : parseExpenseVsRevenueSummary(pickDataObject(result));

  if (days.length && !(dataBlock && typeof dataBlock === 'object' && !Array.isArray(dataBlock))) {
    summary.totalRevenue =
      summary.totalRevenue || days.reduce((sum, d) => sum + d.revenue, 0);
    summary.totalExpense =
      summary.totalExpense || days.reduce((sum, d) => sum + d.expense, 0);
    summary.netProfit = summary.totalRevenue - summary.totalExpense;
    summary.net = summary.netProfit;
  }

  return {
    days,
    summary,
    period: pickPeriod(result),
  };
}
