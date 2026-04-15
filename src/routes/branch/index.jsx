import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchBranches,
  deleteBranch,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/branch/branchSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const Branch = () => {
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
  } = useSelector((state) => state.branch);
  const { canView, canCreate, canEdit, canDelete } = usePermissions('branch');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchBranches(params));
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

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => dispatch(setSort({ sortBy })), 200);
  };

  const renderSortIcon = (columnName) =>
    sort.sortBy !== columnName ? (
      <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );

  const handleDelete = async (branchId, branchName) => {
    if (window.confirm(`Delete "${branchName || 'this branch'}"?`)) {
      await dispatch(deleteBranch(branchId));
    }
  };

  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      setTimeout(() => dispatch(clearDeleteStatus()), 3000);
    }
  }, [deleteStatus, dispatch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-12">
                  <h5 className="mb-0">Branch</h5>
                  <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
                </div>
                <div className="col-md-12">
                  <div className="d-flex justify-content-end align-items-center gap-2">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search branches..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/branch/add')}
                      >
                        <i className="fas fa-plus me-1"></i>
                        Add Branch
                      </button>
                    )}
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
                {loading && <div className="text-center p-4">Loading branches...</div>}
                {error && <div className="alert alert-danger m-3">Error loading data: {error}</div>}
                {!loading && !error && (
                  <table className="table table-flush">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th>Code</th>
                        <th>City</th>
                        <th>State</th>
                        <th>Phone</th>
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
                            No branches found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const id = item._id || item.id || item.branch_id;
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          return (
                            <tr key={id || index}>
                              <td>{seriesNumber}</td>
                              <td>{item.name || '-'}</td>
                              <td>{item.code || item.branch_code || '-'}</td>
                              <td>{item.city || '-'}</td>
                              <td>{item.state || '-'}</td>
                              <td>{item.phone || '-'}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    String(item.status || '').toLowerCase() === 'active'
                                      ? 'bg-success'
                                      : 'bg-secondary'
                                  }`}
                                >
                                  {item.status || 'inactive'}
                                </span>
                              </td>
                              <td>
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '-'}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  {canEdit && (
                                    <button
                                      className="btn btn-sm btn-primary mb-0"
                                      onClick={() => navigate(`/branch/edit/${id}`)}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      className="btn btn-sm btn-danger mb-0"
                                      onClick={() => handleDelete(id, item.name)}
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      Delete
                                    </button>
                                  )}
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

export default Branch;
