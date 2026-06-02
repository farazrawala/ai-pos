import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchExpenses,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/expenses/expensesSlice.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { DEBUG } from '../../config/env.js';

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

/** Populated `user_id` object or raw id string from API. */
const expenseUserDisplayName = (userRef) => {
  if (userRef == null || userRef === '') return '—';
  if (typeof userRef === 'object') {
    const name = String(userRef.name ?? '').trim();
    if (name) return name;
    const email = String(userRef.email ?? '').trim();
    if (email) return email;
    return '—';
  }
  return '—';
};

/** Populated `account_id` (or payment account) object or raw id. */
const expenseAccountDisplayName = (accountRef) => {
  if (accountRef == null || accountRef === '') return '—';
  if (typeof accountRef === 'object') {
    const name = String(accountRef.name ?? accountRef.account_name ?? '').trim();
    if (name) return name;
    const code = String(accountRef.code ?? accountRef.account_code ?? '').trim();
    if (code) return code;
    return '—';
  }
  return '—';
};

const ExpenseIndex = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
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

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
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


  const colCount = 12;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Expenses</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      List from{' '}
                      <code className="text-xs">
                        GET /expense/get-all-active?populate=account_id,user_id,payment_method_accounts_id
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search expenses…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <AddNewButton to="/expenses/add" label="Add expense" />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading expenses…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="expenses-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
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
                        <th>User name</th>
                        <th>Expense account</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('amount')}
                          onDoubleClick={() => handleSort('amount', true)}
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </th>
                        <th>Payment account</th>
                        <th>Note</th>
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
                          Last Updated At
                          {renderSortIcon('updatedAt')}
                        </th>
                        <th>Actions</th>
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
                              <td className="text-sm font-weight-normal">
                                {expenseUserDisplayName(item.user_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {expenseAccountDisplayName(item.account_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.amount != null ? Number(item.amount).toLocaleString() : '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {expenseAccountDisplayName(item.payment_method_accounts_id)}
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
                              <td
                                className="text-sm text-muted text-nowrap"
                                title={
                                  item.updatedAt || item.updated_at
                                    ? moment(item.updatedAt || item.updated_at).format(
                                        'MM-DD-YYYY h:mm a'
                                      )
                                    : undefined
                                }
                              >
                                {item.updatedAt || item.updated_at
                                  ? moment(item.updatedAt || item.updated_at).fromNow()
                                  : '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() =>
                                    navigate(`/expenses/edit/${item._id || item.id}`)
                                  }
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </ListDataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseIndex;
