import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import { loadProfitReport } from '../../features/profitReport/profitReportSlice.js';
import { buildProfitByOrderItemUrl } from '../../features/profitReport/profitReportAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
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
  const { report, status, error, lastParams } = useSelector((s) => s.profitReport);

  const [startDate, setStartDate] = useState(() => defaultRange().startDate);
  const [endDate, setEndDate] = useState(() => defaultRange().endDate);
  const [orderId, setOrderId] = useState('');
  const [productId, setProductId] = useState('');

  const params = useMemo(
    () => ({
      startDate,
      endDate,
      ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
      ...(productId.trim() ? { productId: productId.trim() } : {}),
    }),
    [startDate, endDate, orderId, productId]
  );

  const runReport = useCallback(() => {
    dispatch(loadProfitReport(params));
  }, [dispatch, params]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  const fmt = formatCurrencyAccounting;
  const loading = status === 'loading';
  const marginText =
    report?.marginPct != null && Number.isFinite(report.marginPct)
      ? `${report.marginPct.toFixed(1)}%`
      : '—';

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
                Line-level profit from sales order items for the selected period.
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

              <div className="card border">
                <div className="card-header py-2">
                  <h6 className="mb-0 text-sm">Applied filters (API)</h6>
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

          {DEBUG ? (
            <DevApiSourcesFooter
              className="mt-4"
              sources={[
                {
                  label: 'order_item/profit-by-order-item',
                  url: buildProfitByOrderItemUrl(lastParams || params),
                },
              ]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
