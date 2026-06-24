import {
  buildReportPeriodQuery,
  fetchReportJson,
  firstArray,
  parseReportNumber,
  pickPeriod,
} from '../../utils/reportFetch.js';

const PURCHASES_SUMMARY_PATH = 'purchase_order/purchases-summary';

function parsePurchaseDay(raw) {
  if (!raw || typeof raw !== 'object') {
    return { date: '', totalAmount: 0, documentCount: 0, averageAmount: 0 };
  }
  return {
    date: String(raw.date ?? raw.day ?? ''),
    totalAmount: parseReportNumber(raw.total_amount ?? raw.totalAmount ?? raw.amount),
    documentCount:
      parseInt(String(raw.document_count ?? raw.documentCount ?? raw.count ?? ''), 10) || 0,
    averageAmount: parseReportNumber(raw.average_amount ?? raw.averageAmount),
  };
}

function parsePurchaseWeek(raw) {
  if (!raw || typeof raw !== 'object') {
    return { weekStart: '', totalAmount: 0, documentCount: 0, averageAmount: 0 };
  }
  return {
    weekStart: String(raw.week_start ?? raw.weekStart ?? raw.date ?? ''),
    totalAmount: parseReportNumber(raw.total_amount ?? raw.totalAmount ?? raw.amount),
    documentCount:
      parseInt(String(raw.document_count ?? raw.documentCount ?? raw.count ?? ''), 10) || 0,
    averageAmount: parseReportNumber(raw.average_amount ?? raw.averageAmount),
  };
}

function parsePurchasesVsSales(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const purchases = parseReportNumber(raw.purchases ?? raw.total_purchases);
  const purchaseReturns = parseReportNumber(
    raw.purchase_returns ?? raw.purchaseReturns ?? raw.total_purchase_returns
  );
  const netPurchases = parseReportNumber(
    raw.net_purchases ?? raw.netPurchases,
    purchases - purchaseReturns
  );
  const sales = parseReportNumber(raw.sales ?? raw.total_sales);
  const difference = parseReportNumber(raw.difference, sales - netPurchases);
  let purchasesPercentOfSales = parseReportNumber(
    raw.purchases_percent_of_sales ?? raw.purchasesPercentOfSales,
    NaN
  );
  if (!Number.isFinite(purchasesPercentOfSales) && sales > 0) {
    purchasesPercentOfSales = (netPurchases / sales) * 100;
  }
  if (!Number.isFinite(purchasesPercentOfSales)) purchasesPercentOfSales = 0;
  return {
    purchases,
    purchaseReturns,
    netPurchases,
    sales,
    difference,
    purchasesPercentOfSales,
  };
}

function parsePurchaseSummary(raw) {
  const block = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const totalPurchases = parseReportNumber(
    block.total_purchases ?? block.totalPurchases ?? block.purchases
  );
  const purchaseOrderCount =
    parseInt(String(block.purchase_order_count ?? block.purchaseOrderCount ?? ''), 10) || 0;
  const totalPurchaseReturns = parseReportNumber(
    block.total_purchase_returns ?? block.totalPurchaseReturns ?? block.purchase_returns
  );
  const purchaseReturnCount =
    parseInt(String(block.purchase_return_count ?? block.purchaseReturnCount ?? ''), 10) || 0;
  const netPurchases = parseReportNumber(
    block.net_purchases ?? block.netPurchases,
    totalPurchases - totalPurchaseReturns
  );
  let averagePurchaseOrderValue = parseReportNumber(
    block.average_purchase_order_value ?? block.averagePurchaseOrderValue,
    NaN
  );
  if (!Number.isFinite(averagePurchaseOrderValue) && purchaseOrderCount > 0) {
    averagePurchaseOrderValue = totalPurchases / purchaseOrderCount;
  }
  if (!Number.isFinite(averagePurchaseOrderValue)) averagePurchaseOrderValue = 0;
  const totalSales = parseReportNumber(block.total_sales ?? block.totalSales ?? block.sales);
  const orderCount = parseInt(String(block.order_count ?? block.orderCount ?? ''), 10) || 0;
  const purchasesVsSales = parsePurchasesVsSales(
    block.purchases_vs_sales ?? block.purchasesVsSales ?? block
  );

  return {
    totalPurchases,
    purchaseOrderCount,
    totalPurchaseReturns,
    purchaseReturnCount,
    netPurchases,
    averagePurchaseOrderValue,
    totalSales,
    orderCount,
    purchasesVsSales,
  };
}

function parseTopVendorRow(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      vendorId: '',
      name: 'Unknown',
      email: '',
      phone: '',
      totalAmount: 0,
      purchaseOrderCount: 0,
    };
  }
  const vendorId = String(raw.vendor_id?._id ?? raw.vendor_id ?? raw._id ?? raw.id ?? '').trim();
  const name =
    String(raw.vendor_name ?? raw.vendorName ?? raw.name ?? 'Unknown').trim() || 'Unknown';
  return {
    vendorId,
    name,
    email: String(raw.vendor_email ?? raw.vendorEmail ?? '').trim(),
    phone: String(raw.vendor_phone ?? raw.vendorPhone ?? '').trim(),
    totalAmount: parseReportNumber(raw.total_amount ?? raw.totalAmount ?? raw.amount),
    purchaseOrderCount:
      parseInt(String(raw.purchase_order_count ?? raw.purchaseOrderCount ?? raw.count ?? ''), 10) ||
      0,
  };
}

/** GET `purchase_order/purchases-summary` */
export async function fetchPurchasesSummaryRequest(params = {}) {
  const query = buildReportPeriodQuery(params, 'current_month');
  if (params.limit != null) query.set('limit', String(params.limit));

  const result = await fetchReportJson(
    PURCHASES_SUMMARY_PATH,
    query,
    'Could not load purchases summary'
  );

  const summaryRaw = result.summary ?? {};
  const days = firstArray(result, 'days', 'daily').map(parsePurchaseDay);
  const weeks = firstArray(result, 'weeks', 'weekly').map(parsePurchaseWeek);
  const topVendors = firstArray(result, 'top_vendors', 'vendors').map(parseTopVendorRow);

  const dailySummaryRaw = result.daily_summary ?? result.dailySummary ?? {};
  const dailySummary = {
    totalAmount: parseReportNumber(
      dailySummaryRaw.total_amount ?? dailySummaryRaw.totalAmount,
      days.reduce((sum, d) => sum + d.totalAmount, 0)
    ),
    documentCount:
      parseInt(String(dailySummaryRaw.document_count ?? dailySummaryRaw.documentCount ?? ''), 10) ||
      days.reduce((sum, d) => sum + d.documentCount, 0),
    averageAmount: parseReportNumber(
      dailySummaryRaw.average_amount ?? dailySummaryRaw.averageAmount
    ),
  };

  return {
    summary: parsePurchaseSummary(summaryRaw),
    days,
    weeks,
    topVendors,
    dailySummary,
    period: pickPeriod(result),
  };
}
