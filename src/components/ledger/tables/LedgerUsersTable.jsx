import moment from 'moment';
import { FaEllipsisVertical } from 'react-icons/fa6';
import NavIcon from '../../NavIcon.jsx';
import SearchInputIcon from '../../SearchInputIcon.jsx';
import ListSortableTh from '../../list/ListSortableTh.jsx';
import TablePagination from '../../TablePagination.jsx';
import {
  fmtMoney,
  balanceTextClass,
  flowAmountClass,
  parseRoleLabels,
  userInitials,
  avatarTone,
} from '../ledgerUtils.js';

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Receivable', label: 'Receivable' },
  { id: 'Payable', label: 'Payable' },
];

function SkeletonRows({ cols = 9 }) {
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

function RoleChips({ role, roles }) {
  const labels = Array.isArray(roles) && roles.length ? roles : parseRoleLabels(role);
  if (!labels.length) return <span className="text-muted text-xxs">—</span>;
  return (
    <div className="ledger-role-chips">
      {labels.map((label) => (
        <span key={label} className="ledger-role-chip">
          {label}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const key = String(status || 'active').toLowerCase();
  return <span className={`ledger-status-pill ledger-status-pill--${key}`}>{key}</span>;
}

function formatLastActivity(value) {
  if (!value) return null;
  const when = moment(value);
  if (!when.isValid()) return null;
  return {
    date: when.format('DD MMM YYYY'),
    time: when.format('HH:mm'),
  };
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
  search = '',
  onSearchChange,
  totalRowCount,
  statusFilter = 'all',
  balanceTypeFilter = 'all',
  onQuickFilter,
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

  const activeQuickFilter =
    statusFilter === 'active' && balanceTypeFilter === 'all'
      ? 'Active'
      : balanceTypeFilter === 'negative'
        ? 'Receivable'
        : balanceTypeFilter === 'positive'
          ? 'Payable'
          : 'all';

  return (
    <div className="card shadow-sm ledger-users-card">
      <div className="card-header pb-3">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 w-100">
          <div className="min-w-0">
            <h5 className="mb-1">Ledger users</h5>
            <p className="text-sm text-muted mb-0">
              {loading ? 'Loading accounts…' : `${total.toLocaleString()} account${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2 ms-lg-auto">
            {typeof onQuickFilter === 'function' ? (
              <div className="ledger-filter-chips" role="tablist" aria-label="Ledger filters">
                {QUICK_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={activeQuickFilter === item.id}
                    className={`ledger-filter-chip${activeQuickFilter === item.id ? ' is-active' : ''}`}
                    onClick={() => onQuickFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            {onSearchChange ? (
              <div className="input-group input-group-sm ledger-users-search">
                <span className="input-group-text text-body">
                  <SearchInputIcon />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search name, phone, email…"
                  value={search}
                  onChange={onSearchChange}
                  aria-label="Search ledger users"
                />
              </div>
            ) : null}
          </div>
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
                    label="Last activity"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <ListSortableTh column="status" label="Status" sort={sort} onSort={handleSort} />
                  <th className="text-end ledger-users-actions-col">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonRows />
              ) : slice.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={9} className="ledger-users-empty text-center py-5">
                      <p className="font-weight-bold text-dark mb-1">No matching accounts</p>
                      <p className="text-sm text-muted mb-0">Try a different search or filter.</p>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {slice.map((u) => {
                    const tone = avatarTone(u.id || u.fullName);
                    const lastActivity = formatLastActivity(u.lastTransactionAt);
                    return (
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
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="ledger-user-avatar"
                              style={{ background: tone.bg, color: tone.color }}
                            >
                              {userInitials(u.fullName)}
                            </div>
                            <div className="min-w-0">
                              <span className="d-block text-truncate ledger-user-name">{u.fullName}</span>
                              <RoleChips role={u.role} roles={u.roles} />
                            </div>
                          </div>
                        </td>
                        <td className="text-sm">
                          <div className="text-truncate ledger-user-contact" title={u.email || ''}>
                            {u.email || '—'}
                          </div>
                          <div className="ledger-user-phone">{u.phone || '—'}</div>
                        </td>
                        <td className={`text-end ledger-money ${balanceTextClass(u.openingBalance)}`}>
                          {fmtMoney(u.openingBalance)}
                        </td>
                        <td
                          className={`text-end ledger-money font-weight-bold ${balanceTextClass(u.currentBalance)}`}
                        >
                          {fmtMoney(u.currentBalance)}
                        </td>
                        <td className={`text-end ledger-money ${flowAmountClass(u.totalDebit, 'debit')}`}>
                          {fmtMoney(u.totalDebit)}
                        </td>
                        <td className={`text-end ledger-money ${flowAmountClass(u.totalCredit, 'credit')}`}>
                          {fmtMoney(u.totalCredit)}
                        </td>
                        <td className="text-sm text-nowrap ledger-date">
                          {lastActivity ? (
                            <>
                              <span className="d-block ledger-date-day">{lastActivity.date}</span>
                              <span className="ledger-date-time">{lastActivity.time}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusPill status={u.status} />
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
                    );
                  })}
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
