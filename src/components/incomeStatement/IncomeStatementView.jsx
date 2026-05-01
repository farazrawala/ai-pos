import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchIncomeStatement } from '../../features/incomeStatement/incomeStatementSlice.js';
import {
  computeIncomeStatementTotals,
} from '../../features/incomeStatement/incomeStatementAPI.js';
import { formatCurrency as formatCurrencyFn } from '../balanceSheet/formatCurrency.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startOfCalendarMonth(year, month1to12) {
  return new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
}

function endOfCalendarMonth(year, month1to12) {
  return new Date(year, month1to12, 0, 23, 59, 59, 999);
}

function compareMonthYear(y1, m1, y2, m2) {
  if (y1 !== y2) return y1 - y2;
  return m1 - m2;
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function LineRow({ label, amount, formatCurrency, muted }) {
  return (
    <div className="d-flex justify-content-between align-items-center py-2 border-bottom border-light">
      <span className={`text-sm mb-0 ${muted ? 'text-muted' : ''}`}>{label}</span>
      <span className="text-sm font-weight-bold mb-0 text-end ps-3 tabular-nums">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function SectionBlock({ title, subtitle, iconClass, iconBg, borderClass, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`card mb-3 shadow-sm border-0 border-start border-4 ${borderClass}`}
    >
      <div className="card-header bg-white border-bottom-0 pb-0 pt-3">
        <div className="d-flex align-items-start gap-3">
          <div
            className={`icon icon-shape ${iconBg} shadow text-center rounded-3`}
            style={{ width: '2.75rem', height: '2.75rem', lineHeight: '2.75rem' }}
          >
            <i className={`${iconClass} text-white text-sm`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h6 className="mb-0 font-weight-bold">{title}</h6>
            {subtitle ? <p className="text-xs text-muted mb-0 mt-1">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="card-body pt-2 pb-3">{children}</div>
    </motion.div>
  );
}

function MetricTile({ label, value, formatCurrency, iconClass, iconBg, borderClass }) {
  return (
    <div className={`card h-100 mb-0 shadow-sm border-0 border-start border-4 ${borderClass}`}>
      <div className="card-body p-3 d-flex align-items-center justify-content-between gap-2">
        <div>
          <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">{label}</p>
          <h4 className="font-weight-bolder mb-0 tabular-nums">{formatCurrency(value)}</h4>
        </div>
        <div
          className={`icon icon-shape ${iconBg} shadow text-center rounded-circle flex-shrink-0`}
          style={{ width: '2.75rem', height: '2.75rem', lineHeight: '2.75rem' }}
        >
          <i className={`${iconClass} text-lg text-white opacity-10`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default function IncomeStatementView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canView } = usePermissions('accounts');
  const { status, error, report, demo } = useSelector((state) => state.incomeStatement);

  const fmt = useCallback((n) => formatCurrencyFn(n, 'USD'), []);

  const [fromYear, setFromYear] = useState(() => new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(() => new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(() => new Date().getFullYear());
  const [toMonth, setToMonth] = useState(() => new Date().getMonth() + 1);

  const periodStart = useMemo(() => startOfCalendarMonth(fromYear, fromMonth), [fromYear, fromMonth]);
  const periodEnd = useMemo(() => endOfCalendarMonth(toYear, toMonth), [toYear, toMonth]);

  const rangeLabel = useMemo(() => {
    const my = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
    const a = my.format(periodStart);
    const b = my.format(periodEnd);
    if (a === b) return a;
    return `${a} – ${b}`;
  }, [periodStart, periodEnd]);

  const rangeDetail = useMemo(() => {
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    return `${df.format(periodStart)} – ${df.format(periodEnd)}`;
  }, [periodStart, periodEnd]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y - 10; i <= y + 2; i += 1) out.push(i);
    return out;
  }, []);

  const setFrom = (y, m) => {
    setFromYear(y);
    setFromMonth(m);
    if (compareMonthYear(y, m, toYear, toMonth) > 0) {
      setToYear(y);
      setToMonth(m);
    }
  };

  const setTo = (y, m) => {
    setToYear(y);
    setToMonth(m);
    if (compareMonthYear(fromYear, fromMonth, y, m) > 0) {
      setFromYear(y);
      setFromMonth(m);
    }
  };

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

  useEffect(() => {
    const startDate = toYmd(periodStart);
    const endDate = toYmd(periodEnd);
    dispatch(fetchIncomeStatement({ startDate, endDate }));
  }, [dispatch, periodStart, periodEnd]);

  useEffect(() => {
    if (status === 'failed' && error) {
      console.error('[Income statement module] Failed to load report', error);
    }
  }, [status, error]);

  const totals = useMemo(() => computeIncomeStatementTotals(report), [report]);

  const loading = status === 'loading';

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="card shadow-sm border-0 overflow-hidden"
            style={{ maxWidth: '100%' }}
          >
            <div
              className="text-white px-4 pt-4 pb-5 position-relative"
              style={{
                background: 'linear-gradient(135deg, #5e72e4 0%, #825ee4 45%, #11cdef 100%)',
              }}
            >
              <div
                className="position-absolute top-0 end-0 opacity-10"
                style={{ fontSize: '8rem', lineHeight: 1, transform: 'translate(10%, -10%)' }}
                aria-hidden
              >
                <i className="ni ni-chart-pie-35" />
              </div>
              <div className="position-relative" style={{ zIndex: 1 }}>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="badge bg-white text-primary text-uppercase text-xs font-weight-bold">
                    P&amp;L
                  </span>
                  {demo ? (
                    <span className="badge bg-warning text-dark text-xs font-weight-bold">
                      Demo data
                    </span>
                  ) : null}
                </div>
                <h4 className="text-white font-weight-bolder mb-1">Income statement</h4>
                <p className="text-white text-sm mb-0" style={{ maxWidth: '36rem', opacity: 0.9 }}>
                  Revenue, costs, and profitability for the selected period — aligned with your Argon
                  dashboard theme.
                </p>
              </div>
            </div>

            <div className="card-header bg-white border-bottom pb-0 mx-3 mx-sm-4 mt-n4 shadow border-radius-lg position-relative">
              <div className="row align-items-start gy-3 pt-3 pb-3">
                <div className="col-xl-4 col-lg-5">
                  <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">Filter period</p>
                  <p className="text-sm font-weight-bold text-dark mb-0">{rangeLabel}</p>
                  <p className="text-xs text-muted mb-0 mt-1">{rangeDetail}</p>
                </div>
                <div className="col-xl-7 col-lg-7">
                  <div className="row g-3 align-items-end">
                    <div className="col-md-6">
                      <p className="text-xs text-uppercase font-weight-bold text-muted mb-2">From</p>
                      <div className="row g-2">
                        <div className="col-7">
                          <label className="form-label text-xs text-muted mb-1">Month</label>
                          <select
                            className="form-select form-select-sm"
                            value={String(fromMonth)}
                            onChange={(e) => setFrom(fromYear, parseInt(e.target.value, 10))}
                            aria-label="From month"
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <option key={name} value={String(idx + 1)}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-5">
                          <label className="form-label text-xs text-muted mb-1">Year</label>
                          <select
                            className="form-select form-select-sm"
                            value={String(fromYear)}
                            onChange={(e) => setFrom(parseInt(e.target.value, 10), fromMonth)}
                            aria-label="From year"
                          >
                            {yearOptions.map((y) => (
                              <option key={y} value={String(y)}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <p className="text-xs text-uppercase font-weight-bold text-muted mb-2">To</p>
                      <div className="row g-2">
                        <div className="col-7">
                          <label className="form-label text-xs text-muted mb-1">Month</label>
                          <select
                            className="form-select form-select-sm"
                            value={String(toMonth)}
                            onChange={(e) => setTo(toYear, parseInt(e.target.value, 10))}
                            aria-label="To month"
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <option key={name} value={String(idx + 1)}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-5">
                          <label className="form-label text-xs text-muted mb-1">Year</label>
                          <select
                            className="form-select form-select-sm"
                            value={String(toYear)}
                            onChange={(e) => setTo(parseInt(e.target.value, 10), toMonth)}
                            aria-label="To year"
                          >
                            {yearOptions.map((y) => (
                              <option key={y} value={String(y)}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body pt-3 px-3 px-sm-4">
              {loading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading…</span>
                  </div>
                  <p className="text-sm text-muted mt-3 mb-0">Building your statement…</p>
                </div>
              )}

              {!loading && error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {!loading && !error && report && (
                <>
                  <div className="row g-3 mb-2">
                    <div className="col-md-4">
                      <MetricTile
                        label="Total revenue"
                        value={totals.totalRevenue}
                        formatCurrency={fmt}
                        iconClass="ni ni-money-coins"
                        iconBg="bg-gradient-success"
                        borderClass="border-success"
                      />
                    </div>
                    <div className="col-md-4">
                      <MetricTile
                        label="Gross profit"
                        value={totals.grossProfit}
                        formatCurrency={fmt}
                        iconClass="ni ni-chart-bar-32"
                        iconBg="bg-gradient-info"
                        borderClass="border-info"
                      />
                    </div>
                    <div className="col-md-4">
                      <MetricTile
                        label="Net income"
                        value={totals.netIncome}
                        formatCurrency={fmt}
                        iconClass="ni ni-trophy"
                        iconBg="bg-gradient-primary"
                        borderClass="border-primary"
                      />
                    </div>
                  </div>

                  <div className="row g-4">
                    <div className="col-lg-6">
                      <SectionBlock
                        title="Revenue"
                        subtitle="Top-line inflows for the period"
                        iconClass="ni ni-shop"
                        iconBg="bg-gradient-success"
                        borderClass="border-success"
                        delay={0.02}
                      >
                        {(report.revenue || []).map((row, i) => (
                          <LineRow
                            key={`${row.label}-${i}`}
                            label={row.label}
                            amount={row.amount}
                            formatCurrency={fmt}
                          />
                        ))}
                        {(report.revenue || []).length === 0 ? (
                          <p className="text-sm text-muted mb-0 py-2">No revenue lines.</p>
                        ) : null}
                        <div className="d-flex justify-content-between align-items-center pt-3 mt-1">
                          <span className="text-xs text-uppercase font-weight-bold text-success">
                            Total revenue
                          </span>
                          <span className="text-sm font-weight-bolder text-success tabular-nums">
                            {fmt(totals.totalRevenue)}
                          </span>
                        </div>
                      </SectionBlock>

                      <SectionBlock
                        title="Cost of goods sold"
                        subtitle="Direct costs tied to revenue"
                        iconClass="ni ni-box-2"
                        iconBg="bg-gradient-warning"
                        borderClass="border-warning"
                        delay={0.06}
                      >
                        {(report.costOfGoodsSold || []).map((row, i) => (
                          <LineRow
                            key={`${row.label}-${i}`}
                            label={row.label}
                            amount={row.amount}
                            formatCurrency={fmt}
                          />
                        ))}
                        {(report.costOfGoodsSold || []).length === 0 ? (
                          <p className="text-sm text-muted mb-0 py-2">No COGS lines.</p>
                        ) : null}
                        <div className="d-flex justify-content-between align-items-center pt-3 mt-1">
                          <span className="text-xs text-uppercase font-weight-bold text-warning">
                            Total COGS
                          </span>
                          <span className="text-sm font-weight-bolder text-warning tabular-nums">
                            {fmt(totals.totalCOGS)}
                          </span>
                        </div>
                      </SectionBlock>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="alert alert-info border-0 shadow-sm py-3 mb-0"
                        role="status"
                      >
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <span className="font-weight-bold mb-0">Gross profit</span>
                          <span className="h5 font-weight-bolder mb-0 tabular-nums">
                            {fmt(totals.grossProfit)}
                          </span>
                        </div>
                        <p className="text-xs text-muted mb-0 mt-2">
                          Revenue minus cost of goods sold.
                        </p>
                      </motion.div>
                    </div>

                    <div className="col-lg-6">
                      <SectionBlock
                        title="Operating expenses"
                        subtitle="Day-to-day running costs"
                        iconClass="ni ni-settings"
                        iconBg="bg-gradient-secondary"
                        borderClass="border-secondary"
                        delay={0.04}
                      >
                        {(report.operatingExpenses || []).map((row, i) => (
                          <LineRow
                            key={`${row.label}-${i}`}
                            label={row.label}
                            amount={row.amount}
                            formatCurrency={fmt}
                          />
                        ))}
                        {(report.operatingExpenses || []).length === 0 ? (
                          <p className="text-sm text-muted mb-0 py-2">No operating expense lines.</p>
                        ) : null}
                        <div className="d-flex justify-content-between align-items-center pt-3 mt-1">
                          <span className="text-xs text-uppercase font-weight-bold text-muted">
                            Total operating expenses
                          </span>
                          <span className="text-sm font-weight-bolder tabular-nums">
                            {fmt(totals.totalOperatingExpenses)}
                          </span>
                        </div>
                      </SectionBlock>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="alert alert-dark border-0 shadow-sm py-3 mb-3"
                        role="status"
                      >
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <span className="font-weight-bold mb-0">Operating income</span>
                          <span className="h5 font-weight-bolder mb-0 tabular-nums">
                            {fmt(totals.operatingIncome)}
                          </span>
                        </div>
                      </motion.div>

                      <SectionBlock
                        title="Other income & expenses"
                        subtitle="Non-operating items"
                        iconClass="ni ni-bullet-list-67"
                        iconBg="bg-gradient-dark"
                        borderClass="border-dark"
                        delay={0.1}
                      >
                        {(report.otherIncome || []).map((row, i) => (
                          <LineRow
                            key={`oi-${row.label}-${i}`}
                            label={row.label}
                            amount={row.amount}
                            formatCurrency={fmt}
                          />
                        ))}
                        {(report.otherExpenses || []).map((row, i) => (
                          <LineRow
                            key={`oe-${row.label}-${i}`}
                            label={row.label}
                            amount={row.amount}
                            formatCurrency={fmt}
                            muted
                          />
                        ))}
                        {(report.otherIncome || []).length === 0 &&
                        (report.otherExpenses || []).length === 0 ? (
                          <p className="text-sm text-muted mb-0 py-2">No other items.</p>
                        ) : null}
                        <div className="d-flex justify-content-between align-items-center pt-3 mt-1 border-top">
                          <span className="text-xs text-uppercase font-weight-bold text-muted">
                            Net other
                          </span>
                          <span className="text-sm font-weight-bolder tabular-nums">
                            {fmt(totals.totalOtherIncome - totals.totalOtherExpenses)}
                          </span>
                        </div>
                      </SectionBlock>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.12, type: 'spring', stiffness: 120, damping: 18 }}
                        className="card bg-gradient-primary border-0 shadow-lg mb-0"
                      >
                        <div className="card-body p-4">
                          <p className="text-white text-xs text-uppercase font-weight-bold opacity-8 mb-1">
                            Bottom line
                          </p>
                          <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
                            <h3 className="text-white font-weight-bolder mb-0">Net income</h3>
                            <span className="display-6 text-white font-weight-bolder tabular-nums">
                              {fmt(totals.netIncome)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  <p className="text-xs text-muted mt-4 mb-0">
                    <code className="small">GET /api/reports/income-statement?startDate=&amp;endDate=</code>
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
