import { fmtMoney } from '../ledgerUtils.js';

function SkeletonClassic() {
  return (
    <div className="ledger-t-classic-body">
      <div className="ledger-t-classic-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`sd-${i}`} className="ledger-t-classic-row placeholder-glow py-2 px-2">
            <span className="placeholder col-7 rounded" style={{ height: '0.8rem' }} />
            <span className="placeholder col-3 rounded" style={{ height: '0.8rem' }} />
          </div>
        ))}
      </div>
      <div className="ledger-t-classic-spine" aria-hidden />
      <div className="ledger-t-classic-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`sc-${i}`} className="ledger-t-classic-row placeholder-glow py-2 px-2">
            <span className="placeholder col-7 rounded" style={{ height: '0.8rem' }} />
            <span className="placeholder col-3 rounded" style={{ height: '0.8rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Classic T-account layout (reference: textbook cash ledger).
 * Debit left · Credit right · Totals and balance in footer.
 */
export default function LedgerTAccountView({
  accountTitle,
  rows,
  loading = false,
  page,
  pageSize,
  onPageChange,
  totalDebit,
  totalCredit,
  endingBalance,
  onRowClick,
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const debitLines = slice
    .filter((r) => Number(r.debit) > 0)
    .map((r) => ({
      key: r.id,
      row: r,
      label: r.description || '—',
      amount: Number(r.debit) || 0,
    }));

  const creditLines = slice
    .filter((r) => Number(r.credit) > 0)
    .map((r) => ({
      key: r.id,
      row: r,
      label: r.description || '—',
      amount: Number(r.credit) || 0,
    }));

  const bodyRows = Math.max(debitLines.length, creditLines.length, 1);
  const debitPadded = [...debitLines];
  const creditPadded = [...creditLines];
  while (debitPadded.length < bodyRows) debitPadded.push(null);
  while (creditPadded.length < bodyRows) creditPadded.push(null);

  const from = rows.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const to = Math.min(pageSafe * pageSize, rows.length);

  return (
    <div className="card border-0 shadow-sm rounded-3 ledger-transactions-card ledger-t-classic w-100 overflow-hidden">
      <div className="ledger-t-classic-accent" aria-hidden />
      <div className="ledger-t-classic-card-inner">
        <header className="ledger-t-classic-header">
          <div className="ledger-t-classic-header-main">
            <div className="ledger-t-classic-icon-wrap shadow-primary">
              <i className="ni ni-books text-white" aria-hidden />
            </div>
            <div className="ledger-t-classic-heading-text">
              <span className="ledger-t-classic-kicker text-uppercase">Ledger transactions</span>
              <h6 className="ledger-t-classic-title mb-0">{accountTitle}</h6>
              <p className="ledger-t-classic-meta mb-0">
                {loading ? (
                  <span className="text-muted">Loading activity…</span>
                ) : (
                  <>
                    <span className="ledger-t-classic-stat-pill">
                      {rows.length} line{rows.length !== 1 ? 's' : ''}
                    </span>
                    {rows.length > 0 ? (
                      <span className="ms-2 text-muted">Rows {from}–{to}</span>
                    ) : null}
                  </>
                )}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <SkeletonClassic />
        ) : rows.length === 0 ? (
          <div className="ledger-t-classic-empty text-center py-5 px-3">
            <div className="ledger-t-classic-empty-icon mx-auto mb-3">
              <i className="ni ni-single-copy-04 text-primary" />
            </div>
            <p className="mb-1 font-weight-bold text-sm text-dark">No transactions</p>
            <p className="text-xs text-muted mb-0 mx-auto" style={{ maxWidth: '260px' }}>
              Use filters above or post entries to fill this T-account.
            </p>
          </div>
        ) : (
          <>
            <div className="ledger-t-classic-body">
              <div className="ledger-t-classic-col ledger-t-classic-col--dr">
                <div className="ledger-t-classic-band">
                  <span className="badge rounded-pill bg-gradient-danger text-white text-xxs font-weight-bold px-2 py-1">
                    Debit
                  </span>
                </div>
                {debitPadded.map((line, idx) =>
                  line ? (
                    <button
                      key={line.key}
                      type="button"
                      className="ledger-t-classic-row ledger-t-classic-row--click"
                      onClick={() => onRowClick?.(line.row)}
                    >
                      <span className="ledger-t-classic-desc">{line.label}</span>
                      <span className="ledger-t-classic-amt ledger-t-classic-amt--dr">{fmtMoney(line.amount)}</span>
                    </button>
                  ) : (
                    <div key={`ed-${idx}`} className="ledger-t-classic-row ledger-t-classic-row--blank" aria-hidden />
                  )
                )}
              </div>
              <div className="ledger-t-classic-spine" role="separator" aria-orientation="vertical" />
              <div className="ledger-t-classic-col ledger-t-classic-col--cr">
                <div className="ledger-t-classic-band">
                  <span className="badge rounded-pill bg-gradient-success text-white text-xxs font-weight-bold px-2 py-1">
                    Credit
                  </span>
                </div>
                {creditPadded.map((line, idx) =>
                  line ? (
                    <button
                      key={line.key}
                      type="button"
                      className="ledger-t-classic-row ledger-t-classic-row--click"
                      onClick={() => onRowClick?.(line.row)}
                    >
                      <span className="ledger-t-classic-desc">{line.label}</span>
                      <span className="ledger-t-classic-amt ledger-t-classic-amt--cr">{fmtMoney(line.amount)}</span>
                    </button>
                  ) : (
                    <div key={`ec-${idx}`} className="ledger-t-classic-row ledger-t-classic-row--blank" aria-hidden />
                  )
                )}
              </div>
            </div>

            <footer className="ledger-t-classic-footer">
              <div className="ledger-t-classic-footer-panel shadow-sm">
                <div className="ledger-t-classic-footer-grid">
                  <div className="ledger-t-classic-footer-side">
                    <div className="ledger-t-classic-hr" />
                    <div className="ledger-t-classic-total">
                      <span className="text-muted font-weight-600">Total debits</span>
                      <span className="ledger-t-classic-amt ledger-t-classic-amt--dr">{fmtMoney(totalDebit)}</span>
                    </div>
                    <div className="ledger-t-classic-total ledger-t-classic-total--less">
                      <span className="text-muted">Less: Total credits</span>
                      <span className="ledger-t-classic-amt text-dark">{fmtMoney(totalCredit)}</span>
                    </div>
                    <div className="ledger-t-classic-hr" />
                    <div className="ledger-t-classic-balance">
                      <span className="ledger-t-classic-balance-label">Balance</span>
                      <span className="ledger-t-classic-balance-pill">{fmtMoney(endingBalance)}</span>
                    </div>
                  </div>
                  <div className="ledger-t-classic-spine ledger-t-classic-spine--foot" aria-hidden />
                  <div className="ledger-t-classic-footer-side">
                    <div className="ledger-t-classic-hr" />
                    <div className="ledger-t-classic-total">
                      <span className="text-muted font-weight-600">Total credits</span>
                      <span className="ledger-t-classic-amt ledger-t-classic-amt--cr">{fmtMoney(totalCredit)}</span>
                    </div>
                    <div className="ledger-t-classic-footer-spacer" />
                  </div>
                </div>
              </div>
            </footer>
          </>
        )}

        {!loading && rows.length > 0 ? (
          <div className="ledger-t-classic-pager d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="text-xs text-muted">
              Page <span className="text-dark font-weight-600">{pageSafe}</span> of{' '}
              <span className="text-dark font-weight-600">{totalPages}</span>
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary mb-0"
                disabled={pageSafe <= 1}
                onClick={() => onPageChange(pageSafe - 1)}
              >
                <i className="ni ni-bold-left me-1" />
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary mb-0"
                disabled={pageSafe >= totalPages}
                onClick={() => onPageChange(pageSafe + 1)}
              >
                Next
                <i className="ni ni-bold-right ms-1" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
