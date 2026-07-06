import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '../../features/profitReport/profitReportAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import ListDataTable from '../list/ListDataTable.jsx';
import { DEBUG } from '../../config/env.js';
import '../common/devApiSources.css';
import { FaArrowsRotate, FaChartLine, FaFilter } from 'react-icons/fa6';

function toYmd(d) {
  return moment(d).format('YYYY-MM-DD');
}

function defaultRange() {
  const end = moment();
  const start = moment().startOf('month');
  return { startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD') };
}

export default function ProfitReportView() {
  useRequireModuleAccess('profit-report');
  const dispatch = useDispatch();
  const {
    report,
    lines,
    linesSummary,
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
                Period totals from profit-by-order-item; line items from orders with nested
                order_items (per-line profit).
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
                    Order ID <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    id="profit-order-id"
                    className="form-control form-control-sm"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Filter by order"
                  />
                </div>
                <div className="col-md-3 col-sm-6">
                  <label className="form-label text-xs mb-1" htmlFor="profit-product-id">
                    Product ID <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    id="profit-product-id"
                    className="form-control form-control-sm"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="Filter by product"
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
                <h6 className="text-sm fw-semibold mb-1">Period summary</h6>
                <p className="text-xs text-muted mb-0">
                  From <code>order_item/profit-by-order-item</code> — uses date range and
                  inventory-movement rules.
                </p>
              </div>
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                  <div className="profit-report-stat card h-100 border-0 bg-gradient-primary text-white">
                    <div className="card-body">
                      <p className="text-xs text-white text-opacity-8 mb-1">Total profit</p>
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
              </div>

              <div className="card border mb-4">
                <div className="card-header py-2">
                  <h6 className="mb-0 text-sm">Applied filters (summary API)</h6>
                </div>
                <div className="card-body py-2">
                  <dl className="row mb-0 text-sm profit-report-meta">
                    <dt className="col-sm-3 col-md-2 text-muted">From</dt>
                    <dd className="col-sm-9 col-md-4">
                      {report.filters.from ? toYmd(report.filters.from) : startDate}
                    </dd>
                    <dt className="col-sm-3 col-md-2 text-muted">To</dt>
                    <dd className="col-sm-9 col-md-4">
                      {report.filters.to ? toYmd(report.filters.to) : endDate}
                    </dd>
                    <dt className="col-sm-3 col-md-2 text-muted">Order</dt>
                    <dd className="col-sm-9 col-md-4">{report.filters.orderId || '—'}</dd>
                    <dt className="col-sm-3 col-md-2 text-muted">Product</dt>
                    <dd className="col-sm-9 col-md-4">{report.filters.productId || '—'}</dd>
                    <dt className="col-sm-3 col-md-2 text-muted">Company</dt>
                    <dd className="col-sm-9 col-md-4">
                      <code className="text-xs">{report.companyId || '—'}</code>
                    </dd>
                  </dl>
                </div>
              </div>
            </>
          ) : null}

          <div className="card border">
            <div className="card-header py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h6 className="mb-0 text-sm">Profit lines (current page)</h6>
                <p className="text-xs text-muted mb-0">
                  From <code>order/get-order-by-order-item</code> — profit = subtotal − (cost_price_at_sale
                  × qty) on each line.
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
                    {lines.length === 0 && !linesLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-5 text-muted text-sm">
                          No profit lines on this page. Adjust filters or date range.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, index) => {
                        const rowNo =
                          (linesPagination.page - 1) * linesPagination.limit + index + 1;
                        const profitClass =
                          line.profit > 0
                            ? 'text-success'
                            : line.profit < 0
                              ? 'text-danger'
                              : 'text-muted';
                        return (
                          <tr key={line.lineId || `${line.orderId}-${index}`}>
                            <td className="text-center text-sm text-muted">{rowNo}</td>
                            <td className="text-sm">
                              <div className="fw-semibold">{line.orderNo}</div>
                              {line.orderId ? (
                                <code className="text-xxs text-muted">{line.orderId}</code>
                              ) : null}
                            </td>
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
                            <td className="text-sm text-nowrap">
                              {line.orderDate
                                ? moment(line.orderDate).format('DD MMM YYYY')
                                : '—'}
                            </td>
                          </tr>
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
