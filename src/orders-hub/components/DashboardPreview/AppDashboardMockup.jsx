import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import {
  dashboardNav,
  lowStock,
  monthlyProfit,
  recentOrders,
  recentPayments,
  salesTrend,
} from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';
import { chartColors, chartMargin, tooltipStyle } from '../../utils/chartTheme.js';

export default function AppDashboardMockup() {
  return (
    <div className="oh-app" aria-hidden="true" inert>
      <aside className="oh-app__side">
        <p className="oh-app__brand">Orders Hub</p>
        <ul>
          {dashboardNav.map((item, i) => (
            <li key={item} className={i === 0 ? 'is-active' : ''}>
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <div className="oh-app__main">
        <div className="oh-kpi-row oh-kpi-row--4">
          <div className="oh-kpi">
            <p>Sales</p>
            <strong>{formatPKR(186400)}</strong>
          </div>
          <div className="oh-kpi">
            <p>Orders</p>
            <strong>24</strong>
          </div>
          <div className="oh-kpi">
            <p>Profit</p>
            <strong>{formatPKR(42100)}</strong>
          </div>
          <div className="oh-kpi">
            <p>Customers</p>
            <strong>1,284</strong>
          </div>
        </div>
        <div className="oh-app__charts">
          <div className="oh-mock__panel">
            <div className="oh-mock__panel-head">
              <strong>Sales Overview</strong>
            </div>
            <div className="oh-chart oh-chart--sm">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={chartMargin}>
                  <CartesianGrid stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.muted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatPKR(v)} />
                  <Area type="monotone" dataKey="sales" stroke={chartColors.teal} fill={chartColors.teal} fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="oh-mock__panel">
            <div className="oh-mock__panel-head">
              <strong>Profit Overview</strong>
            </div>
            <div className="oh-chart oh-chart--sm">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyProfit.slice(-6)} margin={chartMargin}>
                  <CartesianGrid stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartColors.muted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatPKR(v)} />
                  <Area type="monotone" dataKey="profit" stroke={chartColors.navy} fill={chartColors.navy} fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="oh-app__tables">
          <div className="oh-mock__panel">
            <div className="oh-mock__panel-head">
              <strong>Recent Orders</strong>
            </div>
            <ul className="oh-mini-list">
              {recentOrders.map((row) => (
                <li key={row.id}>
                  <span>
                    <b>{row.customer}</b>
                    <small>
                      {row.id} · {row.status}
                    </small>
                  </span>
                  <strong>{formatPKR(row.total)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="oh-mock__panel">
            <div className="oh-mock__panel-head">
              <strong>Low Stock Products</strong>
            </div>
            <ul className="oh-mini-list">
              {lowStock.map((row) => (
                <li key={row.name}>
                  <span>
                    <b>{row.name}</b>
                    <small>
                      {row.warehouse} · Reorder {row.reorder}
                    </small>
                  </span>
                  <strong>{row.qty}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="oh-mock__panel">
            <div className="oh-mock__panel-head">
              <strong>Recent Payments</strong>
            </div>
            <ul className="oh-mini-list">
              {recentPayments.map((row) => (
                <li key={`${row.party}-${row.amount}`}>
                  <span>
                    <b>{row.party}</b>
                    <small>{row.type}</small>
                  </span>
                  <strong>{formatPKR(row.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
