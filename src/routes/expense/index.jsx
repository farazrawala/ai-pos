import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import moment from 'moment';
import {
  fetchExpenses,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/expenses/expensesSlice.js';

const shortenId = (id, len = 10) => {
  if (id == null || id === '') return '—';
  const s = String(id);
  if (s.length <= len) return s;
  return `${s.slice(0, len)}…`;
};

const IdCell = ({ value }) => {
  const s = value != null && value !== '' ? String(value) : '';
  if (!s) return <span className="text-muted">—</span>;
  return (
    <span className="font-monospace text-xs" style={{ wordBreak: 'break-all' }} title={s}>
      {shortenId(s, 12)}
    </span>
  );
};

const ExpenseIndex = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.expenses);
  const loading = listStatus === 'loading';
  const error = listError;
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchExpenses(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (e) => {
    dispatch(setLimit(Number(e.target.value)));
  };

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
  };

  const renderSortIcon = (columnName) => {
    if (sort.sortBy !== columnName) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );
  };

  useEffect(() => {
    if (error) {
      console.error('[Expense module] Failed to fetch expense list', error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  const PaginationControls = () => {
    if (loading || error || pagination.total === 0) return null;
    return (
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center flex-wrap">
          <span className="text-sm text-muted me-2">Show:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={pagination.limit}
            onChange={handleLimitChange}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-muted ms-2">
            Showing {startItem} to {endItem} of {pagination.total} entries
          </span>
        </div>
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
              >
                First
              </button>
            </li>
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
            </li>
            <li className="page-item active">
              <span className="page-link">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </button>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Last
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  const colCount = 13;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Expenses</h5>
                  <p className="text-sm mb-0 text-muted">
                    List from <code className="text-xs">GET /expense/get-all-active</code>
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search expenses…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <NavLink className="btn btn-primary btn-sm" to="/expenses/add">
                      <i className="fas fa-plus me-1"></i>
                      Add expense
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />
              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p className="mb-0">Loading expenses…</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush table-sm align-middle">
                    <thead className="thead-light">
                      <tr>
                        <th>#</th>
                        <th>Id</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th>User id</th>
                        <th>Account id</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('amount')}
                          onDoubleClick={() => handleSort('amount', true)}
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </th>
                        <th>Payment acct.</th>
                        <th>Note</th>
                        <th>Company id</th>
                        <th>Created by</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('status')}
                          onDoubleClick={() => handleSort('status', true)}
                        >
                          Status
                          {renderSortIcon('status')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('updatedAt')}
                          onDoubleClick={() => handleSort('updatedAt', true)}
                        >
                          Updated
                          {renderSortIcon('updatedAt')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center text-sm p-4 text-muted">
                            No expenses found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const note = item.note != null ? String(item.note) : '';
                          return (
                            <tr key={rowKey}>
                              <td className="text-sm text-muted">{seriesNumber}</td>
                              <td className="text-sm">
                                <IdCell value={item._id} />
                              </td>
                              <td className="text-sm font-weight-normal">{item.name || '—'}</td>
                              <td className="text-sm">
                                <IdCell value={item.user_id} />
                              </td>
                              <td className="text-sm">
                                <IdCell value={item.account_id} />
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.amount != null ? Number(item.amount).toLocaleString() : '—'}
                              </td>
                              <td className="text-sm">
                                <IdCell value={item.payment_method_accounts_id} />
                              </td>
                              <td
                                className="text-sm font-weight-normal"
                                style={{ maxWidth: '160px' }}
                                title={note}
                              >
                                {note ? (
                                  <span
                                    className="text-truncate d-inline-block"
                                    style={{ maxWidth: '150px' }}
                                  >
                                    {note}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm">
                                <IdCell value={item.company_id} />
                              </td>
                              <td className="text-sm">
                                <IdCell value={item.created_by} />
                              </td>
                              <td className="text-sm">
                                <span
                                  className={`badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                              <td className="text-sm text-muted text-nowrap">
                                {item.createdAt
                                  ? moment(item.createdAt).format('YYYY-MM-DD HH:mm')
                                  : '—'}
                              </td>
                              <td className="text-sm text-muted text-nowrap">
                                {item.updatedAt
                                  ? moment(item.updatedAt).format('YYYY-MM-DD HH:mm')
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationControls />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseIndex;
