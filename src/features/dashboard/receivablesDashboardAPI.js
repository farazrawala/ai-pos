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
  const totalReceivable = parseReportNumber(
    block.total_receivable ??
      block.totalReceivable ??
      block.total_outstanding ??
      block.totalOutstanding ??
      block.outstanding ??
      block.balance
  );
  const totalCollected = parseReportNumber(
    block.total_collected ?? block.totalCollected ?? block.collected ?? block.amount_received
  );
  const orderCount =
    parseInt(String(block.order_count ?? block.orderCount ?? block.count ?? ''), 10) || 0;
  const customerCount =
    parseInt(String(block.customer_count ?? block.customerCount ?? ''), 10) || 0;

  return {
    totalReceivable,
    totalCollected,
    totalOutstanding: parseReportNumber(
      block.total_outstanding ?? block.totalOutstanding,
      totalReceivable
    ),
    orderCount,
    customerCount,
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
  const raw = result.data ?? result.summary ?? result;
  return {
    summary: parseAccountsReceivableSummary(raw),
    period: pickPeriod(result),
  };
}

function parseReceivablePartyRow(raw) {
  if (!raw || typeof raw !== 'object') {
    return { id: '', name: 'Unknown', balance: 0, receivable: 0 };
  }
  const balance = parseReportNumber(
    raw.balance ??
      raw.receivable ??
      raw.amount ??
      raw.total_receivable ??
      raw.totalReceivable ??
      raw.outstanding
  );
  const id = String(
    raw.user_id?._id ??
      raw.user_id ??
      raw.customer_id?._id ??
      raw.customer_id ??
      raw._id ??
      raw.id ??
      ''
  ).trim();
  const name = partyDisplayName(raw) || 'Unknown';
  return {
    id,
    name,
    balance,
    receivable: parseReportNumber(raw.receivable ?? raw.total_receivable, balance),
  };
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
  const totalReceivable = parseReportNumber(
    result.summary?.total_receivable ??
      result.summary?.totalReceivable ??
      result.total_receivable,
    rows.reduce((sum, r) => sum + r.balance, 0)
  );
  return {
    parties: rows,
    summary: { totalReceivable, count: rows.length },
    period: pickPeriod(result),
  };
}

function parseAgingBucket(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return { label: `Bucket ${index + 1}`, amount: 0, count: 0 };
  }
  const label = String(
    raw.label ??
      raw.bucket ??
      raw.range ??
      raw.aging_bucket ??
      raw.agingBucket ??
      raw.name ??
      `Bucket ${index + 1}`
  ).trim();
  const amount = parseReportNumber(
    raw.amount ?? raw.total ?? raw.total_receivable ?? raw.totalReceivable ?? raw.balance
  );
  const count =
    parseInt(String(raw.count ?? raw.order_count ?? raw.orderCount ?? raw.party_count ?? ''), 10) ||
    0;
  return { label, amount, count };
}

/** GET `ledger/receivables-aging` */
export async function fetchReceivablesAgingRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'current_month');
  const result = await fetchReportJson(
    RECEIVABLES_AGING_PATH,
    query,
    'Could not load receivables aging'
  );
  const buckets = firstArray(result, 'buckets', 'aging', 'data', 'rows').map(parseAgingBucket);
  const totalAmount = parseReportNumber(
    result.summary?.total ??
      result.summary?.total_receivable ??
      result.summary?.totalReceivable ??
      result.total_receivable,
    buckets.reduce((sum, b) => sum + b.amount, 0)
  );
  return {
    buckets,
    summary: { totalAmount, bucketCount: buckets.length },
    period: pickPeriod(result),
  };
}
