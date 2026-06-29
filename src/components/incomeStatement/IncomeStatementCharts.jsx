import { useMemo } from 'react';
import { computeIncomeStatementTotals } from '../../features/incomeStatement/incomeStatementAPI.js';

function formatCompactMillions(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(x / 1_000).toFixed(2)}K`;
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function linesToChartItems(lines, colorByLabel = {}) {
  return (Array.isArray(lines) ? lines : [])
    .filter((row) => row?.label)
    .map((row) => {
      const amount = Number(row.amount) || 0;
      const label = String(row.label);
      return {
        label,
        amount,
        color: colorByLabel[label] || '#8392ab',
      };
    });
}

function BreakdownBarChartSvg({ items, ariaLabel }) {
  const list = items.filter((it) => Number.isFinite(it.amount) && it.amount !== 0);
  const h = 180;
  const pad = { t: 12, r: 8, b: 36, l: 8 };
  const chartW = 360;
  const innerW = chartW - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  if (!list.length) {
    return (
      <p className="text-sm text-muted mb-0 py-4 text-center">No data for this period.</p>
    );
  }

  const maxVal = Math.max(1, ...list.map((it) => Math.abs(it.amount)));
  const n = list.length;
  const groupW = innerW / n;
  const barW = Math.min(48, groupW * 0.55);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.t + innerH * (1 - t),
    lab: formatCompactMillions(maxVal * t),
  }));

  return (
    <svg
      viewBox={`0 0 ${chartW} ${h}`}
      width="100%"
      height={h}
      style={{ display: 'block' }}
      role="img"
      aria-label={ariaLabel}
    >
      {yTicks.map((tk) => (
        <g key={tk.lab}>
          <line
            x1={pad.l}
            x2={chartW - pad.r}
            y1={tk.y}
            y2={tk.y}
            stroke="#e9ecef"
            strokeWidth="1"
          />
          <text x={pad.l + 2} y={tk.y + 4} fill="#8392ab" fontSize="9">
            {tk.lab}
          </text>
        </g>
      ))}
      {list.map((it, i) => {
        const gx = pad.l + i * groupW + (groupW - barW) / 2;
        const barH = (Math.abs(it.amount) / maxVal) * innerH;
        const y = pad.t + innerH - barH;
        const fill = it.amount < 0 ? '#f5365c' : it.color;
        const shortLabel =
          it.label.length > 14 ? `${it.label.slice(0, 12)}…` : it.label;
        return (
          <g key={it.label}>
            <rect x={gx} y={y} width={barW} height={barH} fill={fill} rx={3} opacity={0.9} />
            <text
              x={gx + barW / 2}
              y={h - 8}
              fill="#67748e"
              fontSize="9"
              textAnchor="middle"
            >
              {shortLabel}
            </text>
            <text
              x={gx + barW / 2}
              y={y - 4}
              fill="#344767"
              fontSize="9"
              textAnchor="middle"
            >
              {formatCompactMillions(it.amount)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PlSummaryBarChartSvg({ totals }) {
  const items = useMemo(
    () => [
      { label: 'Revenue', amount: totals.totalRevenue, color: '#5e72e4' },
      { label: 'COGS', amount: totals.totalCOGS, color: '#fb6340' },
      { label: 'Op. expenses', amount: totals.totalOperatingExpenses, color: '#f5365c' },
      {
        label: 'Net income',
        amount: totals.netIncome,
        color: totals.netIncome >= 0 ? '#2dce89' : '#f5365c',
      },
    ],
    [totals]
  );

  return (
    <BreakdownBarChartSvg items={items} ariaLabel="Profit and loss summary for the period" />
  );
}

function OpExDonut({ items, colors }) {
  const list = (Array.isArray(items) ? items : []).filter((x) => Number(x?.amount) > 0);
  const total = list.reduce((s, x) => s + (Number(x.amount) || 0), 0) || 1;
  let acc = 0;
  const segs = list.map((it, i) => {
    const pct = (Number(it.amount) / total) * 100;
    const start = acc;
    acc += pct;
    return { ...it, start, pct, color: colors[i % colors.length] };
  });
  const stops = segs.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');
  const gradient = segs.length ? `conic-gradient(from -90deg, ${stops})` : '#334155';

  return (
    <div className="d-flex flex-wrap align-items-center gap-3 justify-content-between">
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: gradient,
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 28px #fff',
        }}
        aria-hidden
      />
      <ul className="list-unstyled mb-0 flex-grow-1" style={{ minWidth: '140px' }}>
        {segs.map((s) => (
          <li key={s.label} className="d-flex align-items-center gap-2 mb-2 text-sm">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span className="text-truncate flex-grow-1" title={s.label}>
              {s.label}
            </span>
            <span className="text-muted">{formatCompactMillions(s.amount)}</span>
          </li>
        ))}
        {!segs.length ? (
          <li className="text-muted small">No operating expense lines</li>
        ) : null}
      </ul>
    </div>
  );
}

const REVENUE_COLORS = {
  Sales: '#11cdef',
  'Sales returns': '#f5365c',
};

const COGS_COLORS = {
  'Cost of Goods Sold': '#fb6340',
};

/**
 * Charts driven by merged income-statement API responses (report object).
 */
export default function IncomeStatementCharts({ report }) {
  const totals = useMemo(() => computeIncomeStatementTotals(report), [report]);
  const revenueItems = useMemo(
    () => linesToChartItems(report?.revenue, REVENUE_COLORS),
    [report?.revenue]
  );
  const cogsItems = useMemo(
    () => linesToChartItems(report?.costOfGoodsSold, COGS_COLORS),
    [report?.costOfGoodsSold]
  );
  const donutColors = ['#5e72e4', '#11cdef', '#2dce89', '#fb6340', '#8392ab', '#825ee4'];

  return (
    <div className="row mb-3">
      <div className="col-lg-6 col-xl-3 mb-3 mb-xl-0">
        <div className="card h-100 shadow-sm">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Revenue</h6>
            <p className="text-sm text-muted mb-0">Sales & sales returns</p>
          </div>
          <div className="card-body pt-2">
            <BreakdownBarChartSvg
              items={revenueItems}
              ariaLabel="Revenue breakdown from order sales and sales returns APIs"
            />
          </div>
        </div>
      </div>
      <div className="col-lg-6 col-xl-3 mb-3 mb-xl-0">
        <div className="card h-100 shadow-sm">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Cost of goods sold</h6>
            <p className="text-sm text-muted mb-0">Inventory sold (qty × WAC)</p>
          </div>
          <div className="card-body pt-2">
            <BreakdownBarChartSvg
              items={cogsItems}
              ariaLabel="COGS from inventory issued through sales (qty times weighted average cost)"
            />
          </div>
        </div>
      </div>
      <div className="col-lg-6 col-xl-3 mb-3 mb-lg-0">
        <div className="card h-100 shadow-sm">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">P&amp;L summary</h6>
            <p className="text-sm text-muted mb-0">Period totals</p>
          </div>
          <div className="card-body pt-2">
            <PlSummaryBarChartSvg totals={totals} />
          </div>
        </div>
      </div>
      <div className="col-lg-6 col-xl-3">
        <div className="card h-100 shadow-sm">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Operating expenses</h6>
            <p className="text-sm text-muted mb-0">By GL account</p>
          </div>
          <div className="card-body pt-2">
            <OpExDonut items={report?.operatingExpenses} colors={donutColors} />
          </div>
        </div>
      </div>
    </div>
  );
}
