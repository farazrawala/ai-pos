import { Fragment, useMemo, useState } from 'react';
import { BalanceSheetSummaryBar } from './BalanceSheetSummaryBar.jsx';
import { formatCurrencyAccounting } from './formatCurrency.js';
import './balanceSheetGl.css';

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

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function quarterLabelIfExact(periodStart, periodEnd) {
  const y = periodStart.getFullYear();
  if (y !== periodEnd.getFullYear()) return null;
  if (periodStart.getDate() !== 1) return null;
  const sm = periodStart.getMonth();
  const em = periodEnd.getMonth();
  const q = Math.floor(sm / 3);
  if (sm !== q * 3 || em !== q * 3 + 2) return null;
  const quarterEnd = new Date(y, q * 3 + 3, 0);
  if (!sameCalendarDay(periodEnd, quarterEnd)) return null;
  return `Q${q + 1} ${y}`;
}

const MOCK_BALANCE_SHEET = {
  assets: {
    current: [
      { label: 'Cash', amount: 45_000 },
      { label: 'Accounts Receivable', amount: 28_000 },
      { label: 'Inventory', amount: 62_000 },
    ],
    nonCurrent: [
      { label: 'Property', amount: 180_000 },
      { label: 'Equipment', amount: 95_000 },
    ],
  },
  liabilities: {
    current: [
      { label: 'Accounts Payable', amount: 22_000 },
      // { label: 'Short-term Debt', amount: 15_000 },
    ],
    longTerm: [{ label: 'Long-term notes payable', amount: 120_000 }],
  },
  equity: [
    { label: "Owner's Equity", amount: 150_000 },
    { label: 'Retained Earnings', amount: 103_000 },
  ],
};

function sumLines(lines) {
  return lines.reduce((acc, row) => acc + row.amount, 0);
}

