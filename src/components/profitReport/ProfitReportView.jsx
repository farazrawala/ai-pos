import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { loadProfitReport, setLinesPage, setLinesLimit } from '../../features/profitReport/profitReportSlice.js';
import {
  buildProfitByOrderItemUrl,
  buildOrderProfitByOrderItemUrl,
  buildOrdersWithProfitLinesUrl,
  buildLastNMonthRanges,
  groupProfitLinesByOrder,
  summarizeOrderProfitGroups,
  buildProfitByOrderExportRows,
  getProfitByOrderExportColumns,
  PROFIT_ORDERS_PAGE_SIZE,
} from '../../features/profitReport/profitReportAPI.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import { toast } from '../../utils/toast.js';
import {
  fetchOrdersRequest,
  pickOrderDocumentId,
  pickOrderInvoiceNo,
} from '../../features/orders/ordersAPI.js';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import ListDataTable from '../list/ListDataTable.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';
import { posInvoiceRoutePath } from '../../config/appBase.js';
import ProfitLast3MonthsChart from './ProfitLast3MonthsChart.jsx';
import '../common/devApiSources.css';
import {
  FaArrowsRotate,
  FaCalendar,
  FaCalendarDay,
  FaCalendarDays,
} from 'react-icons/fa6';

/** Display dates as day-month-year, e.g. 10-7-2026 */
function formatDisplayDate(d) {
  const m = moment(d);
  return m.isValid() ? m.format('D-M-YYYY') : '—';
}

function defaultRange() {
  const end = moment();
  const start = moment().startOf('month');
  return { startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD') };
}

const productRowId = (p) => p?._id || p?.id || p?.product_id || '';
const productRowName = (p) => p?.name || p?.product_name || 'Product';

function formatMarginBadge(marginPct) {
  if (marginPct == null || !Number.isFinite(marginPct)) return null;
  return `${marginPct.toFixed(1)}%`;
}

function formatDiscountPercent(discount, subtotal) {
  const d = Number(discount);
  const s = Number(subtotal);
  if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(s) || s === 0) return '—';
  return `${((d / s) * 100).toFixed(1)}%`;
}

function orderNetProfit(order) {
  if (order?.netProfit != null && Number.isFinite(Number(order.netProfit))) {
    return Number(order.netProfit);
  }
  return (Number(order?.orderProfit) || 0) - (Number(order?.discount) || 0);
}

function profitValueClass(n) {
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return 'text-muted';
}

