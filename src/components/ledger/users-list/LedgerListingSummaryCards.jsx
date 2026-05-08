import { fmtMoney } from '../ledgerUtils.js';

function MiniStatCard({ title, value, subtitle, iconClass, gradient, shadow }) {
  return (
    <div className="col-xl-2 col-lg-4 col-md-6 col-12">
      <div className="card border-0 shadow-sm mb-4 ledger-summary-card h-100">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">{title}</p>
              <h5 className="font-weight-bolder mb-0 text-dark">{value}</h5>
              {subtitle ? <p className="text-xxs text-muted mb-0 mt-1">{subtitle}</p> : null}
            </div>
            <div className={`icon icon-shape ${gradient} ${shadow} text-center border-radius-md shadow`}>
              <i className={`${iconClass} text-lg text-white opacity-10`} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LedgerListingSummaryCards({
  totalUsers,
  totalReceivables,
  totalPayables,
  todayTransactions,
  activeLedgers,
  overdueBalances,
}) {
  return (
    <div className="row">
      <MiniStatCard
        title="Total users"
        value={String(totalUsers)}
        subtitle="Ledger accounts"
        iconClass="ni ni-single-02"
        gradient="bg-gradient-dark"
        shadow="shadow-dark"
      />
      <MiniStatCard
        title="Total receivables"
        value={fmtMoney(totalReceivables)}
        subtitle="Positive balances"
        iconClass="ni ni-money-coins"
        gradient="bg-gradient-success"
        shadow="shadow-success"
      />
      <MiniStatCard
        title="Total payables"
        value={fmtMoney(totalPayables)}
        subtitle="Owed outward"
        iconClass="ni ni-credit-card"
        gradient="bg-gradient-danger"
        shadow="shadow-danger"
      />
      <MiniStatCard
        title="Today transactions"
        value={String(todayTransactions)}
        subtitle="All ledgers (demo)"
        iconClass="ni ni-chart-bar-32"
        gradient="bg-gradient-info"
        shadow="shadow-info"
      />
      <MiniStatCard
        title="Active ledgers"
        value={String(activeLedgers)}
        subtitle="Status active"
        iconClass="ni ni-active-40"
        gradient="bg-gradient-primary"
        shadow="shadow-primary"
      />
      <MiniStatCard
        title="Overdue balances"
        value={fmtMoney(overdueBalances)}
        subtitle="Negative exposure"
        iconClass="ni ni-time-alarm"
        gradient="bg-gradient-warning"
        shadow="shadow-warning"
      />
    </div>
  );
}
