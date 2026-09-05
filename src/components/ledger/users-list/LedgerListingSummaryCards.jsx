import { fmtMoney } from '../ledgerUtils.js';

function KpiItem({ label, value, hint, tone, numeric }) {
  const amount = Number(numeric);
  const toneClass = tone && Number.isFinite(amount) && amount !== 0 ? ` ledger-kpi-item--${tone}` : '';
  return (
    <div className={`ledger-kpi-item${toneClass}`}>
      <p className="ledger-kpi-label mb-0">{label}</p>
      <p className="ledger-kpi-value mb-0">{value}</p>
      {hint ? <p className="ledger-kpi-hint mb-0">{hint}</p> : null}
    </div>
  );
}

export default function LedgerListingSummaryCards({
  totalUsers,
  totalReceivables,
  totalPayables,
  activeLedgers,
}) {
  return (
    <div className="ledger-kpi-bar mb-4" role="region" aria-label="Ledger summary">
      <KpiItem label="Accounts" value={String(totalUsers ?? 0)} hint="Parties on the ledger" />
      <KpiItem
        label="Receivable"
        value={fmtMoney(totalReceivables)}
        numeric={totalReceivables}
        hint="Amount due from parties"
        tone="recv"
      />
      <KpiItem
        label="Payable"
        value={fmtMoney(totalPayables)}
        numeric={totalPayables}
        hint="Amount due to parties"
        tone="pay"
      />
      <KpiItem label="Active" value={String(activeLedgers ?? 0)} hint="Open ledger accounts" />
    </div>
  );
}
