import moment from 'moment';
import TablePagination from '../../TablePagination.jsx';
import { fmtMoney, balancePositionLabel } from '../ledgerUtils.js';

function formatOrderNo(row) {
  if (row?.linkedRefs?.length) return row.linkedRefs.join(', ');
  return '';
}

function formatLineDate(row) {
  if (!row?.date) return '';
  const m = moment(row.date);
  return m.isValid() ? m.format('DD MMM YYYY · hh:mm A') : '';
}

function TxnCard({ row, type, onClick }) {
  const orderNo = formatOrderNo(row);
  const dateStr = formatLineDate(row);
  const amount = type === 'debit' ? Number(row.debit) || 0 : Number(row.credit) || 0;
  const amtClass = type === 'debit' ? 'tacct-amt--dr' : 'tacct-amt--cr';

  return (
    <button
      type="button"
      className="tacct-txn-card"
      onClick={() => onClick?.(row)}
    >
      <div className="tacct-txn-top">
        {orderNo && <span className="tacct-txn-ref">{orderNo}</span>}
        <span className={`tacct-txn-amount ${amtClass}`}>{fmtMoney(amount)}</span>
      </div>
      <div className="tacct-txn-desc">{row.description || '—'}</div>
      {dateStr && <div className="tacct-txn-date">{dateStr}</div>}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div className="tacct-skeleton">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="tacct-txn-card placeholder-glow">
          <div className="d-flex justify-content-between mb-2">
            <span className="placeholder col-4 rounded" style={{ height: '0.7rem' }} />
            <span className="placeholder col-3 rounded" style={{ height: '0.7rem' }} />
          </div>
          <span className="placeholder col-8 rounded" style={{ height: '0.6rem' }} />
        </div>
      ))}
    </div>
  );
}

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

  const debitLines = slice.filter((r) => Number(r.debit) > 0);
  const creditLines = slice.filter((r) => Number(r.credit) > 0);

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

  const balPos = balancePositionLabel(endingBalance);
  const absBalance = Math.abs(Number(endingBalance) || 0);
  const balColorClass =
    balPos === 'Settled' ? 'tacct-bal--settled' : balPos === 'Receivable' ? 'tacct-bal--recv' : 'tacct-bal--pay';

  return (
    <div className="tacct-wrapper">
      {/* Header */}
      <div className="tacct-header">
        <div className="tacct-header-left">
          <div className="tacct-icon">
            <i className="ni ni-books" aria-hidden />
          </div>
          <div>
            <span className="tacct-kicker">Ledger Transactions</span>
            <h5 className="tacct-title">{accountTitle}</h5>
          </div>
        </div>
        <div className="tacct-header-right">
          {!loading && (
            <span className="tacct-count-badge">
              {rows.length} transaction{rows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="tacct-body-grid">
          <div className="tacct-col">
            <div className="tacct-col-header tacct-col-header--dr">
              <span>Debit</span>
            </div>
            <SkeletonRows />
          </div>
          <div className="tacct-col">
            <div className="tacct-col-header tacct-col-header--cr">
              <span>Credit</span>
            </div>
            <SkeletonRows />
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="tacct-empty">
          <i className="ni ni-single-copy-04 tacct-empty-icon" />
          <p className="tacct-empty-title">No transactions</p>
          <p className="tacct-empty-sub">Post entries to fill this T-account.</p>
        </div>
      ) : (
        <>
          {/* Debit / Credit columns */}
          <div className="tacct-body-grid">
            <div className="tacct-col">
              <div className="tacct-col-header tacct-col-header--dr">
                <span>Debit</span>
                <span className="tacct-col-total">{fmtMoney(totalDebit)}</span>
              </div>
              <div className="tacct-col-body">
                {debitLines.length === 0 ? (
                  <div className="tacct-col-empty">No debit entries</div>
                ) : (
                  debitLines.map((r) => (
                    <TxnCard key={r.id} row={r} type="debit" onClick={onRowClick} />
                  ))
                )}
              </div>
              <div className="tacct-col-footer tacct-col-footer--dr">
                <span>{debitLines.length} entr{debitLines.length !== 1 ? 'ies' : 'y'}</span>
              </div>
            </div>

            <div className="tacct-col">
              <div className="tacct-col-header tacct-col-header--cr">
                <span>Credit</span>
                <span className="tacct-col-total">{fmtMoney(totalCredit)}</span>
              </div>
              <div className="tacct-col-body">
                {creditLines.length === 0 ? (
                  <div className="tacct-col-empty">No credit entries</div>
                ) : (
                  creditLines.map((r) => (
                    <TxnCard key={r.id} row={r} type="credit" onClick={onRowClick} />
                  ))
                )}
              </div>
              <div className="tacct-col-footer tacct-col-footer--cr">
                <span>{creditLines.length} entr{creditLines.length !== 1 ? 'ies' : 'y'}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="tacct-summary">
            <div className="tacct-summary-card tacct-summary-card--dr">
              <span className="tacct-summary-label">Total Debit</span>
              <span className="tacct-summary-value tacct-amt--dr">{fmtMoney(totalDebit)}</span>
            </div>
            <div className="tacct-summary-card tacct-summary-card--cr">
              <span className="tacct-summary-label">Total Credit</span>
              <span className="tacct-summary-value tacct-amt--cr">{fmtMoney(totalCredit)}</span>
            </div>
            <div className={`tacct-summary-card tacct-summary-card--bal ${balColorClass}`}>
              <span className="tacct-summary-label">
                {balPos === 'Settled' ? 'Balance' : `Outstanding ${balPos}`}
              </span>
              <span className="tacct-summary-value">{fmtMoney(absBalance)}</span>
              <span className="tacct-summary-badge">{balPos}</span>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {!loading && rows.length > 0 && (
        <TablePagination
          className="tacct-pager"
          selectId="ledger-t-account-page-size"
          pagination={pagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