function GlStatementPanel({ variant, heading, periodSuffix, groups, grandTotal, grandLabel }) {
  const hdClass = variant === 'assets' ? 'assets' : 'le';
  return (
    <div className="bs-gl-panel">
      <div className={`bs-gl-panel-hd ${hdClass}`}>
        {heading}
        <span className="period"> · {periodSuffix}</span>
      </div>
      <table className="bs-gl-table">
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              <tr className="bs-gl-section">
                <td colSpan={2}>{g.title}</td>
              </tr>
              {g.lines.map((row) => (
                <tr key={`${g.title}-${row.label}`} className="bs-gl-line">
                  <td>{row.label}</td>
                  <td className="num">{formatCurrencyAccounting(row.amount)}</td>
                </tr>
              ))}
              <tr className="bs-gl-subtotal">
                <td>Subtotal</td>
                <td className="num">{formatCurrencyAccounting(g.subtotal)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{grandLabel}</td>
            <td className="num">{formatCurrencyAccounting(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function BalanceSheetView() {
  const [fromYear, setFromYear] = useState(() => new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(() => new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(() => new Date().getFullYear());
  const [toMonth, setToMonth] = useState(() => new Date().getMonth() + 1);

  const periodStart = useMemo(
    () => startOfCalendarMonth(fromYear, fromMonth),
    [fromYear, fromMonth]
  );
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

  const periodSuffix = useMemo(() => {
    const q = quarterLabelIfExact(periodStart, periodEnd);
    return q || rangeLabel;
  }, [periodStart, periodEnd, rangeLabel]);

  const asOfLabel = useMemo(() => {
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
    return df.format(periodEnd);
  }, [periodEnd]);

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

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y - 10; i <= y + 2; i += 1) out.push(i);
    return out;
  }, []);

  const {
    totalCurrentAssets,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    totalLiabilities,
    totalEquity,
    liabilitiesPlusEquity,
    difference,
    balanced,
  } = useMemo(() => {
    const data = MOCK_BALANCE_SHEET;
    const totalCurrentAssets = sumLines(data.assets.current);
    const totalNonCurrentAssets = sumLines(data.assets.nonCurrent);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    const totalCurrentLiabilities = sumLines(data.liabilities.current);
    const totalLongTermLiabilities = sumLines(data.liabilities.longTerm);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalEquity = sumLines(data.equity);
    const liabilitiesPlusEquity = totalLiabilities + totalEquity;
    const difference = totalAssets - liabilitiesPlusEquity;
    const balanced = Math.abs(difference) < 0.005;

    return {
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalLongTermLiabilities,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      difference,
      balanced,
    };
  }, []);

  const assetGroups = useMemo(
    () => [
      {
        title: 'Current assets',
        lines: MOCK_BALANCE_SHEET.assets.current,
        subtotal: totalCurrentAssets,
      },
      {
        title: 'Non-current assets',
        lines: MOCK_BALANCE_SHEET.assets.nonCurrent,
        subtotal: totalNonCurrentAssets,
      },
    ],
    [totalCurrentAssets, totalNonCurrentAssets]
  );

  const liabilityEquityGroups = useMemo(
    () => [
      {
        title: 'Current liabilities',
        lines: MOCK_BALANCE_SHEET.liabilities.current,
        subtotal: totalCurrentLiabilities,
      },
      {
        title: 'Long-term liabilities',
        lines: MOCK_BALANCE_SHEET.liabilities.longTerm,
        subtotal: totalLongTermLiabilities,
      },
      {
        title: "Owner's equity",
        lines: MOCK_BALANCE_SHEET.equity,
        subtotal: totalEquity,
      },
    ],
    [totalCurrentLiabilities, totalLongTermLiabilities, totalEquity]
  );

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12 px-3 px-md-4 py-2">
          <div className="bs-gl-frame">
            <div className="bs-gl">
              <div className="bs-gl-toolbar">
                <div className="bs-gl-toolbar-title">
                  <h1>Statement of financial position</h1>
                  <div className="bs-gl-sub">
                    Balance sheet · As of {asOfLabel} · Basis: accrual (sample)
                  </div>
                </div>
                <div className="bs-gl-filters">
                  <div className="bs-gl-fg">
                    <span>From</span>
                    <div className="d-flex gap-1">
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
                  <div className="bs-gl-fg">
                    <span>To</span>
                    <div className="d-flex gap-1">
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
                </div>
                <div className="bs-gl-meta">
                  <span className="bs-gl-meta-label">Reporting range</span>
                  <span className="bs-gl-meta-value">{rangeDetail}</span>
                </div>
              </div>

              <div className="bs-gl-panels">
                <GlStatementPanel
                  variant="assets"
                  heading="Assets"
                  periodSuffix={periodSuffix}
                  groups={assetGroups}
                  grandTotal={totalAssets}
                  grandLabel="Total assets"
                />
                <GlStatementPanel
                  variant="le"
                  heading="Liabilities & equity"
                  periodSuffix={periodSuffix}
                  groups={liabilityEquityGroups}
                  grandTotal={liabilitiesPlusEquity}
                  grandLabel="Total liabilities & equity"
                />
              </div>

              <div className={`bs-gl-status ${balanced ? 'ok' : 'warn'}`}>
                <span>
                  <strong>Equation check:</strong> Assets ({formatCurrencyAccounting(totalAssets)})
                  = Liabilities + equity ({formatCurrencyAccounting(liabilitiesPlusEquity)})
                </span>
                <span>
                  {balanced ? (
                    <span className="bs-gl-pill bs-gl-pill-success">In balance</span>
                  ) : (
                    <span className="bs-gl-pill bs-gl-pill-warn">
                      Out of balance · {formatCurrencyAccounting(difference)}
                    </span>
                  )}
                </span>
              </div>

              <BalanceSheetSummaryBar
                totalAssets={totalAssets}
                liabilitiesPlusEquity={liabilitiesPlusEquity}
                difference={difference}
                formatCurrency={formatCurrencyAccounting}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
