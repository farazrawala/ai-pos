import { fmtMoney, balanceTextClass } from '../ledgerUtils.js';

function Card({ title, value, valueClassName, sub, icon, gradient, shadow }) {
  return (
    <div className="col">
      <div className="card shadow-sm mb-4 ledger-summary-card ledger-detail-stat-card h-100">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="flex-grow-1 min-w-0">
              <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">{title}</p>
              <h4 className={`font-weight-bolder mb-0 ${valueClassName || 'text-dark'}`}>{value}</h4>
              {sub ? <p className="text-xxs text-muted mb-0 mt-2">{sub}</p> : null}
            </div>
            <div className={`icon icon-shape ${gradient} ${shadow} text-center border-radius-md shadow flex-shrink-0`}>
              <i className={`${icon} text-lg text-white opacity-10`} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LedgerDetailSummaryCards({
  openingBalance,
  currentBalance,
  totalDebit,
  totalCredit,
  monthlyActivityNet,
  pendingAmount,
}) {
  return (
    <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-6 g-2 g-xl-3">
      <Card
        title="Opening balance"
        value={fmtMoney(openingBalance)}
        valueClassName={balanceTextClass(openingBalance)}
        icon="ni ni-money-coins"
        gradient="bg-gradient-secondary"
        shadow="shadow-secondary"
      />
      <Card
        title="Current balance"
        value={fmtMoney(currentBalance)}
        valueClassName={balanceTextClass(currentBalance)}
        sub={currentBalance >= 0 ? 'Receivable position' : 'Payable position'}
        icon="ni ni-chart-bar-32"
        gradient="bg-gradient-primary"
        shadow="shadow-primary"
      />
      <Card
        title="Total debit"
        value={fmtMoney(totalDebit)}
        icon="ni ni-fat-remove"
        gradient="bg-gradient-danger"
        shadow="shadow-danger"
      />
      <Card
        title="Total credit"
        value={fmtMoney(totalCredit)}
        icon="ni ni-fat-add"
        gradient="bg-gradient-success"
        shadow="shadow-success"
      />
      <Card
        title="Monthly activity (net)"
        value={fmtMoney(monthlyActivityNet)}
        valueClassName={balanceTextClass(monthlyActivityNet)}
        sub="This calendar month"
        icon="ni ni-chart-pie-35"
        gradient="bg-gradient-info"
        shadow="shadow-info"
      />
      <Card
        title="Pending amount"
        value={fmtMoney(pendingAmount)}
        valueClassName={pendingAmount > 0 ? 'text-warning' : 'text-dark'}
        sub="Unsettled / in-flight"
        icon="ni ni-time-alarm"
        gradient="bg-gradient-warning"
        shadow="shadow-warning"
      />
    </div>
  );
}
