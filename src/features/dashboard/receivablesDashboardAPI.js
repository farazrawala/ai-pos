import {
  buildReportPeriodQuery,
  fetchReportJson,
  firstArray,
  parseReportNumber,
  partyDisplayName,
  pickDataObject,
  pickPeriod,
} from '../../utils/reportFetch.js';

const ACCOUNTS_RECEIVABLE_SUMMARY_PATH = 'order/accounts-receivable-summary';
const RECEIVABLES_SUMMARY_PATH = 'ledger/receivables-summary';
const RECEIVABLES_AGING_PATH = 'ledger/receivables-aging';

function parseAccountsReceivableSummary(raw) {
  const block = pickDataObject({ data: raw, summary: raw });
  const openingBalance = parseReportNumber(block.opening_balance ?? block.openingBalance);
  const newCharges = parseReportNumber(block.new_charges ?? block.newCharges);
  const collections = parseReportNumber(block.collections);
  const netChange = parseReportNumber(block.net_change ?? block.netChange);
  const closingBalance = parseReportNumber(block.closing_balance ?? block.closingBalance);
  const computedClosingBalance = parseReportNumber(
    block.computed_closing_balance ?? block.computedClosingBalance,
    closingBalance
  );
  const transactionCount =
    parseInt(String(block.transaction_count ?? block.transactionCount ?? ''), 10) || 0;

  return {
    openingBalance,
    newCharges,
    collections,
    netChange,
    closingBalance,
    computedClosingBalance,
    transactionCount,
  };
}

/** GET `order/accounts-receivable-summary` */
export async function fetchAccountsReceivableSummaryRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'current_month');
  const result = await fetchReportJson(
    ACCOUNTS_RECEIVABLE_SUMMARY_PATH,
    query,
    'Could not load accounts receivable summary'
  );
  const raw = result.summary ?? result.data ?? result;
  return {
    summary: parseAccountsReceivableSummary(raw),
    period: pickPeriod(result),
  };
}

function parseReceivablePartyRow(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      name: 'Unknown',
      balance: 0,
      totalDebit: 0,
      totalCredit: 0,
      transactionCount: 0,
      lastActivityAt: null,
    };
  }
  const balance = parseReportNumber(raw.balance);
  const id = String(
    raw.customer_id?._id ?? raw.customer_id ?? raw.user_id?._id ?? raw.user_id ?? raw._id ?? raw.id ?? ''
  ).trim();
  const name =
    String(raw.customer_name ?? raw.customerName ?? partyDisplayName(raw) ?? 'Unknown').trim() ||
    'Unknown';
  const totalDebit = parseReportNumber(raw.total_debit ?? raw.totalDebit);
  const totalCredit = parseReportNumber(raw.total_credit ?? raw.totalCredit);
  const transactionCount =
    parseInt(String(raw.transaction_count ?? raw.transactionCount ?? ''), 10) || 0;
  const lastActivityAt = raw.last_activity_at ?? raw.lastActivityAt ?? null;

  return { id, name, balance, totalDebit, totalCredit, transactionCount, lastActivityAt };
}

/** GET `ledger/receivables-summary` */
export async function fetchReceivablesSummaryRequest(params = {}) {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit ?? 10));
  if (params.period) query.set('period', String(params.period));
  const result = await fetchReportJson(
    RECEIVABLES_SUMMARY_PATH,
    query,
    'Could not load receivables summary'
  );
  const rows = firstArray(result, 'data', 'receivables', 'parties', 'users').map(
    parseReceivablePartyRow
  );
  const summaryRaw = result.summary ?? {};
  const totalOutstanding = parseReportNumber(
    summaryRaw.total_outstanding ??
      summaryRaw.totalOutstanding ??
      summaryRaw.total_receivable ??
      summaryRaw.totalReceivable,
    rows.reduce((sum, r) => sum + r.balance, 0)
  );
  const customerCount =
    parseInt(
      String(summaryRaw.customer_count ?? summaryRaw.customerCount ?? rows.length),
      10
    ) || rows.length;

  return {
    parties: rows,
    summary: { totalOutstanding, customerCount, count: rows.length },
    period: pickPeriod(result),
  };
}

function parseAgingBucket(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return { bucketKey: '', label: `Bucket ${index + 1}`, amount: 0, count: 0 };
  }
  const bucketKey = String(raw.bucket ?? raw.aging_bucket ?? raw.agingBucket ?? '').trim();
  const label = String(
    raw.label ?? raw.range ?? raw.name ?? bucketKey ?? `Bucket ${index + 1}`
  ).trim();
  const amount = parseReportNumber(
    raw.amount ?? raw.total ?? raw.total_receivable ?? raw.totalReceivable ?? raw.balance
  );
  const count =
    parseInt(String(raw.count ?? raw.customer_count ?? raw.customerCount ?? raw.party_count ?? ''), 10) ||
    0;
  return { bucketKey, label, amount, count };
}

/** GET `ledger/receivables-aging` */
export async function fetchReceivablesAgingRequest(params = {}) {
  const query = new URLSearchParams();
  if (params.from && params.to) {
    query.set('from', String(params.from));
    query.set('to', String(params.to));
    if (params.timezone) query.set('timezone', String(params.timezone));
  } else if (params.period) {
    query.set('period', String(params.period));
  }

  const result = await fetchReportJson(
    RECEIVABLES_AGING_PATH,
    query,
    'Could not load receivables aging'
  );
  const buckets = firstArray(result, 'buckets', 'aging', 'data', 'rows').map(parseAgingBucket);
  const summaryRaw = result.summary ?? {};
  const totalOutstanding = parseReportNumber(
    summaryRaw.total_outstanding ??
      summaryRaw.totalOutstanding ??
      summaryRaw.total ??
      summaryRaw.total_receivable ??
      summaryRaw.totalReceivable,
    buckets.reduce((sum, b) => sum + b.amount, 0)
  );
  const customerCount =
    parseInt(String(summaryRaw.customer_count ?? summaryRaw.customerCount ?? ''), 10) || 0;
  const asOf = result.as_of ?? result.asOf ?? null;

  return {
    buckets,
    summary: { totalOutstanding, customerCount, bucketCount: buckets.length },
    asOf,
    period: pickPeriod(result),
  };
}
