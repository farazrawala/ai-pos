import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa6';
import { fetchUsers, setSearch, setPage, setLimit, setSort } from '../../features/users/usersSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import UsersPermissionsCell from '../../components/UsersPermissionsCell.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { DEBUG } from '../../config/env.js';

const userPhoneDisplay = (user) => {
  if (!user || typeof user !== 'object') return '—';
  const phone = user.phone ?? user.mobile ?? user.phoneNumber ?? '';
  const trimmed = String(phone).trim();
  return trimmed || '—';
};

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
      return <NavIcon icon={FaSort} className="text-muted ms-1 opacity-6" size={12} />;
    }
    return sort.sortOrder === 'asc' ? (
      <NavIcon icon={FaSortUp} className="text-primary ms-1" size={12} />
    ) : (
      <NavIcon icon={FaSortDown} className="text-primary ms-1" size={12} />
    );
  };

  const renderRoleCell = (role) => {
    const roles = Array.isArray(role) ? role : role ? [role] : [];
    if (roles.length === 0) return <span className="text-muted">—</span>;
    return (
      <div className="d-flex flex-wrap gap-1">
        {roles.map((item) => (
          <span key={item} className="badge bg-gradient-info mb-0">
            {item}
          </span>
        ))}
      </div>
    );
  };

  const sortableTh = (column, label) => (
    <th
      className="list-data-table-sortable"
      onClick={() => handleSort(column)}
      onDoubleClick={() => handleSort(column, true)}
    >
      <span className="d-inline-flex align-items-center">
        {label}
        {renderSortIcon(column)}
      </span>
    </th>
  );

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-md-6">
                  <h5 className="mb-1">Users</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">
                      User list with role and permissions details.
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
                        placeholder="Search users..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && <AddNewButton to="/users/add" label="Add User" />}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading users…"
                error={error}
                errorPrefix="Error loading users"
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="users-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center" style={{ width: '56px' }}>
                          #
                        </th>
                        {sortableTh('name', 'Name')}
                        {sortableTh('email', 'Email')}
                        <th>Phone</th>
                        <th>Role</th>
                        <th className="col-permissions">Permissions</th>
                        {sortableTh('status', 'Status')}
                        {sortableTh('createdAt', 'Created')}
                        <th className="text-center" style={{ width: '88px' }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 text-muted">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber =
                            (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const statusVal = item.status || '—';
                          const isActive = String(statusVal).toLowerCase() === 'active';
                          return (
                            <tr key={key}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td>
                                <span className="font-weight-bold text-dark text-sm">
                                  {item.name || '—'}
                                </span>
                              </td>
                              <td className="text-sm">{item.email || '—'}</td>
                              <td className="text-sm">{userPhoneDisplay(item)}</td>
                              <td>{renderRoleCell(item.role)}</td>
                              <td className="col-permissions">
                                <UsersPermissionsCell permissions={item.permissions} />
                              </td>
                              <td>
                                <span
                                  className={`badge mb-0 ${
                                    isActive ? 'bg-gradient-success' : 'bg-gradient-secondary'
                                  }`}
                                >
                                  {statusVal}
                                </span>
                              </td>
                              <td className="text-sm text-muted">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '—'}
                              </td>
                              <td className="text-center">
                                {canEdit ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0"
                                    onClick={() =>
                                      navigate(`/users/edit/${item._id || item.id}`)
                                    }
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
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

export default Users;
