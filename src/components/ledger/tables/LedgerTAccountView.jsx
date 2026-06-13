import moment from 'moment';
import TablePagination from '../../TablePagination.jsx';
import { fmtMoney } from '../ledgerUtils.js';

function formatOrderNo(row) {
  if (row?.linkedRefs?.length) return row.linkedRefs.join(', ');
  return '';
}

function formatLineDate(row) {
  if (!row?.date) return '';
  const m = moment(row.date);
  return m.isValid() ? m.format('DD MMM YYYY') : '';
}

function TAccountLineContent({ row }) {
  const orderNo = formatOrderNo(row);
  const dateStr = formatLineDate(row);

  return (
    <div className="ledger-t-classic-line-main">
      {(orderNo || dateStr) && (
        <div className="ledger-t-classic-line-meta">
          {orderNo ? <span className="ledger-t-classic-meta-value">{orderNo}</span> : null}
          {orderNo && dateStr ? <span className="ledger-t-classic-meta-sep" aria-hidden>·</span> : null}
          {dateStr ? <span className="ledger-t-classic-meta-value">{dateStr}</span> : null}
        </div>
      )}
      <span className="ledger-t-classic-desc">{row.description || '—'}</span>
    </div>
  );
}

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
  onPageSizeChange,
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

  const pagination = {
    page: pageSafe,
    limit: pageSize,
    total: rows.length,
    totalPages,
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) onPageChange(newPage);
  };

  const handleLimitChange = (limit) => {
    if (onPageSizeChange) onPageSizeChange(limit);
    onPageChange(1);
  };

  return (
    <div className="card shadow-sm ledger-transactions-card ledger-t-classic ledger-t-classic--detail w-100 overflow-hidden">
      <div className="ledger-t-classic-accent" aria-hidden />
      <div className="ledger-t-classic-card-inner">
        <header className="ledger-t-classic-header">
          <div className="ledger-t-classic-header-main">
            <div className="ledger-t-classic-icon-wrap shadow-primary">
              <i className="ni ni-books text-white" aria-hidden />
            </div>
            <div className="ledger-t-classic-heading-text">
              <span className="ledger-t-classic-kicker text-uppercase">Ledger transactions</span>
              <h5 className="ledger-t-classic-title mb-0">{accountTitle}</h5>
              <p className="ledger-t-classic-meta mb-0">
                {loading ? (
                  <span className="text-muted">Loading activity…</span>
                ) : (
                  <span className="ledger-t-classic-stat-pill">
                    {rows.length} line{rows.length !== 1 ? 's' : ''}
                  </span>
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
                      className="ledger-t-classic-row ledger-t-classic-row--click ledger-t-classic-row--rich"
                      onClick={() => onRowClick?.(line.row)}
                    >
                      <TAccountLineContent row={line.row} />
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
                      className="ledger-t-classic-row ledger-t-classic-row--click ledger-t-classic-row--rich"
                      onClick={() => onRowClick?.(line.row)}
                    >
                      <TAccountLineContent row={line.row} />
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

      </div>

      {!loading && rows.length > 0 ? (
        <TablePagination
          className="list-table-toolbar--footer ledger-t-classic-pager"
          selectId="ledger-t-account-page-size"
          pagination={pagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      ) : null}
    </div>
  );
}
