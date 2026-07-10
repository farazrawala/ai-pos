import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  loadProfitReport,
  loadProfitReportLines,
  setLinesPage,
  setLinesLimit,
} from '../../features/profitReport/profitReportSlice.js';
import {
  buildProfitByOrderItemUrl,
  buildOrderProfitByOrderItemUrl,
  buildOrdersWithProfitLinesUrl,
  groupProfitLinesByOrder,
} from '../../features/profitReport/profitReportAPI.js';
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
import '../common/devApiSources.css';
import { FaArrowsRotate, FaChartLine, FaFilter } from 'react-icons/fa6';

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

export default function ProfitReportView() {
  useRequireModuleAccess('profit-report');
  const dispatch = useDispatch();
  const {
    report,
    lines,
    orderProfitRows,
    orderGroups,
    linesSummary,
    ordersPageSummary,
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
    dispatch(setLinesPage(1));
    dispatch(
      loadProfitReport({
        startDate,
        endDate,
        page: 1,
        limit: linesPagination.limit,
        ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
        ...(productId.trim() ? { productId: productId.trim() } : {}),
      })
    );
  }, [dispatch, startDate, endDate, orderId, productId, linesPagination.limit]);

  useEffect(() => {
    dispatch(setLinesPage(1));
    dispatch(
      loadProfitReport({
        startDate,
        endDate,
        page: 1,
        limit: linesPagination.limit,
        ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
        ...(productId.trim() ? { productId: productId.trim() } : {}),
      })
    );
    // Reload when filter fields change; pagination uses loadProfitReportLines only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, startDate, endDate, orderId, productId]);

  const handleLinesPageChange = (newPage) => {
    if (newPage < 1 || newPage > linesPagination.totalPages) return;
    dispatch(setLinesPage(newPage));
    dispatch(loadProfitReportLines({ ...params, page: newPage }));
  };

  const handleLinesLimitChange = (limit) => {
    dispatch(setLinesLimit(limit));
    dispatch(loadProfitReportLines({ ...params, page: 1, limit }));
  };

  const fmt = formatCurrencyAccounting;
  const loading = status === 'loading';
  const linesLoading = linesStatus === 'loading';
  const marginText =
    report?.marginPct != null && Number.isFinite(report.marginPct)
      ? `${report.marginPct.toFixed(1)}%`
      : '—';

  const pageLinesSummary = linesSummary;
  const pageOrdersSummary = useMemo(() => {
    if (ordersPageSummary) return ordersPageSummary;
    const groups = orderGroups?.length ? orderGroups : groupProfitLinesByOrder(lines);
    const profit = groups.reduce((sum, row) => sum + row.orderProfit, 0);
    const subtotal = groups.reduce((sum, row) => sum + row.orderSubtotal, 0);
    const lineCount = groups.reduce((sum, row) => sum + row.itemCount, 0);
    return {
      orderCount: groups.length,
      lineCount,
      profit,
      subtotal,
      marginPct: subtotal !== 0 ? (profit / subtotal) * 100 : null,
    };
  }, [ordersPageSummary, orderGroups, lines]);

  const groupedLines = useMemo(() => {
    if (orderGroups?.length) return orderGroups;
    return groupProfitLinesByOrder(lines);
  }, [orderGroups, lines]);

  const pageMarginText =
    pageLinesSummary?.marginPct != null && Number.isFinite(pageLinesSummary.marginPct)
      ? `${pageLinesSummary.marginPct.toFixed(1)}%`
      : '—';

  const apiParams = lastParams || params;

  return (
    <div className="container-fluid py-4 px-3 profit-report-page">
      <div className="card shadow-sm">
        <div className="card-header pb-0">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h5 className="mb-1 d-flex align-items-center gap-2">
                <NavIcon icon={FaChartLine} />
                Profit report
              </h5>
              <p className="text-sm text-muted mb-0">
                Period totals merged from profit-by-order-item APIs; lines grouped by order with
                per-order profit.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary mb-0"
              onClick={runReport}
              disabled={loading}
            >
              <FaArrowsRotate className={loading ? 'me-1 spin-icon' : 'me-1'} />
              Refresh
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="profit-report-filters card bg-light border-0 mb-4">
            <div className="card-body py-3">
              <div className="d-flex align-items-center gap-2 mb-3 text-sm fw-semibold text-muted">
                <FaFilter aria-hidden />
                Filters
              </div>
              <div className="row g-3 align-items-end">
                <div className="col-md-3 col-sm-6">
                  <label className="form-label text-xs mb-1" htmlFor="profit-from">
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
                <div className="col-md-3 col-sm-6">
                  <label className="form-label text-xs mb-1" htmlFor="profit-to">
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
                <div className="col-md-3 col-sm-6">
                  <label className="form-label text-xs mb-1" htmlFor="profit-order-id">
                    Order <span className="text-muted">(optional)</span>
                  </label>
                  <SearchableSelect
                    options={orderOptions}
                    value={orderId}
                    placeholder={ordersLoading ? 'Loading orders…' : 'All orders'}
                    disabled={ordersLoading}
                    onChange={setOrderId}
                  />
                </div>
                <div className="col-md-3 col-sm-6">
                  <label className="form-label text-xs mb-1" htmlFor="profit-product-id">
                    Product <span className="text-muted">(optional)</span>
                  </label>
                  <SearchableSelect
                    options={productOptions}
                    value={productId}
                    placeholder={productsLoading ? 'Loading products…' : 'All products'}
                    disabled={productsLoading}
                    onChange={setProductId}
                  />
                </div>
                <div className="col-12 col-md-auto">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-0"
                    onClick={runReport}
                    disabled={loading}
                  >
                    Run report
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger py-2 text-sm" role="alert">
              {error}
            </div>
          ) : null}

          {loading && !report ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-primary mb-2" role="status">
                <span className="visually-hidden">Loading…</span>
              </div>
              <div className="text-sm">Loading profit…</div>
            </div>
          ) : null}

          {report ? (
            <>
              <div className="mb-2">
                <h6 className="text-sm fw-semibold mb-1">Period summary (merged)</h6>
                <p className="text-xs text-muted mb-0">
                  Total order profit from <code>order_item/profit-by-order-item</code>
                  {report.orderPathProfit != null ? (
                    <>
                      {' '}
                      and <code>order/profit-by-order-item</code>
                      {report.profitsMatch ? ' (both match)' : ' (paths differ — see below)'}
                    </>
                  ) : null}
                  . Uses date range and inventory-movement rules.
                </p>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100 border-0 bg-gradient-primary text-white">
                    <div className="card-body">
                      <p className="text-xs text-white text-opacity-8 mb-1">Total order profit</p>
                      <p className="profit-report-stat__value mb-0">{fmt(report.profit)}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100">
                    <div className="card-body">
                      <p className="text-xs text-muted mb-1">Subtotal (sales)</p>
                      <p className="profit-report-stat__value mb-0">{fmt(report.subtotal)}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100">
                    <div className="card-body">
                      <p className="text-xs text-muted mb-1">Line count</p>
                      <p className="profit-report-stat__value mb-0">{report.lineCount}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100">
                    <div className="card-body">
                      <p className="text-xs text-muted mb-1">Margin</p>
                      <p className="profit-report-stat__value mb-0">{marginText}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100 border border-dashed">
                    <div className="card-body">
                      <p className="text-xs text-muted mb-1">Orders on this page</p>
                      <p className="profit-report-stat__value mb-0">{report.pageOrderCount ?? 0}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100 border border-dashed">
                    <div className="card-body">
                      <p className="text-xs text-muted mb-1">Page order profit</p>
                      <p className="profit-report-stat__value mb-0">
                        {fmt(report.pageOrderProfit ?? pageOrdersSummary.profit)}
                      </p>
                    </div>
                  </div>
                </div>
                {report.orderPathProfit != null && !report.profitsMatch ? (
                  <div className="col-12">
                    <div className="alert alert-warning py-2 text-sm mb-0">
                      Order path profit ({fmt(report.orderPathProfit)}) differs from order_item path
                      ({fmt(report.profit)}). Period card uses order_item total.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="card border mb-4">
                <div className="card-header py-2">
                  <h6 className="mb-0 text-sm">Applied filters (summary API)</h6>
                </div>
                <div className="card-body py-2">
                  <dl className="row mb-0 text-sm profit-report-meta">
                    <dt className="col-sm-3 col-md-2 text-muted">From</dt>
                    <dd className="col-sm-9 col-md-4">
                      {formatDisplayDate(report.filters.from || startDate)}
                    </dd>
                    <dt className="col-sm-3 col-md-2 text-muted">To</dt>
                    <dd className="col-sm-9 col-md-4">
                      {formatDisplayDate(report.filters.to || endDate)}
                    </dd>
                    <dt className="col-sm-3 col-md-2 text-muted">Order</dt>
                    <dd className="col-sm-9 col-md-4">
                      {orderOptions.find((o) => o.value && String(o.value) === String(report.filters.orderId || orderId))
                        ?.label ||
                        report.filters.orderId ||
                        '—'}
                    </dd>
                    <dt className="col-sm-3 col-md-2 text-muted">Product</dt>
                    <dd className="col-sm-9 col-md-4">
                      {productOptions.find(
                        (o) => o.value && String(o.value) === String(report.filters.productId || productId)
                      )?.label ||
                        report.filters.productId ||
                        '—'}
                    </dd>
                  </dl>
                </div>
              </div>
            </>
          ) : null}

          {orderProfitRows.length > 0 ? (
            <div className="card border mb-4">
              <div className="card-header py-2">
                <h6 className="mb-0 text-sm">Profit by order (current page)</h6>
                <p className="text-xs text-muted mb-0">
                  Order totals merged from <code>order/get-order-by-order-item</code> line profits.
                </p>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table align-items-center mb-0 profit-report-lines-table">
                    <thead>
                      <tr>
                        <th className="text-xxs text-uppercase">Order</th>
                        <th className="text-end text-xxs text-uppercase">Items</th>
                        <th className="text-end text-xxs text-uppercase">Items subtotal</th>
                        <th className="text-end text-xxs text-uppercase">Order profit</th>
                        <th className="text-end text-xxs text-uppercase">Margin</th>
                        <th className="text-xxs text-uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderProfitRows.map((order) => {
                        const profitClass =
                          order.orderProfit > 0
                            ? 'text-success'
                            : order.orderProfit < 0
                              ? 'text-danger'
                              : 'text-muted';
                        const orderMargin =
                          order.marginPct != null && Number.isFinite(order.marginPct)
                            ? `${order.marginPct.toFixed(1)}%`
                            : '—';
                        return (
                          <tr key={order.orderId || order.orderNo}>
                            <td className="text-sm">
                              <div className="fw-semibold">{order.orderNo}</div>
                              {order.orderId ? (
                                <code className="text-xxs text-muted">{order.orderId}</code>
                              ) : null}
                            </td>
                            <td className="text-sm text-end">{order.itemCount}</td>
                            <td className="text-sm text-end">{fmt(order.itemsSubtotal)}</td>
                            <td className={`text-sm text-end fw-semibold ${profitClass}`}>
                              {fmt(order.orderProfit)}
                            </td>
                            <td className="text-sm text-end">{orderMargin}</td>
                            <td className="text-sm text-nowrap">
                              {order.orderDate ? formatDisplayDate(order.orderDate) : '—'}
                            </td>
                          </tr>
                        );
                      })}
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
                        <td className="text-sm text-end fw-semibold text-primary">
                          {fmt(pageOrdersSummary.profit)}
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
                </div>
              </div>
            </div>
          ) : null}

          <div className="card border">
            <div className="card-header py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h6 className="mb-0 text-sm">Profit lines by order</h6>
                <p className="text-xs text-muted mb-0">
                  Each order header shows merged order profit; rows below are line items.
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
                showPagination={!linesLoading && linesPagination.total > 0}
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
                        const orderProfitClass =
                          group.orderProfit > 0
                            ? 'text-success'
                            : group.orderProfit < 0
                              ? 'text-danger'
                              : 'text-muted';
                        let lineOffset = 0;
                        for (let i = 0; i < groupIndex; i += 1) {
                          lineOffset += groupedLines[i].lines.length + 1;
                        }
                        return (
                          <Fragment key={`order-${group.orderId || group.orderNo}`}>
                            <tr className="profit-report-order-row">
                              <td className="text-center text-sm text-muted">{lineOffset + 1}</td>
                              <td className="text-sm" colSpan={2}>
                                <div className="fw-bold">{group.orderNo}</div>
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
                                {fmt(group.orderProfit)}
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
        </div>
      </div>
    </div>
  );
}
