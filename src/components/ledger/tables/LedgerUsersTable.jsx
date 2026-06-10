import moment from 'moment';
import { FaEllipsisVertical } from 'react-icons/fa6';
import NavIcon from '../../NavIcon.jsx';
import ListSortableTh from '../../list/ListSortableTh.jsx';
import TablePagination from '../../TablePagination.jsx';
import { fmtMoney, balanceTextClass } from '../ledgerUtils.js';

function SkeletonRows({ cols = 10 }) {
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
      className={`ledger-activity-dot rounded-circle d-inline-block ${colors[mode] || 'bg-secondary'}`}
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
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
  onRowNavigate,
  onAction,
  /** When set, pagination uses server total (rows are already one page). */
  totalRowCount,
}) {
  const serverPaged = typeof totalRowCount === 'number' && totalRowCount >= 0;
  const total = serverPaged ? totalRowCount : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = serverPaged ? rows : rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const sort = { sortBy: sortKey, sortOrder: sortDir };

  const handleSort = (column, forceDesc = false) => {
    if (forceDesc) {
      onSort(column, 'desc');
      return;
    }
    if (sortKey === column) onSort(column, sortDir === 'asc' ? 'desc' : 'asc');
    else onSort(column, 'asc');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) onPageChange(newPage);
  };

  const handleLimitChange = (limit) => {
    if (onPageSizeChange) onPageSizeChange(limit);
    onPageChange(1);
  };

  const pagination = {
    page: pageSafe,
    limit: pageSize,
    total,
    totalPages,
  };

  const accountLabel = `${total} account${total !== 1 ? 's' : ''}`;

  return (
    <div className="card shadow-sm ledger-users-card">
      <div className="card-header pb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 w-100">
          <div>
            <h5 className="mb-1">Ledger users</h5>
            <p className="text-sm text-muted mb-0">Accounts with balances and recent activity</p>
          </div>
          <span className="badge bg-light text-dark border text-sm fw-semibold px-3 py-2">
            {accountLabel}
          </span>
        </div>
      </div>

      <div className="card-body pt-0 px-0 pb-0">
        <div className="list-data-table ledger-users-table mx-3 mb-3">
          <div className="list-data-table-scroll">
            <table className="table align-items-center mb-0 table-ledger">
              <thead>
                <tr>
                  <ListSortableTh column="fullName" label="User" sort={sort} onSort={handleSort} />
                  <th>Contact</th>
                  <ListSortableTh
                    column="openingBalance"
                    label="Opening"
                    sort={sort}
                    onSort={handleSort}
                    className="text-end"
                  />
                  <ListSortableTh
                    column="currentBalance"
                    label="Current"
                    sort={sort}
                    onSort={handleSort}
                    className="text-end"
                  />
                  <th className="text-end">Debit</th>
                  <th className="text-end">Credit</th>
                  <ListSortableTh
                    column="lastTransactionAt"
                    label="Last tx"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <ListSortableTh column="status" label="Status" sort={sort} onSort={handleSort} />
                  <th className="text-center">Activity</th>
                  <th className="text-end ledger-users-actions-col">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonRows />
              ) : slice.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={10} className="ledger-users-empty text-center py-5">
                      <p className="font-weight-bold text-dark mb-1">No ledger users match</p>
                      <p className="text-sm text-muted mb-0">Adjust filters or search.</p>
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
                          <div className="ledger-user-avatar avatar avatar-sm rounded-circle bg-gradient-dark text-white d-flex align-items-center justify-content-center">
                            {u.fullName
                              .split(' ')
                              .map((s) => s[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-weight-bold text-sm d-block text-truncate ledger-user-name">
                              {u.fullName}
                            </span>
                            <span className="text-xxs text-muted">{u.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm">
                        <div className="text-truncate ledger-user-contact" title={u.email || ''}>
                          {u.email || '—'}
                        </div>
                        <div className="text-xxs text-muted">{u.phone || '—'}</div>
                      </td>
                      <td className={`text-end ledger-money ${balanceTextClass(u.openingBalance)}`}>
                        {fmtMoney(u.openingBalance)}
                      </td>
                      <td
                        className={`text-end ledger-money font-weight-bold ${balanceTextClass(u.currentBalance)}`}
                      >
                        {fmtMoney(u.currentBalance)}
                      </td>
                      <td className="text-end ledger-money text-danger">{fmtMoney(u.totalDebit)}</td>
                      <td className="text-end ledger-money text-success">{fmtMoney(u.totalCredit)}</td>
                      <td className="text-sm text-nowrap ledger-date">
                        {u.lastTransactionAt
                          ? moment(u.lastTransactionAt).format('DD MMM YYYY HH:mm')
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`badge text-xxs ledger-status-badge ${
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
                            className="btn btn-sm btn-outline-secondary ledger-row-action-btn mb-0"
                            type="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            aria-label={`Actions for ${u.fullName}`}
                          >
                            <NavIcon icon={FaEllipsisVertical} size={14} />
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end text-sm shadow-sm">
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
                              <button
                                type="button"
                                className="dropdown-item text-danger"
                                onClick={() => onAction('delete', u)}
                              >
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

          <TablePagination
            className="list-table-toolbar--footer"
            selectId="ledger-users-page-size"
            pagination={pagination}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            hidden={loading || total === 0}
          />
        </div>
      </div>
    </div>
  );
}
