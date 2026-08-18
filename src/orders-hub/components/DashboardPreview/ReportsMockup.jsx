import { Download, Printer } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { dailyReport, salesTrend } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';
import { chartColors, chartMargin, tooltipStyle } from '../../utils/chartTheme.js';

export default function ReportsMockup() {
  return (
    <div className="oh-mock" aria-hidden="true" inert>
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · Daily Report · 18 Aug 2026</p>
      </div>
      <div className="oh-report-actions">
        <button type="button">
          <Download size={15} /> Download Report
        </button>
        <button type="button">
          <Printer size={15} /> Print Report
        </button>
      </div>
      <div className="oh-report-grid">
        {dailyReport.map((row) => (
          <div key={row.label} className="oh-kpi">
            <p>{row.label}</p>
            <strong>{formatPKR(row.value)}</strong>
          </div>
        ))}
      </div>
      <div className="oh-mock__panel">
        <div className="oh-mock__panel-head">
          <strong>Daily sales</strong>
          <span>This week</span>
        </div>
        <div className="oh-chart oh-chart--sm">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesTrend} margin={chartMargin}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatPKR(v)} />
              <Area type="monotone" dataKey="sales" stroke={chartColors.navy} strokeWidth={2} fill={chartColors.tealSoft} fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
