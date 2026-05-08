import moment from 'moment';
import { fmtMoney, balanceTextClass } from '../ledgerUtils.js';

function SkeletonRows({ cols = 11 }) {
  return (
    <tbody className="placeholder-glow">
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <span className="placeholder col-12 rounded skeleton-line d-block" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function ActivityDot({ mode }) {
  const colors = {
    online: 'bg-gradient-success',
    offline: 'bg-secondary',
    recent: 'bg-gradient-warning',
  };
  const titles = { online: 'Online', offline: 'Offline', recent: 'Recent activity' };
  return (
    <span
      className={`rounded-circle d-inline-block ${colors[mode] || 'bg-secondary'}`}
      style={{ width: 10, height: 10 }}
      title={titles[mode] || ''}
    />
  );
}

export default function LedgerUsersTable({
  rows,
  loading,
  page,
  pageSize,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  onRowNavigate,
  onAction,
  /** When set, pagination uses server total (rows are already one page). */
  totalRowCount,
}) {
  const serverPaged = typeof totalRowCount === 'number' && totalRowCount >= 0;
  const totalPages = serverPaged
    ? Math.max(1, Math.ceil(totalRowCount / pageSize))
    : Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = serverPaged ? rows : rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

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
    <div className="card border-0 shadow-sm">
      <div className="card-header pb-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h6 className="mb-0">Ledger users</h6>
        <span className="text-xs text-muted">
          {serverPaged ? totalRowCount : rows.length} account{(serverPaged ? totalRowCount : rows.length) !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="card-body px-0 pt-2 pb-3">
        <div className="table-responsive">
          <table className="table table-flush table-hover table-sm align-middle mb-0 table-ledger">
            <thead className="thead-light">
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('fullName')}>
                  User {icon('fullName')}
                </th>
                <th>Contact</th>
                <th className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('openingBalance')}>
                  Opening {icon('openingBalance')}
                </th>
                <th className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('currentBalance')}>
                  Current {icon('currentBalance')}
                </th>
                <th className="text-end">Debit</th>
                <th className="text-end">Credit</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('lastTransactionAt')}>
                  Last tx {icon('lastTransactionAt')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                  Status {icon('status')}
                </th>
                <th className="text-center">Activity</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonRows />
            ) : slice.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="text-center py-5 text-muted">
                    <i className="ni ni-folder-17 text-lg opacity-3 d-block mb-2" style={{ fontSize: '2.5rem' }} />
                    <p className="font-weight-bold mb-1">No ledger users match</p>
                    <p className="text-sm mb-0">Adjust filters or search.</p>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {slice.map((u) => (
                  <tr
                    key={u.id}
                    className="ledger-data-row"
                    role="link"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onRowNavigate(u.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowNavigate(u.id);
                      }
                    }}
                  >
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar avatar-sm rounded-circle bg-gradient-dark text-white d-flex align-items-center justify-content-center">
                          {u.fullName
                            .split(' ')
                            .map((s) => s[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-weight-bold text-sm d-block text-truncate" style={{ maxWidth: 180 }}>
                            {u.fullName}
                          </span>
                          <span className="text-xxs text-muted">{u.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">
                      <div className="text-truncate" style={{ maxWidth: 160 }} title={u.email || ''}>
                        {u.email || '—'}
                      </div>
                      <div className="text-xxs text-muted">{u.phone || '—'}</div>
                    </td>
                    <td className={`text-end text-sm ${balanceTextClass(u.openingBalance)}`}>
                      {fmtMoney(u.openingBalance)}
                    </td>
                    <td className={`text-end text-sm font-weight-bold ${balanceTextClass(u.currentBalance)}`}>
                      {fmtMoney(u.currentBalance)}
                    </td>
                    <td className="text-end text-sm text-danger">{fmtMoney(u.totalDebit)}</td>
                    <td className="text-end text-sm text-success">{fmtMoney(u.totalCredit)}</td>
                    <td className="text-sm text-nowrap">
                      {u.lastTransactionAt ? moment(u.lastTransactionAt).format('DD MMM YYYY HH:mm') : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge text-xxs ${
                          u.status === 'active'
                            ? 'bg-gradient-success'
                            : u.status === 'inactive'
                              ? 'bg-gradient-secondary'
                              : 'bg-gradient-warning'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <ActivityDot mode={u.activityIndicator} />
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown">
                        <button
                          className="btn btn-link text-secondary p-0 mb-0"
                          type="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i className="fas fa-ellipsis-v" />
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end text-sm">
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => onAction('view', u)}>
                              View ledger
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => onAction('tx', u)}>
                              Add transaction
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => onAction('remind', u)}>
                              Send reminder
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => onAction('pdf', u)}>
                              Export PDF
                            </button>
                          </li>
                          <li>
                            <hr className="dropdown-divider" />
                          </li>
                          <li>
                            <button type="button" className="dropdown-item" onClick={() => onAction('edit', u)}>
                              Edit user
                            </button>
                          </li>
                          <li>
                            <button type="button" className="dropdown-item text-danger" onClick={() => onAction('delete', u)}>
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
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
                  <button
                    type="button"
                    className="page-link"
                    disabled={pageSafe >= totalPages}
                    onClick={() => onPageChange(pageSafe + 1)}
                  >
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
