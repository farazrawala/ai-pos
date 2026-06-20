import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchIncomeStatement } from '../../features/incomeStatement/incomeStatementSlice.js';
import {
  computeIncomeStatementTotals,
  fetchIncomeStatementRequest,
} from '../../features/incomeStatement/incomeStatementAPI.js';
import { formatCurrency as formatCurrencyFn } from '../balanceSheet/formatCurrency.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../SearchInputIcon.jsx';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import IncomeStatementCharts from './IncomeStatementCharts.jsx';
import '../common/devApiSources.css';
import {
  FaBoxesStacked,
  FaChevronDown,
  FaChevronRight,
  FaCoins,
  FaFileExport,
  FaMoneyBillWave,
  FaChartLine,
} from 'react-icons/fa6';

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

/** Same-length window ending the day before `periodStart`. */
function getPriorRange(periodStart, periodEnd) {
  const lenMs = periodEnd.getTime() - periodStart.getTime();
  const priorEnd = new Date(periodStart);
  priorEnd.setDate(priorEnd.getDate() - 1);
  priorEnd.setHours(23, 59, 59, 999);
  const priorStart = new Date(priorEnd.getTime() - lenMs);
  priorStart.setHours(0, 0, 0, 0);
  return { priorStart, priorEnd };
}

function formatCompactMillions(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(x / 1_000).toFixed(2)}K`;
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pctChange(curr, prior, { invert = false } = {}) {
  const c = Number(curr);
  const p = Number(prior);
  if (!Number.isFinite(c)) return { text: '—', kind: 'neutral' };
  if (!Number.isFinite(p) || p === 0) {
    if (c === 0) return { text: '—', kind: 'neutral' };
    return { text: '+100%', kind: invert ? 'neg' : 'pos' };
  }
  const raw = ((c - p) / Math.abs(p)) * 100;
  const text = `${raw > 0 ? '+' : ''}${raw.toFixed(1)}%`;
  const economicallyPositive = invert ? raw <= 0 : raw >= 0;
  return { text, kind: economicallyPositive ? 'pos' : 'neg' };
}

function deltaTextClass(kind) {
  if (kind === 'pos') return 'text-success';
  if (kind === 'neg') return 'text-danger';
  return 'text-muted';
}

function priorAmountForLabel(lines, label) {
  if (!Array.isArray(lines)) return 0;
  const row = lines.find((r) => String(r?.label || '').trim() === String(label || '').trim());
  return Number(row?.amount) || 0;
}

function subtotalRowVariant(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('net income')) return 'net';
  if (l.includes('gross profit')) return 'gross';
  return 'section';
}

function AccountLinesStatement({ rows, expanded, onToggleSection, fmt }) {
  if (!rows.length) {
    return (
      <div className="text-center py-5 text-muted">
        <p className="mb-0 text-sm">No accounts match your filter.</p>
      </div>
    );
  }

  return (
    <div className="income-statement-lines">
      <div className="income-statement-lines-head d-none d-md-flex">
        <span>Account description</span>
        <span>Amount</span>
      </div>
      <ul className="list-unstyled mb-0">
        {rows.map((row, idx) => {
          if (row.type === 'group') {
            const open = expanded.has(row.id);
            return (
              <li key={row.id} className="income-statement-lines-group">
                <button
                  type="button"
                  className="income-statement-lines-group-btn"
                  onClick={() => onToggleSection(row.id)}
                  aria-expanded={open}
                >
                  <span className="income-statement-lines-group-label">
                    <NavIcon
                      icon={open ? FaChevronDown : FaChevronRight}
                      size={12}
                      className="text-secondary me-2"
                    />
                    {row.title}
                  </span>
                </button>
              </li>
            );
          }

          if (row.type === 'leaf') {
            return (
              <li
                key={`leaf-${row.label}-${idx}`}
                className="income-statement-lines-row income-statement-lines-row--leaf"
              >
                <span className="income-statement-lines-desc">{row.label}</span>
                <span className="income-statement-lines-amt">{fmt(row.cur)}</span>
              </li>
            );
          }

          const variant = subtotalRowVariant(row.label);
          const variantClass =
            variant === 'net'
              ? 'income-statement-lines-row--net'
              : variant === 'gross'
                ? 'income-statement-lines-row--gross'
                : 'income-statement-lines-row--section-total';

          return (
            <li
              key={`sub-${row.label}-${idx}`}
              className={`income-statement-lines-row income-statement-lines-row--subtotal ${variantClass}`}
            >
              <span className="income-statement-lines-desc">{row.label}</span>
              <span className="income-statement-lines-amt">{fmt(row.cur)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryStatCard({ title, value, delta, deltaKind, gradient, icon }) {
  return (
    <div className="col-lg-3 col-md-6 col-12">
      <div className="card mb-3">
        <div className="card-body p-3">
          <div className="row">
            <div className="col-8">
              <div className="numbers">
                <p className="text-sm mb-0 text-uppercase font-weight-bold">{title}</p>
                <h5 className="font-weight-bolder mb-0">{value}</h5>
                <p className="mb-0 mt-1">
                  <span className={`text-sm font-weight-bolder ${deltaTextClass(deltaKind)}`}>
                    {delta}
                  </span>
                  <span className="text-muted text-sm"> vs prior period</span>
                </p>
              </div>
            </div>
            <div className="col-4 text-end">
              <div
                className={`icon icon-shape bg-gradient-${gradient} shadow text-center rounded-circle d-inline-flex align-items-center justify-content-center`}
              >
                <NavIcon icon={icon} className="text-white opacity-10" size={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncomeStatementView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canView } = usePermissions('income-statement');
  useRequireModuleAccess('income-statement');
  const { status, error, report, demo, apiSources, wallDurationMs } = useSelector(
    (state) => state.incomeStatement
  );

  const fmt = useCallback((n) => formatCurrencyFn(n), []);

  const [fromYear, setFromYear] = useState(() => new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(() => new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(() => new Date().getFullYear());
  const [toMonth, setToMonth] = useState(() => new Date().getMonth() + 1);
  const [priorReport, setPriorReport] = useState(null);
  const [priorStatus, setPriorStatus] = useState('idle');
  const [tableFilter, setTableFilter] = useState('');
  const [expanded, setExpanded] = useState(
    () => new Set(['revenue', 'cogs', 'opex', 'otherIncome', 'otherExpenses'])
  );

  const periodStart = useMemo(
    () => startOfCalendarMonth(fromYear, fromMonth),
    [fromYear, fromMonth]
  );
  const periodEnd = useMemo(() => endOfCalendarMonth(toYear, toMonth), [toYear, toMonth]);

  const { priorStart, priorEnd } = useMemo(
    () => getPriorRange(periodStart, periodEnd),
    [periodStart, periodEnd]
  );

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

  const applyQuarterPreset = (q) => {
    const y = new Date().getFullYear();
    const ranges = {
      1: [1, 3],
      2: [4, 6],
      3: [7, 9],
      4: [10, 12],
    };
    const [a, b] = ranges[q] || [1, 3];
    setFrom(y, a);
    setTo(y, b);
  };

  useEffect(() => {
    const startDate = toYmd(periodStart);
    const endDate = toYmd(periodEnd);
    dispatch(fetchIncomeStatement({ startDate, endDate }));
  }, [dispatch, periodStart, periodEnd]);

  useEffect(() => {
    let cancelled = false;
    setPriorStatus('loading');
    const ps = toYmd(priorStart);
    const pe = toYmd(priorEnd);
    fetchIncomeStatementRequest({ startDate: ps, endDate: pe })
      .then(({ report: r }) => {
        if (!cancelled) {
          setPriorReport(r);
          setPriorStatus('succeeded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPriorReport(null);
          setPriorStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [priorStart, priorEnd]);

  useEffect(() => {
    if (status === 'failed' && error) {
      console.error('[Income statement module] Failed to load report', error);
    }
  }, [status, error]);

  const totals = useMemo(() => computeIncomeStatementTotals(report), [report]);
  const priorTotals = useMemo(() => computeIncomeStatementTotals(priorReport || {}), [priorReport]);
  const priorReady = priorStatus === 'succeeded' && priorReport != null;

  const loading = status === 'loading';
  const showData = status === 'succeeded' && report != null;

  const toggleSection = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tableRows = useMemo(() => {
    if (!report) return [];
    const pr = priorReport || {};
    const q = tableFilter.trim().toLowerCase();
    const match = (label) => !q || String(label).toLowerCase().includes(q);

    const rows = [];

    const pushGroup = (id, title) => {
      rows.push({ type: 'group', id, title });
    };
    const pushLeaf = (label, cur, pri, invert = false) => {
      if (!match(label)) return;
      const p = Number(pri) || 0;
      const c = Number(cur) || 0;
      const ytd = priorReady ? c + p : c;
      const ch = priorReady ? pctChange(c, p, { invert }) : { text: '—', kind: 'neutral' };
      rows.push({
        type: 'leaf',
        label,
        cur: c,
        pri: priorReady ? p : null,
        ytd,
        deltaText: ch.text,
        deltaKind: ch.kind,
      });
    };
    const pushSubtotal = (label, cur, pri, invert = false) => {
      if (!match(label)) return;
      const p = Number(pri) || 0;
      const c = Number(cur) || 0;
      const ytd = priorReady ? c + p : c;
      const ch = priorReady ? pctChange(c, p, { invert }) : { text: '—', kind: 'neutral' };
      rows.push({
        type: 'subtotal',
        label,
        cur: c,
        pri: priorReady ? p : null,
        ytd,
        deltaText: ch.text,
        deltaKind: ch.kind,
      });
    };

    pushGroup('revenue', 'Revenue');
    if (expanded.has('revenue')) {
      (report.revenue || []).forEach((row) => {
        const pri = priorAmountForLabel(pr.revenue, row.label);
        pushLeaf(row.label, row.amount, pri, false);
      });
      pushSubtotal('Total revenue', totals.totalRevenue, priorTotals.totalRevenue, false);
    }

    pushGroup('cogs', 'Cost of goods sold');
    if (expanded.has('cogs')) {
      (report.costOfGoodsSold || []).forEach((row) => {
        const pri = priorAmountForLabel(pr.costOfGoodsSold, row.label);
        pushLeaf(row.label, row.amount, pri, true);
      });
      pushSubtotal('Total COGS', totals.totalCOGS, priorTotals.totalCOGS, true);
    }

    const gpPrior = priorTotals.totalRevenue - priorTotals.totalCOGS;
    pushLeaf('Gross profit', totals.grossProfit, gpPrior, false);

    pushGroup('opex', 'Operating expenses');
    if (expanded.has('opex')) {
      (report.operatingExpenses || []).forEach((row) => {
        const pri = priorAmountForLabel(pr.operatingExpenses, row.label);
        pushLeaf(row.label, row.amount, pri, true);
      });
      pushSubtotal(
        'Total operating expenses',
        totals.totalOperatingExpenses,
        priorTotals.totalOperatingExpenses,
        true
      );
    }

    pushLeaf('Operating income', totals.operatingIncome, priorTotals.operatingIncome, false);

    if ((report.otherIncome || []).length > 0 || totals.totalOtherIncome !== 0) {
      pushGroup('otherIncome', 'Other income');
      if (expanded.has('otherIncome')) {
        (report.otherIncome || []).forEach((row) => {
          const pri = priorAmountForLabel(pr.otherIncome, row.label);
          pushLeaf(row.label, row.amount, pri, false);
        });
        pushSubtotal(
          'Total other income',
          totals.totalOtherIncome,
          priorTotals.totalOtherIncome,
          false
        );
      }
    }

    if ((report.otherExpenses || []).length > 0 || totals.totalOtherExpenses !== 0) {
      pushGroup('otherExpenses', 'Other expenses');
      if (expanded.has('otherExpenses')) {
        (report.otherExpenses || []).forEach((row) => {
          const pri = priorAmountForLabel(pr.otherExpenses, row.label);
          pushLeaf(row.label, row.amount, pri, true);
        });
        pushSubtotal(
          'Total other expenses',
          totals.totalOtherExpenses,
          priorTotals.totalOtherExpenses,
          true
        );
      }
    }

    pushSubtotal('Net income', totals.netIncome, priorTotals.netIncome, false);

    return rows;
  }, [report, priorReport, priorTotals, totals, expanded, tableFilter, priorReady]);

  const exportCsv = () => {
    const lines = [['Account', 'Amount']];
    tableRows.forEach((r) => {
      if (r.type === 'leaf' || r.type === 'subtotal') {
        lines.push([r.label, String(r.cur)]);
      }
    });
    const blob = new Blob(
      [lines.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')],
      {
        type: 'text/csv;charset=utf-8',
      }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'income-statement.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const revDelta = useMemo(
    () =>
      priorReady
        ? pctChange(totals.totalRevenue, priorTotals.totalRevenue, { invert: false })
        : { text: '—', kind: 'neutral' },
    [priorReady, totals.totalRevenue, priorTotals.totalRevenue]
  );
  const cogsDelta = useMemo(
    () =>
      priorReady
        ? pctChange(totals.totalCOGS, priorTotals.totalCOGS, { invert: true })
        : { text: '—', kind: 'neutral' },
    [priorReady, totals.totalCOGS, priorTotals.totalCOGS]
  );
  const opexDelta = useMemo(
    () =>
      priorReady
        ? pctChange(totals.totalOperatingExpenses, priorTotals.totalOperatingExpenses, {
            invert: true,
          })
        : { text: '—', kind: 'neutral' },
    [priorReady, totals.totalOperatingExpenses, priorTotals.totalOperatingExpenses]
  );
  const niDelta = useMemo(
    () =>
      priorReady
        ? pctChange(totals.netIncome, priorTotals.netIncome, { invert: false })
        : { text: '—', kind: 'neutral' },
    [priorReady, totals.netIncome, priorTotals.netIncome]
  );

  return (
    <div className="container-fluid py-3">
      {/* <div className="row">
        <div className="col-12">
          <div className="card mb-3">
            <div className="card-body pb-4">
              <div className="row g-4 align-items-end">
                <div className="col-md-4 col-lg-3">
                  <label className="form-label text-xs text-uppercase text-muted mb-2">From</label>
                  <div className="d-flex gap-2">
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
                <div className="col-md-4 col-lg-3">
                  <label className="form-label text-xs text-uppercase text-muted mb-2">To</label>
                  <div className="d-flex gap-2">
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
                <div className="col-md-4 col-lg-3">
                  <label
                    className="form-label text-xs text-uppercase text-muted mb-2"
                    htmlFor="is-quarter-preset"
                  >
                    Year / quarter
                  </label>
                  <select
                    id="is-quarter-preset"
                    className="form-select form-select-sm"
                    aria-label="Quick quarter preset"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) applyQuarterPreset(parseInt(v, 10));
                      e.target.value = '';
                    }}
                  >
                    <option value="">Presets…</option>
                    <option value="1">Q1 (Jan–Mar)</option>
                    <option value="2">Q2 (Apr–Jun)</option>
                    <option value="3">Q3 (Jul–Sep)</option>
                    <option value="4">Q4 (Oct–Dec)</option>
                  </select>
                </div>
                {demo ? (
                  <div className="col-md-4 col-lg-3">
                    <span className="badge bg-gradient-warning mb-0">Demo data</span>
                  </div>
                ) : null}
                {priorStatus === 'loading' ? (
                  <div className="col-md-4 col-lg-6">
                    <span className="text-sm text-muted">Loading prior period…</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {loading ? (
        <div className="row">
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
            <p className="text-sm text-muted mt-3 mb-0">Loading statement…</p>
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        </div>
      ) : null}

      {showData ? (
        <>
          <div className="row">
            <SummaryStatCard
              title="Gross revenue"
              value={formatCompactMillions(totals.totalRevenue)}
              delta={revDelta.text}
              deltaKind={revDelta.kind}
              gradient="primary"
              icon={FaCoins}
            />
            <SummaryStatCard
              title="Cost of goods sold"
              value={formatCompactMillions(totals.totalCOGS)}
              delta={cogsDelta.text}
              deltaKind={cogsDelta.kind}
              gradient="warning"
              icon={FaBoxesStacked}
            />
            <SummaryStatCard
              title="Operating expenses"
              value={formatCompactMillions(totals.totalOperatingExpenses)}
              delta={opexDelta.text}
              deltaKind={opexDelta.kind}
              gradient="danger"
              icon={FaMoneyBillWave}
            />
            <SummaryStatCard
              title="Net income"
              value={formatCompactMillions(totals.netIncome)}
              delta={niDelta.text}
              deltaKind={niDelta.kind}
              gradient="success"
              icon={FaChartLine}
            />
          </div>

          <IncomeStatementCharts report={report} />

          <div className="row">
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-header pb-3 border-bottom">
                  <div className="row align-items-center g-3">
                    <div className="col-md-5 col-lg-4">
                      <h6 className="mb-1">Account lines</h6>
                      <p className="text-sm text-muted mb-0">
                        Expand sections to view detail. Amounts for the selected period.
                      </p>
                    </div>
                    <div className="col-md-7 col-lg-8">
                      <div className="d-flex flex-wrap align-items-center justify-content-md-end gap-2">
                        <div
                          className="input-group input-group-sm flex-grow-1"
                          style={{ maxWidth: '320px', minWidth: '200px' }}
                        >
                          <span className="input-group-text text-body">
                            <SearchInputIcon />
                          </span>
                          <input
                            type="search"
                            className="form-control"
                            placeholder="Filter accounts…"
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            aria-label="Filter accounts"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary mb-0 flex-shrink-0"
                          aria-label="Export CSV"
                          title="Export CSV"
                          onClick={exportCsv}
                        >
                          <NavIcon icon={FaFileExport} className="me-1" size={14} />
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-body pt-3">
                  <AccountLinesStatement
                    rows={tableRows}
                    expanded={expanded}
                    onToggleSection={toggleSection}
                    fmt={fmt}
                  />

                  <DevApiSourcesFooter
                    sources={apiSources}
                    wallDurationMs={wallDurationMs}
                    className="mt-3"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
