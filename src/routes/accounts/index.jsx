import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchAccounts,
  deleteAccount,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/accounts/accountsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useNavigate } from 'react-router-dom';

const Accounts = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    deleteStatus,
    deleteError,
  } = useSelector((state) => state.accounts);
  const { canView, canEdit, canDelete } = usePermissions('accounts');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

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
    dispatch(fetchAccounts(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

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

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => {
      dispatch(setSort({ sortBy }));
      sortClickTimeoutRef.current = null;
    }, 200);
  };

  const handleDelete = async (accountId, accountName) => {
    if (!accountId) return;
    if (window.confirm(`Delete "${accountName || 'this account'}"?`)) {
      await dispatch(deleteAccount(accountId));
    }
  };

  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const timeoutId = setTimeout(() => dispatch(clearDeleteStatus()), 3000);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [deleteStatus, dispatch]);

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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Accounts</h5>
                  <p className="text-sm mb-0">Account list with server-side pagination and search.</p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-end align-items-center gap-2">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search accounts..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              {!loading && !error && pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center">
                    <span className="text-sm text-muted me-2">Show:</span>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 'auto' }}
                      value={pagination.limit}
                      onChange={(e) => dispatch(setLimit(Number(e.target.value)))}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span className="text-sm text-muted ms-2">
                      Showing {startItem} to {endItem} of {pagination.total} entries
                    </span>
                  </div>
                  <div className="d-flex gap-1">
                    <button
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page === 1}
                      onClick={() => dispatch(setPage(pagination.page - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => dispatch(setPage(pagination.page + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p>Loading accounts...</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    Error loading accounts: {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th>ID</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('account_type')}
                          onDoubleClick={() => handleSort('account_type', true)}
                        >
                          Account Type
                          {renderSortIcon('account_type')}
                        </th>
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
                          Created At
                          {renderSortIcon('createdAt')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('updatedAt')}
                          onDoubleClick={() => handleSort('updatedAt', true)}
                        >
                          Updated At
                          {renderSortIcon('updatedAt')}
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center text-sm font-weight-normal p-4">
                            No accounts found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const statusValue = item.status || (item.isActive ? 'active' : 'inactive');
                          const isActive = String(statusValue).toLowerCase() === 'active';
                          return (
                            <tr key={item._id || item.id || index}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{item._id || '-'}</td>
                              <td className="text-sm font-weight-normal">
                                {item.name || item.accountName || '-'}
                              </td>
                              <td className="text-sm font-weight-normal">{item.account_type || '-'}</td>
                              <td className="text-sm font-weight-normal">
                                <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                                  {statusValue}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt ? moment(item.createdAt).format('MM-DD-YYYY h:mm a') : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.updatedAt ? moment(item.updatedAt).format('MM-DD-YYYY h:mm a') : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex gap-1">
                                  {canEdit && (
                                    <button
                                      className="btn btn-outline-info btn-sm mb-0"
                                      onClick={() => navigate(`/accounts/edit/${item._id || item.id}`)}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      className="btn btn-outline-danger btn-sm mb-0"
                                      onClick={() => handleDelete(item._id || item.id, item.name)}
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {!canEdit && !canDelete && '-'}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {deleteError && <div className="alert alert-danger mt-3 mb-0">{deleteError}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Accounts;
