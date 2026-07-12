import {
  fetchReportJson,
  firstArray,
  parseReportNumber,
  pickDataObject,
  pickPeriod,
} from '../../utils/reportFetch.js';
import {
  fetchProfitByOrderItemRequest,
  normalizeProfitByOrderItemPayload,
} from '../profitReport/profitReportAPI.js';
import { fetchCostOfGoodsSoldByOrderItemRequest } from '../incomeStatement/incomeStatementAPI.js';
import {
  fetchBalanceSheetInventoryCogRequest,
  fetchBalanceSheetDefaultDiscountSumsRequest,
} from '../balanceSheet/balanceSheetAPI.js';

const LIST_WITH_SUMMARY_PATH = 'transaction/list-with-summary';

/** @param {Date} d */
export function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Current calendar month through today. */
export function currentMonthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: toYmd(start), endDate: toYmd(now) };
}

/**
 * Last N complete-ish week buckets ending today (Mon–Sun style rolling 7-day windows).
 * @param {number} [weeks]
 */
export function buildWeekBuckets(weeks = 6) {
  const buckets = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const to = new Date(end);
    to.setDate(end.getDate() - i * 7);
    const from = new Date(to);
    from.setDate(to.getDate() - 6);
    const fromStr = toYmd(from);
    const toStr = toYmd(to);
    const label = from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    buckets.push({ from: fromStr, to: toStr, startDate: fromStr, endDate: toStr, label });
  }
  return buckets;
}

function parseProfitPoint(report, bucket) {
  const profit = report?.profit ?? 0;
  const subtotal = report?.subtotal ?? 0;
  const marginPct =
    report?.marginPct != null && Number.isFinite(report.marginPct)
      ? report.marginPct
      : subtotal !== 0
        ? (profit / subtotal) * 100
        : 0;
  return {
    from: bucket.from,
    to: bucket.to,
    label: bucket.label,
    profit,
    subtotal,
    cogs: Math.max(0, subtotal - profit),
    marginPct,
    lineCount: report?.lineCount ?? 0,
  };
}

/**
 * Weekly gross profit / margin via `order_item/profit-by-order-item`.
 */
export async function fetchGrossMarginTrendRequest({ weeks = 6 } = {}) {
  const buckets = buildWeekBuckets(weeks);
  const results = await Promise.all(
    buckets.map(async (bucket) => {
      try {
        const { report } = await fetchProfitByOrderItemRequest({
          startDate: bucket.startDate,
          endDate: bucket.endDate,
        });
        return parseProfitPoint(report, bucket);
      } catch {
        return parseProfitPoint(
          { profit: 0, subtotal: 0, marginPct: 0, lineCount: 0 },
          bucket
        );
      }
    })
  );

  const totalProfit = results.reduce((s, r) => s + r.profit, 0);
  const totalSubtotal = results.reduce((s, r) => s + r.subtotal, 0);
  const avgMarginPct = totalSubtotal !== 0 ? (totalProfit / totalSubtotal) * 100 : 0;

  return {
    weeks: results,
    summary: {
      totalProfit,
      totalSubtotal,
      avgMarginPct,
      weekCount: results.length,
    },
    period: {
      from: buckets[0]?.from,
      to: buckets[buckets.length - 1]?.to,
      label: `Last ${weeks} weeks`,
    },
  };
}

/**
 * Period COGS vs sales (subtotal) + gross profit.
 */
export async function fetchCogsVsSalesRequest(params = {}) {
  const range =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : currentMonthDateRange();

  const [profitOutcome, cogsOutcome] = await Promise.allSettled([
    fetchProfitByOrderItemRequest(range),
    fetchCostOfGoodsSoldByOrderItemRequest(range),
  ]);

  if (profitOutcome.status === 'rejected' && cogsOutcome.status === 'rejected') {
    throw new Error(
      profitOutcome.reason?.message ||
        cogsOutcome.reason?.message ||
        'Could not load COGS vs sales'
    );
  }

  const profitReport =
    profitOutcome.status === 'fulfilled'
      ? profitOutcome.value.report
      : normalizeProfitByOrderItemPayload({});
  const cogs =
    cogsOutcome.status === 'fulfilled'
      ? cogsOutcome.value
      : { costOfGoodsSold: 0, lineCount: 0 };

  const sales = profitReport?.subtotal ?? 0;
  const profit = profitReport?.profit ?? 0;
  let costOfGoodsSold = cogs?.costOfGoodsSold ?? 0;
  if (costOfGoodsSold <= 0 && sales > 0 && profit !== 0) {
    costOfGoodsSold = Math.max(0, sales - profit);
  }
  const grossProfit = sales - costOfGoodsSold;
  const marginPct = sales !== 0 ? (grossProfit / sales) * 100 : 0;

  return {
    summary: {
      sales,
      costOfGoodsSold,
      grossProfit,
      marginPct,
      profitLineCount: profitReport?.lineCount ?? 0,
      cogsLineCount: cogs?.lineCount ?? 0,
    },
    period: {
      from: range.startDate,
      to: range.endDate,
      label: 'current_month',
    },
    errors: {
      profit: profitOutcome.status === 'rejected' ? profitOutcome.reason?.message : null,
      cogs: cogsOutcome.status === 'rejected' ? cogsOutcome.reason?.message : null,
    },
  };
}