function GlanceKpi({
  title,
  value,
  hint,
  badge,
  icon: Icon,
  iconClass,
  loading,
  accent = false,
  valueClass = '',
}) {
  return (
    <div className={`card profit-report-kpi h-100 mb-0${accent ? ' profit-report-kpi--accent' : ''}`}>
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div className="min-w-0">
            <p className="profit-report-kpi__label">{title}</p>
            <p
              className={[
                'profit-report-kpi__value',
                !valueClass && accent ? 'profit-report-kpi__value--primary' : '',
                valueClass,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {loading ? '…' : value}
            </p>
            <p className="profit-report-kpi__hint">
              {hint}
              {badge ? <span className="profit-report-kpi__badge ms-1">{badge}</span> : null}
            </p>
          </div>
          {Icon ? (
            <div className={`profit-report-kpi__icon ${iconClass}`}>
              <NavIcon icon={Icon} className="text-white" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Link to POS invoice / order detail (opens in a new tab). */
function OrderDetailLink({ orderId, orderNo, className = 'fw-semibold text-primary' }) {
  const routeId = String(orderId || orderNo || '').trim();
  const label = String(orderNo || orderId || '—').trim() || '—';
  if (!routeId) return <span className={className}>{label}</span>;
  return (
    <Link
      to={posInvoiceRoutePath(routeId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} text-decoration-underline`}
      title="Open order detail in new tab"
    >
      {label}
    </Link>
  );
}

export default function ProfitReportView() {
  useRequireModuleAccess('profit-report');
  const dispatch = useDispatch();
  const {
    report,
    quickStats,
    lines,
    orderProfitRows,
    orderGroups,
    linesPagination,
    status,
    linesStatus,
    error,
    linesError,
    lastParams,
  } = useSelector((s) => s.profitReport);

  const [startDate, setStartDate] = useState(() => defaultRange().startDate);
  const [endDate, setEndDate] = useState(() => defaultRange().endDate);
  const [orderId, setOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [orderOptions, setOrderOptions] = useState([{ value: '', label: 'All orders' }]);
  const [productOptions, setProductOptions] = useState([{ value: '', label: 'All products' }]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [exporting, setExporting] = useState(false);
  const loadRef = useRef(null);

  const loadOrderOptions = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetchOrdersRequest({
        page: 1,
        limit: 500,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const rows = Array.isArray(res?.data) ? res.data : [];
      const options = [{ value: '', label: 'All orders' }];
      const seen = new Set();
      for (const order of rows) {
        const id = pickOrderDocumentId(order);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const invoiceNo = pickOrderInvoiceNo(order);
        const when = order.createdAt || order.created_at || order.date;
        options.push({
          value: id,
          label: invoiceNo || id,
          subLabel: [
            when ? formatDisplayDate(when) : '',
            order.name || order.customer_name || '',
          ]
            .filter(Boolean)
            .join(' · '),
        });
      }
      setOrderOptions(options);
    } catch {
      setOrderOptions([{ value: '', label: 'All orders' }]);
    } finally {
      setOrdersLoading(false);
    }
  }, [startDate, endDate]);

  const loadProductOptions = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await fetchProductsRequest({ page: 1, limit: 2000 });
      const rows = Array.isArray(res?.data) ? res.data : [];
      rows.sort((a, b) =>
        String(productRowName(a)).localeCompare(String(productRowName(b)), undefined, {
          sensitivity: 'base',
        })
      );
      const options = [{ value: '', label: 'All products' }];
      for (const p of rows) {
        const id = String(productRowId(p) || '').trim();
        if (!id) continue;
        const sku = String(p.sku || p.product_code || p.barcode || '').trim();
        options.push({
          value: id,
          label: productRowName(p),
          subLabel: sku || undefined,
        });
      }
      setProductOptions(options);
    } catch {
      setProductOptions([{ value: '', label: 'All products' }]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrderOptions();
  }, [loadOrderOptions]);

  useEffect(() => {
    loadProductOptions();
  }, [loadProductOptions]);

  // Drop stale order selection if it is no longer in the date-filtered list.
  useEffect(() => {
    if (!orderId) return;
    if (!orderOptions.some((o) => o.value && String(o.value) === String(orderId))) {
      setOrderId('');
    }
  }, [orderOptions, orderId]);

  const params = useMemo(
    () => ({
      startDate,
      endDate,
      page: linesPagination.page,
      limit: linesPagination.limit,
      ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
      ...(productId.trim() ? { productId: productId.trim() } : {}),
    }),
    [startDate, endDate, orderId, productId, linesPagination.page, linesPagination.limit]
  );

  const runReport = useCallback(() => {
    const fromRaw = String(startDate || '').trim();
    const toRaw = String(endDate || '').trim();
    if (!fromRaw || !toRaw) {
      setFilterError('Select both From and To dates, then click Run report.');
      return;
    }

    let from = fromRaw;
    let to = toRaw;
    if (moment(from).isAfter(moment(to))) {
      from = toRaw;
      to = fromRaw;
      setStartDate(from);
      setEndDate(to);
    }

    setFilterError('');
    if (loadRef.current) loadRef.current.abort();
    dispatch(setLinesPage(1));
    loadRef.current = dispatch(
      loadProfitReport({
        startDate: from,
        endDate: to,
        page: 1,
        limit: linesPagination.limit,
        ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
        ...(productId.trim() ? { productId: productId.trim() } : {}),
      })
    );
  }, [dispatch, startDate, endDate, orderId, productId, linesPagination.limit]);

  useEffect(() => {
    runReport();
    return () => {
      if (loadRef.current) loadRef.current.abort();
    };
    // Load once on mount; later runs come from Run report / Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinesPageChange = (newPage) => {
    if (newPage < 1 || newPage > linesPagination.totalPages) return;
    dispatch(setLinesPage(newPage));
  };

  const handleLinesLimitChange = (limit) => {
    dispatch(setLinesLimit(limit));
  };

  const handleExportOrders = async (kind) => {
    if (!orderProfitRows.length) {
      toast.error('No orders to export.');
      return;
    }
    const from = lastParams?.startDate || startDate;
    const to = lastParams?.endDate || endDate;
    const filename = `profit-by-order-${from}-to-${to}`;
    const columns = getProfitByOrderExportColumns(formatDisplayDate);
    const rows = buildProfitByOrderExportRows(orderProfitRows);
    setExporting(true);
    try {
      if (kind === 'csv') exportRowsToCsv({ columns, rows, filename });
      else if (kind === 'excel') {
        exportRowsToExcel({ columns, rows, filename, sheetTitle: 'Profit by order' });
      } else {
        await exportRowsToPdf({
          columns,
          rows,
          filename,
          title: `Profit by order (${formatDisplayDate(from)} – ${formatDisplayDate(to)})`,
        });
      }
      toast.success(`Exported ${orderProfitRows.length} orders.`);
    } catch (err) {
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const fmt = formatCurrencyAccounting;
  const loading = status === 'loading';
  const linesLoading = linesStatus === 'loading';
  const marginText =
    report?.marginPct != null && Number.isFinite(report.marginPct)
      ? `${report.marginPct.toFixed(1)}%`
      : '—';
  const netMarginText =
    report?.netMarginPct != null && Number.isFinite(report.netMarginPct)
      ? `${report.netMarginPct.toFixed(1)}%`
      : '—';
  const periodDiscount = Number(report?.discount) || 0;
  const profitAfterDiscount =
    report?.profitAfterDiscount != null && Number.isFinite(Number(report.profitAfterDiscount))
      ? Number(report.profitAfterDiscount)
      : (Number(report?.profit) || 0) - periodDiscount;

  const ordersPageLimit = Math.max(Number(linesPagination.limit) || PROFIT_ORDERS_PAGE_SIZE, 1);
  const ordersPageIndex = Math.max(Number(linesPagination.page) || 1, 1);
  const ordersPageStart = (ordersPageIndex - 1) * ordersPageLimit;
  const ordersListTotal = Number(linesPagination.total) || orderProfitRows.length;
  const ordersRangeStart = ordersListTotal === 0 ? 0 : ordersPageStart + 1;
  const ordersRangeEnd = Math.min(ordersPageStart + ordersPageLimit, ordersListTotal);

  const groupedLinesAll = useMemo(() => {
    if (orderGroups?.length) return orderGroups;
    return groupProfitLinesByOrder(lines);
  }, [orderGroups, lines]);

  const pagedOrderRows = useMemo(
    () => orderProfitRows.slice(ordersPageStart, ordersPageStart + ordersPageLimit),
    [orderProfitRows, ordersPageStart, ordersPageLimit]
  );

  const groupedLines = useMemo(
    () => groupedLinesAll.slice(ordersPageStart, ordersPageStart + ordersPageLimit),
    [groupedLinesAll, ordersPageStart, ordersPageLimit]
  );

  const pageOrdersSummary = useMemo(
    () => summarizeOrderProfitGroups(groupedLines),
    [groupedLines]
  );

  const pageLinesSummary = useMemo(() => {
    const pageLines = groupedLines.flatMap((group) => group.lines || []);
    const profit = pageLines.reduce((sum, line) => sum + (Number(line.profit) || 0), 0);
    const subtotal = pageLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
    return {
      lineCount: pageLines.length,
      profit,
      subtotal,
      marginPct: subtotal !== 0 ? (profit / subtotal) * 100 : null,
    };
  }, [groupedLines]);

  const pageMarginText =
    pageLinesSummary?.marginPct != null && Number.isFinite(pageLinesSummary.marginPct)
      ? `${pageLinesSummary.marginPct.toFixed(1)}%`
      : '—';

  const glanceLoading = loading && quickStats == null;
  const todayProfit = quickStats?.today?.profit;
  const monthProfit = quickStats?.month?.profit;
  const lastMonthProfit = quickStats?.lastMonth?.profit;
  const todayMargin = formatMarginBadge(quickStats?.today?.marginPct);
  const monthMargin = formatMarginBadge(quickStats?.month?.marginPct);
  const lastMonthMargin = formatMarginBadge(quickStats?.lastMonth?.marginPct);
  const monthLabel = moment().format('MMMM YYYY');
  const lastMonthLabel = moment().subtract(1, 'month').format('MMMM YYYY');
  const todayLabel = formatDisplayDate(quickStats?.todayDate || moment().format('YYYY-MM-DD'));
  const fmtProfit = (value) => {
    const n = Number(value);
    return value != null && value !== '' && Number.isFinite(n) ? fmt(n) : '—';
  };

  const apiParams = lastParams || params;

  return (
    <div className="container-fluid py-4 px-3 profit-report-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-xs font-weight-bolder text-primary mb-1">Accounts</p>
          <h4 className="mb-1">Profit report</h4>
          <p className="text-sm text-muted mb-0">
            Track order profitability by period, with monthly trends and line-level detail.
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary mb-0" onClick={runReport}>
          <FaArrowsRotate className={loading ? 'me-1 spin-icon' : 'me-1'} />
          Refresh
        </button>
      </div>

      <div className="card profit-report-filters border-0 mb-4">
        <div className="card-body py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runReport();
            }}
          >
            <div className="row g-3 align-items-end">
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1" htmlFor="profit-from">
                  From
                </label>
                <input
                  id="profit-from"
                  type="date"
                  className="form-control form-control-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1" htmlFor="profit-to">
                  To
                </label>
                <input
                  id="profit-to"
                  type="date"
                  className="form-control form-control-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="col-sm-6 col-xl-3">
                <label className="form-label mb-1" htmlFor="profit-order-id">
                  Order <span className="fw-normal text-lowercase">(optional)</span>
                </label>
                <SearchableSelect
                  options={orderOptions}
                  value={orderId}
                  placeholder={ordersLoading ? 'Loading orders…' : 'All orders'}
                  disabled={ordersLoading}
                  onChange={setOrderId}
                />
              </div>
              <div className="col-sm-6 col-xl-3">
                <label className="form-label mb-1" htmlFor="profit-product-id">
                  Product <span className="fw-normal text-lowercase">(optional)</span>
                </label>
                <SearchableSelect
                  options={productOptions}
                  value={productId}
                  placeholder={productsLoading ? 'Loading products…' : 'All products'}
                  disabled={productsLoading}
                  onChange={setProductId}
                />
              </div>
              <div className="col-12 col-xl-2">
                <button type="submit" className="btn btn-primary btn-sm w-100 mb-0 profit-report-run-btn">
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                      Running…
                    </>
                  ) : (
                    'Run report'
                  )}
                </button>
              </div>
            </div>
          </form>
          {filterError ? (
            <div className="text-xs text-danger mt-3">{filterError}</div>
          ) : (
            <div className="profit-report-status">
              {loading ? (
                <span className="profit-report-chip profit-report-chip--info">
                  Loading {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
                </span>
              ) : lastParams?.startDate && lastParams?.endDate ? (
                <span className="profit-report-chip profit-report-chip--info">
                  {formatDisplayDate(lastParams.startDate)} – {formatDisplayDate(lastParams.endDate)}
                </span>
              ) : null}
              <span className="profit-report-chip">
                {orderOptions.find((o) => o.value && String(o.value) === String(orderId))?.label ||
                  'All orders'}
              </span>
              <span className="profit-report-chip">
                {productOptions.find((o) => o.value && String(o.value) === String(productId))
                  ?.label || 'All products'}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-primary mb-2" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <div className="text-sm">Loading profit…</div>
        </div>
      ) : (
        <>
      {error ? (
        <div className="alert alert-danger py-2 text-sm" role="alert">
          {error}
        </div>
      ) : null}

      <div className="profit-report-glance mb-4">
        <div className="mb-3">
          <h6 className="profit-report-section-title">At a glance</h6>
          <p className="text-xs text-muted mb-0">
            Live calendar totals — independent of the date filters above.
          </p>
        </div>
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <GlanceKpi
              title="Today's profit"
              value={fmtProfit(todayProfit)}
              hint={todayLabel}
              badge={todayMargin}
              icon={FaCalendarDay}
              iconClass="bg-gradient-success shadow-success"
              loading={glanceLoading}
            />
          </div>
          <div className="col-md-4">
            <GlanceKpi
              title="This month profit"
              value={fmtProfit(monthProfit)}
              hint={monthLabel}
              badge={monthMargin}
              icon={FaCalendarDays}
              iconClass="bg-gradient-info shadow-info"
              loading={glanceLoading}
              accent
            />
          </div>
          <div className="col-md-4">
            <GlanceKpi
              title="Last month profit"
              value={fmtProfit(lastMonthProfit)}
              hint={lastMonthLabel}
              badge={lastMonthMargin}
              icon={FaCalendar}
              iconClass="bg-gradient-warning shadow-warning"
              loading={glanceLoading}
            />
          </div>
        </div>
        <ProfitLast3MonthsChart
          months={quickStats?.last3Months}
          loading={glanceLoading}
        />
      </div>

          {report ? (
            <>
              <div className="mb-3">
                <h6 className="profit-report-section-title">Period summary</h6>
                <p className="text-xs text-muted mb-0">
                  Totals for {formatDisplayDate(report.filters.from || lastParams?.startDate || startDate)}{' '}
                  to {formatDisplayDate(report.filters.to || lastParams?.endDate || endDate)}
                  {report.orderPathProfit != null && !report.profitsMatch
                    ? ' (sources differ — see note below)'
                    : ''}
                  .
                </p>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                  <GlanceKpi
                    title="Selected period profit"
                    value={fmt(report.profit)}
                    hint="Gross profit before order discounts"
                    accent
                  />
                </div>
                <div className="col-md-6 col-xl-3">
                  <GlanceKpi
                    title="Period discount"
                    value={periodDiscount > 0 ? `−${fmt(periodDiscount)}` : fmt(0)}
                    hint="Invoice discounts in the selected dates"
                    valueClass={periodDiscount > 0 ? 'text-danger' : ''}
                  />
                </div>
                <div className="col-md-6 col-xl-3">
                  <GlanceKpi
                    title="Net profit after discount"
                    value={fmt(profitAfterDiscount)}
                    hint="Period profit minus discounts"
                    badge={netMarginText}
                    accent
                    valueClass={profitAfterDiscount < 0 ? 'text-danger' : ''}
                  />
                </div>
                <div className="col-md-6 col-xl-3">
                  <GlanceKpi title="Subtotal (sales)" value={fmt(report.subtotal)} />
                </div>
                <div className="col-md-6 col-xl-2">
                  <GlanceKpi title="Line count" value={report.lineCount} />
                </div>
                <div className="col-md-6 col-xl-2">
                  <GlanceKpi title="Margin" value={marginText} />
                </div>
                <div className="col-md-6 col-xl-2">
                  <GlanceKpi
                    title="Orders in dates"
                    value={linesPagination.total ?? 0}
                    hint={`${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`}
                  />
                </div>
                {report.orderPathProfit != null && !report.profitsMatch ? (
                  <div className="col-12">
                    <div className="alert alert-warning py-2 text-sm mb-0">
                      Alternate profit total ({fmt(report.orderPathProfit)}) differs from the primary
                      total ({fmt(report.profit)}). Showing the primary total above.
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {orderProfitRows.length > 0 || linesPagination.total > 0 ? (
            <div className="card profit-report-panel mb-4">
              <div className="card-header bg-transparent d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div>
                  <h6 className="profit-report-section-title mb-0">Profit by order</h6>
                  <p className="text-xs text-muted mb-0">
                    {ordersListTotal > 0
                      ? `Showing ${ordersRangeStart}–${ordersRangeEnd} of ${ordersListTotal} — click an order to open details.`
                      : 'Click an order to open details.'}
                  </p>
                </div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="text-xs text-uppercase fw-bold text-muted me-1">
                    <i className="fas fa-download me-1" aria-hidden="true" />
                    Export all
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm mb-0"
                    disabled={exporting || loading || orderProfitRows.length === 0}
                    onClick={() => handleExportOrders('csv')}
                    title="Download all orders as CSV"
                  >
                    <i className="fas fa-file-csv me-1" aria-hidden="true" />
                    {exporting ? 'Exporting…' : 'CSV'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm mb-0"
                    disabled={exporting || loading || orderProfitRows.length === 0}
                    onClick={() => handleExportOrders('excel')}
                    title="Download all orders as Excel"
                  >
                    <i className="fas fa-file-excel me-1" aria-hidden="true" />
                    Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm mb-0"
                    disabled={exporting || loading || orderProfitRows.length === 0}
                    onClick={() => handleExportOrders('pdf')}
                    title="Download all orders as PDF"
                  >
                    <i className="fas fa-file-pdf me-1" aria-hidden="true" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <ListDataTable
                  className="list-data-table--profit-report mb-0"
                  loading={linesLoading && pagedOrderRows.length === 0}
                  loadingLabel="Loading orders…"
                  pagination={linesPagination}
                  onPageChange={handleLinesPageChange}
                  onLimitChange={handleLinesLimitChange}
                  selectId="profit-report-orders-page-size"
                  showPagination={linesPagination.total > 0}
                >
                  <table className="table align-items-center mb-0 profit-report-lines-table">
                    <thead>
                      <tr>
                        <th className="text-xxs text-uppercase">Order</th>
                        <th className="text-end text-xxs text-uppercase">Items</th>
                        <th className="text-end text-xxs text-uppercase">Items subtotal</th>
                        <th className="text-end text-xxs text-uppercase">Discount %</th>
                        <th className="text-end text-xxs text-uppercase">Discount</th>
                        <th className="text-end text-xxs text-uppercase">Order profit</th>
                        <th className="text-end text-xxs text-uppercase">Net profit</th>
                        <th className="text-end text-xxs text-uppercase">Margin</th>
                        <th className="text-xxs text-uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedOrderRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 text-muted text-sm">
                            No orders on this page. Adjust filters or date range.
                          </td>
                        </tr>
                      ) : (
                        pagedOrderRows.map((order) => {
                        const netProfit = orderNetProfit(order);
                        const profitClass = profitValueClass(order.orderProfit);
                        const netProfitClass = profitValueClass(netProfit);
                        const orderMargin =
                          order.marginPct != null && Number.isFinite(order.marginPct)
                            ? `${order.marginPct.toFixed(1)}%`
                            : '—';
                        return (
                          <tr key={order.orderId || order.orderNo}>
                            <td className="text-sm">
                              <div>
                                <OrderDetailLink orderId={order.orderId} orderNo={order.orderNo} />
                              </div>
                              {order.orderId ? (
                                <code className="text-xxs text-muted">{order.orderId}</code>
                              ) : null}
                            </td>
                            <td className="text-sm text-end">{order.itemCount}</td>
                            <td className="text-sm text-end">{fmt(order.itemsSubtotal)}</td>
                            <td className="text-sm text-end">
                              {order.discount > 0 ? (
                                <span className="text-danger">
                                  {formatDiscountPercent(order.discount, order.itemsSubtotal)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-sm text-end">
                              {order.discount > 0 ? (
                                <span className="text-danger">−{fmt(order.discount)}</span>
                              ) : (
                                fmt(order.discount || 0)
                              )}
                            </td>
                            <td className={`text-sm text-end fw-semibold ${profitClass}`}>
                              {fmt(order.orderProfit)}
                            </td>
                            <td className={`text-sm text-end fw-semibold ${netProfitClass}`}>
                              {fmt(netProfit)}
                            </td>
                            <td className="text-sm text-end">{orderMargin}</td>
                            <td className="text-sm text-nowrap">
                              {order.orderDate ? formatDisplayDate(order.orderDate) : '—'}
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="profit-report-order-total-row">
                        <td className="text-sm fw-semibold">Page total</td>
                        <td className="text-sm text-end fw-semibold">
                          {pageOrdersSummary.lineCount}
                        </td>
                        <td className="text-sm text-end fw-semibold">
                          {fmt(pageOrdersSummary.subtotal)}
                        </td>
                        <td className="text-sm text-end fw-semibold">
                          {pageOrdersSummary.discount > 0 ? (
                            <span className="text-danger">
                              {formatDiscountPercent(
                                pageOrdersSummary.discount,
                                pageOrdersSummary.subtotal
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-sm text-end fw-semibold">
                          {pageOrdersSummary.discount > 0 ? (
                            <span className="text-danger">
                              −{fmt(pageOrdersSummary.discount)}
                            </span>
                          ) : (
                            fmt(pageOrdersSummary.discount || 0)
                          )}
                        </td>
                        <td className="text-sm text-end fw-semibold text-primary">
                          {fmt(pageOrdersSummary.profit)}
                        </td>
                        <td className="text-sm text-end fw-semibold text-primary">
                          {fmt(pageOrdersSummary.netProfit)}
                        </td>
                        <td className="text-sm text-end fw-semibold">
                          {pageOrdersSummary.marginPct != null &&
                          Number.isFinite(pageOrdersSummary.marginPct)
                            ? `${pageOrdersSummary.marginPct.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </ListDataTable>
              </div>
            </div>
          ) : null}

          <div className="card profit-report-panel">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2 bg-transparent">
              <div>
                <h6 className="profit-report-section-title mb-0">Profit lines by order</h6>
                <p className="text-xs text-muted mb-0">
                  Order headers show merged profit; rows below are line items.
                </p>
              </div>
              {pageLinesSummary ? (
                <div className="text-xs text-muted text-end">
                  Page: {fmt(pageLinesSummary.profit)} profit · {pageLinesSummary.lineCount} lines ·{' '}
                  {pageMarginText} margin
                </div>
              ) : null}
            </div>
            <div className="card-body p-0">
              {linesError ? (
                <div className="alert alert-warning mx-3 mt-3 mb-0 py-2 text-sm" role="alert">
                  {linesError}
                </div>
              ) : null}

              <ListDataTable
                className="list-data-table--profit-report mb-0"
                loading={linesLoading && lines.length === 0}
                loadingLabel="Loading profit lines…"
                error={lines.length === 0 ? linesError : null}
                errorPrefix="Error loading profit lines"
                pagination={linesPagination}
                onPageChange={handleLinesPageChange}
                onLimitChange={handleLinesLimitChange}
                selectId="profit-report-lines-page-size"
                showPagination={linesPagination.total > 0}
              >
                <table className="table align-items-center mb-0 profit-report-lines-table">
                  <thead>
                    <tr>
                      <th className="text-center text-xxs text-uppercase">#</th>
                      <th className="text-xxs text-uppercase">Order</th>
                      <th className="text-xxs text-uppercase">Product</th>
                      <th className="text-end text-xxs text-uppercase">Qty</th>
                      <th className="text-end text-xxs text-uppercase">Price</th>
                      <th className="text-end text-xxs text-uppercase">Subtotal</th>
                      <th className="text-end text-xxs text-uppercase">Cost/sale</th>
                      <th className="text-end text-xxs text-uppercase">Profit</th>
                      <th className="text-xxs text-uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLines.length === 0 && !linesLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-5 text-muted text-sm">
                          No profit lines on this page. Adjust filters or date range.
                        </td>
                      </tr>
                    ) : (
                      groupedLines.map((group, groupIndex) => {
                        const netProfit = orderNetProfit(group);
                        const orderProfitClass = profitValueClass(netProfit);
                        let lineOffset = 0;
                        for (let i = 0; i < groupIndex; i += 1) {
                          lineOffset += groupedLines[i].lines.length + 1;
                        }
                        return (
                          <Fragment key={`order-${group.orderId || group.orderNo}`}>
                            <tr className="profit-report-order-row">
                              <td className="text-center text-sm text-muted">{lineOffset + 1}</td>
                              <td className="text-sm" colSpan={2}>
                                <div className="fw-bold">
                                  <OrderDetailLink
                                    orderId={group.orderId}
                                    orderNo={group.orderNo}
                                    className="fw-bold text-primary"
                                  />
                                </div>
                                {group.orderId ? (
                                  <code className="text-xxs text-muted">{group.orderId}</code>
                                ) : null}
                                <span className="badge bg-light text-dark text-xxs ms-2">
                                  {group.itemCount} item{group.itemCount === 1 ? '' : 's'}
                                </span>
                              </td>
                              <td className="text-sm text-end text-muted">—</td>
                              <td className="text-sm text-end text-muted">—</td>
                              <td className="text-sm text-end fw-semibold">
                                {fmt(group.orderSubtotal)}
                              </td>
                              <td className="text-sm text-end text-muted">—</td>
                              <td
                                className={`text-sm text-end fw-bold ${orderProfitClass}`}
                              >
                                {fmt(netProfit)}
                                {group.discount > 0 ? (
                                  <div className="text-xxs text-danger fw-normal">
                                    after −{fmt(group.discount)} discount
                                  </div>
                                ) : null}
                              </td>
                              <td className="text-sm text-nowrap">
                                {group.orderDate ? formatDisplayDate(group.orderDate) : '—'}
                              </td>
                            </tr>
                            {group.lines.map((line, index) => {
                              const rowNo = lineOffset + index + 2;
                              const profitClass =
                                line.profit > 0
                                  ? 'text-success'
                                  : line.profit < 0
                                    ? 'text-danger'
                                    : 'text-muted';
                              return (
                                <tr
                                  key={line.lineId || `${line.orderId}-${index}`}
                                  className="profit-report-line-row"
                                >
                                  <td className="text-center text-sm text-muted">{rowNo}</td>
                                  <td className="text-sm ps-4 text-muted">{group.orderNo}</td>
                                  <td className="text-sm">
                                    <div>{line.productName}</div>
                                    {line.productId ? (
                                      <code className="text-xxs text-muted">{line.productId}</code>
                                    ) : null}
                                  </td>
                                  <td className="text-sm text-end">{line.qty}</td>
                                  <td className="text-sm text-end">{fmt(line.price)}</td>
                                  <td className="text-sm text-end">{fmt(line.subtotal)}</td>
                                  <td className="text-sm text-end">{fmt(line.costPriceAtSale)}</td>
                                  <td className={`text-sm text-end fw-semibold ${profitClass}`}>
                                    {fmt(line.profit)}
                                  </td>
                                  <td className="text-sm text-nowrap text-muted">—</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </ListDataTable>
            </div>
          </div>

          {DEBUG ? (
            <DevApiSourcesFooter
              className="mt-4"
              sources={[
                {
                  label: 'order_item/profit-by-order-item (today)',
                  url: buildProfitByOrderItemUrl({
                    startDate: moment().format('YYYY-MM-DD'),
                    endDate: moment().format('YYYY-MM-DD'),
                  }),
                },
                {
                  label: 'order_item/profit-by-order-item (this month)',
                  url: buildProfitByOrderItemUrl({
                    startDate: moment().startOf('month').format('YYYY-MM-DD'),
                    endDate: moment().format('YYYY-MM-DD'),
                  }),
                },
                ...buildLastNMonthRanges(3).map((range) => ({
                  label: `order_item/profit-by-order-item (${range.label})`,
                  url: buildProfitByOrderItemUrl({
                    startDate: range.startDate,
                    endDate: range.endDate,
                  }),
                })),
                {
                  label: 'order_item/profit-by-order-item (summary)',
                  url: buildProfitByOrderItemUrl(apiParams),
                },
                {
                  label: 'order/profit-by-order-item (same handler)',
                  url: buildOrderProfitByOrderItemUrl(apiParams),
                },
                {
                  label: 'order/get-order-by-order-item (lines)',
                  url: buildOrdersWithProfitLinesUrl(apiParams),
                },
              ]}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
