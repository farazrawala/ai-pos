import {
  FaCartShopping,
  FaCoins,
  FaFileInvoice,
  FaGlobe,
} from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useCurrentMonthSales } from '../../hooks/useCurrentMonthSales.js';
import { useTodaySales } from '../../hooks/useTodaySales.js';
import { useTotalCustomers } from '../../hooks/useTotalCustomers.js';
import { useTotalUsers } from '../../hooks/useTotalUsers.js';
import { useDashboardGraphs } from '../../hooks/useDashboardGraphs.js';
import { DASHBOARD_STAT_KEYS } from '../../constants/dashboardGraphs.js';

function StatCard({ title, value, footer, icon: Icon, iconClass }) {
  return (
    <div className="col-lg-3 col-md-6 col-12">
      <div className="card mb-4">
        <div className="card-body p-3">
          <div className="row">
            <div className="col-8">
              <div className="numbers">
                <p className="text-sm mb-0 text-uppercase font-weight-bold">{title}</p>
                <h5 className="font-weight-bolder">{value}</h5>
                <p className="mb-0">{footer}</p>
              </div>
            </div>
            <div className="col-4 text-end">
              <div
                className={`icon icon-shape ${iconClass} text-center rounded-circle d-flex align-items-center justify-content-center`}
              >
                <NavIcon icon={Icon} className="text-white opacity-10" size={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendFooter({ loading, error, percent, positiveLabel, negativeLabel, fallback }) {
  if (loading) {
    return <span className="text-secondary text-sm">Loading…</span>;
  }
  if (error) {
    return <span className="text-danger text-sm">{error}</span>;
  }
  if (percent != null) {
    return (
      <>
        <span
          className={`text-sm font-weight-bolder ${percent >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {percent >= 0 ? '+' : ''}
          {Math.round(percent)}%
        </span>{' '}
        {percent >= 0 ? positiveLabel : negativeLabel}
      </>
    );
  }
  return <span className="text-secondary text-sm">{fallback}</span>;
}

function TodaysMoneyCard() {
  const { loading, todayAmount, dodPercent, orderCount, error } = useTodaySales();
  return (
    <StatCard
      title="Today's Money"
      value={loading || error ? '—' : formatCurrency(todayAmount ?? 0)}
      icon={FaCoins}
      iconClass="bg-gradient-primary shadow-primary"
      footer={
        <TrendFooter
          loading={loading}
          error={error}
          percent={dodPercent}
          positiveLabel="since yesterday"
          negativeLabel="since yesterday"
          fallback={`${orderCount ?? 0} order${(orderCount ?? 0) === 1 ? '' : 's'} today`}
        />
      }
    />
  );
}

function TodaysUsersCard() {
  const { loading, userCount, error } = useTotalUsers();
  return (
    <StatCard
      title="Today's Users"
      value={loading || error ? '—' : (userCount ?? 0).toLocaleString()}
      icon={FaGlobe}
      iconClass="bg-gradient-danger shadow-danger"
      footer={
        loading ? (
          <span className="text-secondary text-sm">Loading…</span>
        ) : error ? (
          <span className="text-danger text-sm">{error}</span>
        ) : (
          <span className="text-secondary text-sm">with User role</span>
        )
      }
    />
  );
}

function TotalCustomersCard() {
  const { loading, customerCount, error } = useTotalCustomers();
  return (
    <StatCard
      title="Total Customers"
      value={loading || error ? '—' : (customerCount ?? 0).toLocaleString()}
      icon={FaFileInvoice}
      iconClass="bg-gradient-success shadow-success"
      footer={
        loading ? (
          <span className="text-secondary text-sm">Loading…</span>
        ) : error ? (
          <span className="text-danger text-sm">{error}</span>
        ) : (
          <span className="text-secondary text-sm">total customers</span>
        )
      }
    />
  );
}

function SalesCard() {
  const { loading, totalAmount, orderCount, momPercent, error } = useCurrentMonthSales();
  return (
    <StatCard
      title="Sales"
      value={loading || error ? '—' : formatCurrency(totalAmount ?? 0)}
      icon={FaCartShopping}
      iconClass="bg-gradient-warning shadow-warning"
      footer={
        <TrendFooter
          loading={loading}
          error={error}
          percent={momPercent}
          positiveLabel="than last month"
          negativeLabel="than last month"
          fallback={`${orderCount ?? 0} order${(orderCount ?? 0) === 1 ? '' : 's'} this month`}
        />
      }
    />
  );
}

export default function PosDashboardStatCards() {
  const { canShow, hasAny } = useDashboardGraphs();

  if (!hasAny(DASHBOARD_STAT_KEYS)) {
    return null;
  }

  return (
    <div className="row">
      <div className="col-lg-12">
        <div className="row">
          {canShow('todays_money') ? <TodaysMoneyCard /> : null}
          {canShow('todays_users') ? <TodaysUsersCard /> : null}
          {canShow('total_customers') ? <TotalCustomersCard /> : null}
          {canShow('sales') ? <SalesCard /> : null}
        </div>
      </div>
    </div>
  );
}
