import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { fetchUsers, setSearch, setPage, setLimit, setSort } from '../../features/users/usersSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const permissionActionBadgeClass = (enabled) =>
  enabled ? 'badge bg-gradient-success me-1 mb-1' : 'badge bg-gradient-secondary me-1 mb-1';

const Users = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.users);

  const { canView, canCreate, canEdit } = usePermissions('users');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    if (canView === false) {
      navigate('/dashboard');
    }
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
    dispatch(fetchUsers(params));
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
      return;
    }

    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => {
      dispatch(setSort({ sortBy }));
      sortClickTimeoutRef.current = null;
    }, 200);
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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  const renderRoleCell = (role) => {
    const roles = Array.isArray(role) ? role : role ? [role] : [];
    if (roles.length === 0) return <span className="text-muted">-</span>;
    return roles.map((item) => (
      <span key={item} className="badge bg-gradient-info me-1 mb-1">
        {item}
      </span>
    ));
  };

  const renderPermissionsCell = (permissions) => {
    if (!permissions || typeof permissions !== 'object') {
      return <span className="text-muted">-</span>;
    }

    const modules = Object.entries(permissions);
    if (modules.length === 0) {
      return <span className="text-muted">-</span>;
    }

    return modules.map(([moduleName, actions]) => (
      <div key={moduleName} className="mb-1">
        <span className="text-xs fw-bold text-uppercase me-1">{moduleName}:</span>
        <span className={permissionActionBadgeClass(Boolean(actions?.view))}>V</span>
        <span className={permissionActionBadgeClass(Boolean(actions?.add))}>A</span>
        <span className={permissionActionBadgeClass(Boolean(actions?.edit))}>E</span>
        <span className={permissionActionBadgeClass(Boolean(actions?.delete))}>D</span>
      </div>
    ));
  };

  const PaginationControls = () => {
    if (loading || error || pagination.total === 0) return null;
    return (
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <span className="text-sm text-muted me-2">Show:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={pagination.limit}
            onChange={handleLimitChange}
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
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
              >
                First
              </button>
            </li>
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
            </li>
            <li className="page-item active">
              <span className="page-link">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Users</h5>
                  <p className="text-sm mb-0">User list with role and permissions details.</p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-end align-items-center gap-2">
                    {canCreate && (
                      <button className="btn btn-primary btn-sm mb-0" onClick={() => navigate('/users/add')}>
                        <i className="fas fa-plus me-1"></i>
                        Add User
                      </button>
                    )}
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search users..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />
              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p>Loading users...</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    Error loading users: {error}
                  </div>
                )}
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
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('email')}
                          onDoubleClick={() => handleSort('email', true)}
                        >
                          Email
                          {renderSortIcon('email')}
                        </th>
                        <th>Role</th>
                        <th>Permissions</th>
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
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center text-sm font-weight-normal p-4">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const status = item.status || '-';
                          const isActive = String(status).toLowerCase() === 'active';
                          return (
                            <tr key={key}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{item.name || '-'}</td>
                              <td className="text-sm font-weight-normal">{item.email || '-'}</td>
                              <td className="text-sm font-weight-normal">{renderRoleCell(item.role)}</td>
                              <td className="text-sm font-weight-normal">
                                {renderPermissionsCell(item.permissions)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                                  {status}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt ? moment(item.createdAt).format('MM-DD-YYYY h:mm a') : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {canEdit ? (
                                  <button
                                    className="btn btn-outline-info btn-sm mb-0"
                                    onClick={() => navigate(`/users/edit/${item._id || item.id}`)}
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  '-'
                                )}
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

export default Users;
