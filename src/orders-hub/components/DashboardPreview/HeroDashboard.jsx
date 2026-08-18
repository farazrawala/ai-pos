import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { recentTransactions, salesTrend, topProducts } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';
import { chartColors, chartMargin, tooltipStyle } from '../../utils/chartTheme.js';

function Stat({ label, value, prefix = '', suffix = '', change }) {
  return (
    <div className="oh-stat">
      <p className="oh-stat__label">{label}</p>
      <p className="oh-stat__value">
        {prefix}
        {Number(value).toLocaleString('en-US')}
        {suffix}
      </p>
      {change ? <p className="oh-stat__change">{change}</p> : null}
    </div>
  );
}

export default function HeroDashboard() {
  return (
    <div className="oh-mock oh-mock--hero" aria-hidden="true" inert>
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · Dashboard</p>
      </div>
      <div className="oh-mock__hero-grid">
        <Stat label="Today's Sales" value={186400} prefix="PKR " change="+18.4%" />
        <Stat label="Orders" value={24} change="24 new" />
        <Stat label="Profit" value={2840} prefix="PKR " />
        <Stat label="Expenses" value={12400} prefix="PKR " />
        <Stat label="Low Stock" value={8} />
      </div>
      <div className="oh-mock__split">
        <div className="oh-mock__panel">
          <div className="oh-mock__panel-head">
            <strong>Sales</strong>
            <span>This week</span>
          </div>
          <div className="oh-chart oh-chart--sm">
            <ResponsiveContainer width="100%" height="100%" debounce={1}>
              <AreaChart data={salesTrend} margin={chartMargin}>
                <defs>
                  <linearGradient id="heroSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.teal} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={chartColors.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => formatPKR(v)}
                  cursor={{ stroke: chartColors.teal, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={chartColors.teal}
                  strokeWidth={2}
                  fill="url(#heroSales)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="oh-mock__panel">
          <div className="oh-mock__panel-head">
            <strong>Recent transactions</strong>
          </div>
          <ul className="oh-mini-list">
            {recentTransactions.map((row) => (
              <li key={row.id}>
                <span>
                  <b>{row.party}</b>
                  <small>
                    {row.id} · {row.method}
                  </small>
                </span>
                <strong>{formatPKR(row.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="oh-mock__panel">
        <div className="oh-mock__panel-head">
          <strong>Top products</strong>
        </div>
        <ul className="oh-pills">
          {topProducts.map((p) => (
            <li key={p.name}>
              <span>{p.name}</span>
              <b>{p.sold} sold</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
