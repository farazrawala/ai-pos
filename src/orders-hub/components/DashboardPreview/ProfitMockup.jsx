import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { monthlyProfit, profitInsights } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';
import { chartColors, chartMargin, tooltipStyle } from '../../utils/chartTheme.js';

const june = monthlyProfit[monthlyProfit.length - 1];

const snapshot = [
  { label: 'Revenue', value: june.revenue },
  { label: 'COGS', value: june.cogs },
  { label: 'Gross Profit', value: june.revenue - june.cogs },
  { label: 'Expenses', value: june.expenses },
  { label: 'Net Profit', value: june.profit, accent: true },
];

export default function ProfitMockup() {
  return (
    <div className="oh-mock" aria-hidden="true" inert>
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · Profit & Loss</p>
      </div>
      <div className="oh-kpi-row">
        {snapshot.map((row) => (
          <div key={row.label} className={`oh-kpi${row.accent ? ' is-accent' : ''}`}>
            <p>{row.label}</p>
            <strong>{formatPKR(row.value)}</strong>
          </div>
        ))}
      </div>
      <div className="oh-chart oh-chart--md">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyProfit} margin={{ ...chartMargin, left: 0 }}>
            <CartesianGrid stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatPKR(v)} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill={chartColors.navy} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill={chartColors.muted} radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Net Profit" fill={chartColors.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="oh-insight-row">
        {profitInsights.map((card) => (
          <article key={card.title}>
            <strong>{card.title}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
