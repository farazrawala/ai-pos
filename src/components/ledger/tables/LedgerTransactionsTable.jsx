import { Fragment } from 'react';
import moment from 'moment';
import { FaChevronDown, FaChevronRight, FaEllipsisVertical } from 'react-icons/fa6';
import NavIcon from '../../NavIcon.jsx';
import ListSortableTh from '../../list/ListSortableTh.jsx';
import TablePagination from '../../TablePagination.jsx';
import { fmtMoney, balanceTextClass, formatLedgerLinkRef } from '../ledgerUtils.js';

function Skeleton({ cols = 14 }) {
  return (
    <tbody className="placeholder-glow">
      {Array.from({ length: 6 }).map((_, i) => (
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

export default function LedgerTransactionsTable({
  rows,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
  expandedIds,
  onToggleExpand,
  onRowOpenDrawer,
  onAction,
}) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const slice = rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

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

  return (
    <div className="card shadow-sm ledger-detail-transactions-card">
      <div className="card-header pb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 w-100">
          <div>
            <h5 className="mb-1">Transactions</h5>
            <p className="text-sm text-muted mb-0">
              {loading ? 'Loading…' : `${total} line${total !== 1 ? 's' : ''} in this view`}
            </p>
          </div>
          <span className="badge bg-light text-dark border text-sm fw-semibold px-3 py-2">
            Ledger lines
          </span>
        </div>
      </div>

      <div className="card-body pt-0 px-0 pb-0">
        <div className="list-data-table ledger-detail-transactions-table mx-3 mb-3">
          <div className="list-data-table-scroll">
            <table className="table align-items-center mb-0 table-ledger">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 40 }} />
                  <th>Order no</th>
                  <ListSortableTh column="date" label="Date" sort={sort} onSort={handleSort} />
                  <ListSortableTh column="referenceNo" label="Reference" sort={sort} onSort={handleSort} />
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="text-end">Debit</th>
                  <th className="text-end">Credit</th>
                  <th className="text-end">Balance</th>
                  <th>Payment</th>
                  <th>Created by</th>
                  <th>Status</th>
                  <th className="text-end ledger-users-actions-col">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <Skeleton />
              ) : slice.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={14} className="ledger-users-empty text-center py-5">
                      <p className="font-weight-bold text-dark mb-1">No transactions</p>
                      <p className="text-sm text-muted mb-0">Change filters or add an entry.</p>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {slice.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className="ledger-data-row"
                        onClick={() => onRowOpenDrawer(row)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowOpenDrawer(row);
                          }
                        }}
                      >
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary ledger-row-action-btn mb-0"
                            aria-expanded={expandedIds.has(row.id)}
                            aria-label={expandedIds.has(row.id) ? 'Collapse row' : 'Expand row'}
                            onClick={() => onToggleExpand(row.id)}
                          >
                            <NavIcon
                              icon={expandedIds.has(row.id) ? FaChevronDown : FaChevronRight}
                              size={12}
                            />
                          </button>
                        </td>
                        <td className="text-sm ledger-link-ref">
                          <span className="d-inline-block text-truncate w-100" title={formatLedgerLinkRef(row)}>
                            {formatLedgerLinkRef(row) === '—' ? '' : formatLedgerLinkRef(row)}
                          </span>
                        </td>
                        <td className="text-sm text-nowrap ledger-date">
                          {moment(row.date).format('DD MMM YYYY HH:mm')}
                        </td>
                        <td className="text-sm font-weight-bold text-primary">{row.referenceNo}</td>
                        <td className="text-sm ledger-txn-desc">
                          <span className="d-inline-block text-truncate w-100" title={row.description}>
                            {row.description}
                          </span>
                        </td>
                        <td className="text-sm text-muted">{row.category || '—'}</td>
                        <td className="text-sm">
                          {row.type === 'debit' ? (
                            <span className="badge bg-gradient-danger text-xxs">Debit</span>
                          ) : (
                            <span className="badge bg-gradient-success text-xxs">Credit</span>
                          )}
                        </td>
                        <td className="text-end ledger-money text-danger">
                          {row.debit ? fmtMoney(row.debit) : '—'}
                        </td>
                        <td className="text-end ledger-money text-success">
                          {row.credit ? fmtMoney(row.credit) : '—'}
                        </td>
                        <td
                          className={`text-end ledger-money font-weight-bold ${balanceTextClass(row.runningBalance)}`}
                        >
                          {fmtMoney(row.runningBalance)}
                        </td>
                        <td className="text-xs">{row.paymentMethod || '—'}</td>
                        <td className="text-sm">{row.createdBy}</td>
                        <td>
                          <span
                            className={`badge text-xxs ledger-status-badge ${
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
                            <button
                              className="btn btn-sm btn-outline-secondary ledger-row-action-btn mb-0"
                              type="button"
                              data-bs-toggle="dropdown"
                              aria-label={`Actions for ${row.referenceNo}`}
                            >
                              <NavIcon icon={FaEllipsisVertical} size={14} />
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end text-sm shadow-sm">
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
                        <tr className="ledger-expand-row">
                          <td colSpan={14} className="ledger-expand-panel py-3 px-4">
                            <div className="row text-sm g-3">
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
                                  {row.linkedRefs && row.linkedRefs.length ? row.linkedRefs.join(', ') : '—'}
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

          <TablePagination
            className="list-table-toolbar--footer"
            selectId="ledger-detail-tx-page-size"
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