/**
 * Inventory value (COGA) — top products by cost of goods available.
 */
export async function fetchInventoryValueRequest({ limit = 8 } = {}) {
  const { lines, grandTotal } = await fetchBalanceSheetInventoryCogRequest();
  const sorted = [...lines].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.label,
    amount: row.amount,
  }));
  const topTotal = top.reduce((s, r) => s + r.amount, 0);
  return {
    products: top,
    summary: {
      grandTotal,
      productCount: lines.length,
      topTotal,
      otherTotal: Math.max(0, grandTotal - topTotal),
    },
    period: { label: 'As of now' },
  };
}

/**
 * Sales vs purchase discount totals.
 */
export async function fetchDiscountTotalsRequest() {
  const { lines, total } = await fetchBalanceSheetDefaultDiscountSumsRequest();
  const discounts = lines.map((row) => ({
    id: row.id,
    name: row.label,
    amount: Math.abs(Number(row.amount) || 0),
    signedAmount: Number(row.amount) || 0,
  }));
  const salesDiscount =
    discounts.find((d) => /sales/i.test(d.name))?.amount ??
    discounts[0]?.amount ??
    0;
  const purchaseDiscount =
    discounts.find((d) => /purchase/i.test(d.name))?.amount ??
    discounts[1]?.amount ??
    0;

  return {
    discounts,
    summary: {
      total: Math.abs(Number(total) || 0) || salesDiscount + purchaseDiscount,
      salesDiscount,
      purchaseDiscount,
      netImpact: purchaseDiscount - salesDiscount,
    },
    period: { label: 'All time' },
  };
}

function parseLedgerDay(raw) {
  if (!raw || typeof raw !== 'object') {
    return { date: '', debit: 0, credit: 0 };
  }
  return {
    date: String(raw.date ?? raw.day ?? raw.label ?? ''),
    debit: parseReportNumber(raw.debit ?? raw.total_debit ?? raw.totalDebit),
    credit: parseReportNumber(raw.credit ?? raw.total_credit ?? raw.totalCredit),
  };
}

function parseLedgerSummary(raw) {
  const block = pickDataObject({ data: raw, summary: raw });
  const totalDebit = parseReportNumber(
    block.total_debit ?? block.totalDebit ?? block.debit ?? block.sum_debit
  );
  const totalCredit = parseReportNumber(
    block.total_credit ?? block.totalCredit ?? block.credit ?? block.sum_credit
  );
  const transactionCount =
    parseInt(
      String(block.transaction_count ?? block.transactionCount ?? block.count ?? ''),
      10
    ) || 0;
  return {
    totalDebit,
    totalCredit,
    net: totalCredit - totalDebit,
    transactionCount,
  };
}

function aggregateTransactionsByDay(rows) {
  /** @type {Map<string, { debit: number; credit: number }>} */
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const dateRaw = row.createdAt ?? row.created_at ?? row.date ?? row.transaction_date;
    if (!dateRaw) continue;
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) continue;
    const key = toYmd(d);
    if (!map.has(key)) map.set(key, { debit: 0, credit: 0 });
    const bucket = map.get(key);
    const amt = parseReportNumber(row.amount);
    const type = String(row.type || '').toLowerCase();
    if (type === 'debit') bucket.debit += amt;
    else if (type === 'credit') bucket.credit += amt;
    else {
      bucket.debit += parseReportNumber(row.debit);
      bucket.credit += parseReportNumber(row.credit);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, debit: v.debit, credit: v.credit }));
}

/**
 * GET `transaction/list-with-summary` — debit/credit series + totals.
 */
export async function fetchLedgerDebitCreditRequest(params = {}) {
  const range =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : currentMonthDateRange();

  const query = new URLSearchParams();
  query.set('from', range.startDate);
  query.set('to', range.endDate);
  query.set('startDate', range.startDate);
  query.set('endDate', range.endDate);
  if (params.limit) query.set('limit', String(params.limit));

  const result = await fetchReportJson(
    LIST_WITH_SUMMARY_PATH,
    query,
    'Could not load ledger summary'
  );

  let days = firstArray(result, 'days', 'series', 'daily').map(parseLedgerDay);
  const summaryBlock =
    result.summary && typeof result.summary === 'object'
      ? result.summary
      : pickDataObject(result);
  let summary = parseLedgerSummary(summaryBlock);

  if (!days.length) {
    const rows = firstArray(result, 'data', 'transactions', 'rows');
    if (rows.length) {
      days = aggregateTransactionsByDay(rows);
      if (!summary.totalDebit && !summary.totalCredit) {
        summary = {
          totalDebit: days.reduce((s, d) => s + d.debit, 0),
          totalCredit: days.reduce((s, d) => s + d.credit, 0),
          net: 0,
          transactionCount: rows.length,
        };
        summary.net = summary.totalCredit - summary.totalDebit;
      }
    }
  }

  if (days.length && !summary.totalDebit && !summary.totalCredit) {
    summary.totalDebit = days.reduce((s, d) => s + d.debit, 0);
    summary.totalCredit = days.reduce((s, d) => s + d.credit, 0);
    summary.net = summary.totalCredit - summary.totalDebit;
  }

  return {
    days,
    summary,
    period: pickPeriod(result) ?? {
      from: range.startDate,
      to: range.endDate,
      label: 'current_month',
    },
  };
}
