import { Fragment } from 'react';
import moment from 'moment';
import { fmtMoney, balanceTextClass } from '../ledgerUtils.js';

function Skeleton({ cols = 12 }) {
  return (
    <tbody className="placeholder-glow">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <span className="placeholder col-12 rounded d-block" style={{ height: '0.85rem' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default function LedgerTransactionsTable({
  rows,
  loading,
  page,
  pageSize,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  expandedIds,
  onToggleExpand,
  onRowOpenDrawer,
  onAction,
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) onSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    else onSort(key, 'asc');
  };

  const icon = (key) =>
    sortKey !== key ? (
      <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.65rem' }} />
    ) : sortDir === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.65rem' }} />
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.65rem' }} />
    );

  return (
    <div className="card border-0 shadow-sm ledger-transactions-card w-100">
      <div className="card-header pb-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h6 className="mb-0">Ledger transactions</h6>
        <span className="text-xs text-muted">{rows.length} line{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="card-body px-0 pt-2 pb-3">
        <div className="table-responsive">
          <table className="table table-flush table-hover table-sm align-middle mb-0 table-ledger">
            <thead className="thead-light">
              <tr>
                <th className="text-muted" style={{ width: 36 }} />
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                  Date {icon('date')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('referenceNo')}>
                  Reference {icon('referenceNo')}
                </th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th className="text-end">Debit</th>
                <th className="text-end">Credit</th>
                <th className="text-end">Running bal.</th>
                <th>Payment</th>
                <th>Created by</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <Skeleton />
            ) : slice.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={13} className="text-center py-5 text-muted">
                    <p className="font-weight-bold mb-1">No transactions</p>
                    <p className="text-sm mb-0">Change filters or add an entry.</p>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {slice.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      key={row.id}
                      className="ledger-data-row"
                      onClick={() => onRowOpenDrawer(row)}
                      role="button"
                      style={{ cursor: 'pointer' }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-link text-secondary p-0 mb-0"
                          aria-expanded={expandedIds.has(row.id)}
                          onClick={() => onToggleExpand(row.id)}
                        >
                          <i className={`fas fa-chevron-${expandedIds.has(row.id) ? 'down' : 'right'} fa-xs`} />
                        </button>
                      </td>
                      <td className="text-sm text-nowrap">{moment(row.date).format('DD MMM YYYY HH:mm')}</td>
                      <td className="text-sm font-weight-bold text-primary">{row.referenceNo}</td>
                      <td className="text-sm" style={{ maxWidth: 200 }}>
                        <span className="d-inline-block text-truncate w-100" title={row.description}>
                          {row.description}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{row.category || '—'}</td>
                      <td className="text-sm">
                        {row.type === 'debit' ? (
                          <span className="badge bg-gradient-danger">Debit</span>
                        ) : (
                          <span className="badge bg-gradient-success">Credit</span>
                        )}
                      </td>
                      <td className="text-end text-sm text-danger">{row.debit ? fmtMoney(row.debit) : '—'}</td>
                      <td className="text-end text-sm text-success">{row.credit ? fmtMoney(row.credit) : '—'}</td>
                      <td className={`text-end text-sm font-weight-bold ${balanceTextClass(row.runningBalance)}`}>
                        {fmtMoney(row.runningBalance)}
                      </td>
                      <td className="text-xs">{row.paymentMethod || '—'}</td>
                      <td className="text-sm">{row.createdBy}</td>
                      <td>
                        <span
                          className={`badge text-xxs ${
                            row.status === 'posted'
                              ? 'bg-gradient-success'
                              : row.status === 'pending'
                                ? 'bg-gradient-warning'
                                : 'bg-gradient-secondary'
                          }`}
                        >
                          {row.status || '—'}
                        </span>
                      </td>
                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown">
                          <button className="btn btn-link text-secondary p-0 mb-0" type="button" data-bs-toggle="dropdown">
                            <i className="fas fa-ellipsis-v" />
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end text-sm">
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => onAction('view', row)}>
                                View
                              </button>
                            </li>
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => onAction('edit', row)}>
                                Edit
                              </button>
                            </li>
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => onAction('delete', row)}>
                                Delete
                              </button>
                            </li>
                            <li>
                              <hr className="dropdown-divider" />
                            </li>
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => onAction('print', row)}>
                                Print voucher
                              </button>
                            </li>
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => onAction('receipt', row)}>
                                Download receipt
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                    {expandedIds.has(row.id) ? (
                      <tr key={`${row.id}-ex`} className="ledger-expand-row bg-light">
                        <td colSpan={13} className="py-3 px-4">
                          <div className="row text-sm">
                            <div className="col-md-6">
                              <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">Notes</p>
                              <p className="mb-2">{row.notes || '—'}</p>
                              <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">Accounts</p>
                              <p className="mb-0">
                                Dr <strong>{row.debitAccount || '—'}</strong> · Cr{' '}
                                <strong>{row.creditAccount || '—'}</strong>
                              </p>
                            </div>
                            <div className="col-md-6">
                              <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">Linked</p>
                              <p className="mb-0">
                                {(row.linkedRefs && row.linkedRefs.length ? row.linkedRefs.join(', ') : '—')}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {!loading && rows.length > 0 ? (
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 flex-wrap gap-2">
            <span className="text-xs text-muted">
              Page {pageSafe} / {totalPages}
            </span>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${pageSafe <= 1 ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" disabled={pageSafe <= 1} onClick={() => onPageChange(pageSafe - 1)}>
                    Prev
                  </button>
                </li>
                <li className={`page-item ${pageSafe >= totalPages ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" disabled={pageSafe >= totalPages} onClick={() => onPageChange(pageSafe + 1)}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  );
}
