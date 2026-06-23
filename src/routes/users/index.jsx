import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaSort, FaSortDown, FaSortUp, FaEllipsisVertical } from 'react-icons/fa6';
import { fetchUsers, setSearch, setPage, setLimit, setSort, deleteUser, clearDeleteStatus } from '../../features/users/usersSlice.js';
import {
  markUserAsDefaultCustomerRequest,
  markUserAsDefaultVendorRequest,
  isDefaultCustomerUser,
  isDefaultVendorUser,
  userHasRole,
} from '../../features/users/usersAPI.js';
import { toast } from '../../utils/toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import UsersPermissionsCell from '../../components/UsersPermissionsCell.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { DEBUG } from '../../config/env.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { fmtMoney, balanceTextClass } from '../../components/ledger/ledgerUtils.js';

const userOpeningBalance = (user) =>
  Number(user?.initial_balance ?? user?.initialBalance ?? user?.opening_balance ?? 0) || 0;

const userPhoneDisplay = (user) => {
  if (!user || typeof user !== 'object') return '—';
  const phone = user.phone ?? user.mobile ?? user.phoneNumber ?? '';
  const trimmed = String(phone).trim();
  return trimmed || '—';
};

const userProfileImageUrl = (user) => {
  if (!user || typeof user !== 'object') return '';
  const raw =
    user.profile_image ??
    user.profileImage ??
    user.avatar ??
    user.image ??
    user.photo ??
    '';
  return resolveCategoryMediaUrl(raw);
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
    deleteStatus,
    deleteError,
  } = useSelector((state) => state.users);
  const authUser = useSelector((state) => state.user.user);

  const { canView, canCreate, canEdit, canDelete } = usePermissions('users');
  useRequireModuleAccess('users');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [markingDefaultUserId, setMarkingDefaultUserId] = useState('');
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

  const reloadUsers = useCallback(() => {
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

  const handleMarkDefaultCustomer = async (user) => {
    const userId = user?._id || user?.id;
    if (!userId || isDefaultCustomerUser(user)) return;
    if (!userHasRole(user, 'CUSTOMER')) {
      toast.warning('Only users with the CUSTOMER role can be set as default customer.');
      return;
    }
    setMarkingDefaultUserId(String(userId));
    try {
      await markUserAsDefaultCustomerRequest(userId);
      toast.success(`"${user.name || 'User'}" is now the default customer.`);
      reloadUsers();
    } catch (err) {
      toast.error(err?.message || 'Could not set default customer.');
    } finally {
      setMarkingDefaultUserId('');
    }
  };

  const handleMarkDefaultVendor = async (user) => {
    const userId = user?._id || user?.id;
    if (!userId || isDefaultVendorUser(user)) return;
    if (!userHasRole(user, 'VENDOR')) {
      toast.warning('Only users with the VENDOR role can be set as default vendor.');
      return;
    }
    setMarkingDefaultUserId(String(userId));
    try {
      await markUserAsDefaultVendorRequest(userId);
      toast.success(`"${user.name || 'User'}" is now the default vendor.`);
      reloadUsers();
    } catch (err) {
      toast.error(err?.message || 'Could not set default vendor.');
    } finally {
      setMarkingDefaultUserId('');
    }
  };

  const handleDelete = async (userId, userName) => {
    const authUserId = String(authUser?._id || authUser?.id || '');
    if (authUserId && String(userId) === authUserId) {
      window.alert('You cannot delete your own account.');
      return;
    }
    const label = userName || 'this user';
    if (
      !window.confirm(
        `Are you sure you want to delete "${label}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await dispatch(deleteUser(userId)).unwrap();
      reloadUsers();
    } catch (err) {
      console.error('[Users] Delete failed', err);
    }
  };

  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const timer = setTimeout(() => dispatch(clearDeleteStatus()), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteStatus, dispatch]);

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
                        <th className="text-center" style={{ width: '72px' }}>
                          #
                        </th>
                        <th className="text-center" style={{ width: '72px' }}>
                          profile_image
                        </th>
                        {sortableTh('name', 'Name')}
                        {sortableTh('email', 'Email')}
                        <th>Phone</th>
                        <th>Role</th>
                        {sortableTh('initial_balance', 'Opening balance')}
                        <th className="col-permissions">Permissions</th>
                        {sortableTh('status', 'Status')}
                        {sortableTh('createdAt', 'Created')}
                        {sortableTh('updatedAt', 'Last Updated At')}
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="text-center py-5 text-muted">
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
                          const openingBalance = userOpeningBalance(item);
                          const profileUrl = userProfileImageUrl(item);
                          const userId = item._id || item.id;
                          const isCustomer = userHasRole(item, 'CUSTOMER');
                          const isVendor = userHasRole(item, 'VENDOR');
                          const isDefaultCustomer = isDefaultCustomerUser(item);
                          const isDefaultVendor = isDefaultVendorUser(item);
                          const showActionsMenu = canEdit || canDelete;
                          const isMarking = markingDefaultUserId === String(userId);
                          return (
                            <tr key={key}>
                              <td
                                className="text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="d-flex align-items-center justify-content-center gap-1">
                                  <span className="text-muted text-sm">{seriesNumber}</span>
                                  {showActionsMenu ? (
                                    <div className="dropdown">
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary mb-0 px-2 py-1"
                                        data-bs-toggle="dropdown"
                                        aria-expanded="false"
                                        aria-label={`Actions for ${item.name || 'user'}`}
                                        disabled={isMarking || deleteStatus === 'loading'}
                                      >
                                        <NavIcon icon={FaEllipsisVertical} size={14} />
                                      </button>
                                      <ul className="dropdown-menu dropdown-menu-start text-sm shadow-sm">
                                        {canEdit ? (
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item"
                                              onClick={() => navigate(`/users/edit/${userId}`)}
                                            >
                                              Edit
                                            </button>
                                          </li>
                                        ) : null}
                                        {canEdit && isCustomer ? (
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item"
                                              onClick={() => handleMarkDefaultCustomer(item)}
                                              disabled={isDefaultCustomer || isMarking}
                                            >
                                              {isDefaultCustomer
                                                ? 'Default customer'
                                                : 'Make default customer'}
                                            </button>
                                          </li>
                                        ) : null}
                                        {canEdit && isVendor ? (
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item"
                                              onClick={() => handleMarkDefaultVendor(item)}
                                              disabled={isDefaultVendor || isMarking}
                                            >
                                              {isDefaultVendor
                                                ? 'Default vendor'
                                                : 'Make default vendor'}
                                            </button>
                                          </li>
                                        ) : null}
                                        {canEdit && (isCustomer || isVendor) && canDelete ? (
                                          <li>
                                            <hr className="dropdown-divider" />
                                          </li>
                                        ) : null}
                                        {canDelete ? (
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item text-danger"
                                              onClick={() => handleDelete(userId, item.name)}
                                              disabled={deleteStatus === 'loading'}
                                            >
                                              Delete
                                            </button>
                                          </li>
                                        ) : null}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td className="text-center">
                                {profileUrl ? (
                                  <img
                                    src={profileUrl}
                                    alt={item.name ? `${item.name} profile` : 'Profile'}
                                    className="rounded-circle border"
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <span
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle border bg-light text-muted text-xs"
                                    style={{ width: '40px', height: '40px' }}
                                    title="No photo"
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="font-weight-bold text-dark text-sm">
                                  {item.name || '—'}
                                </span>
                                {isDefaultCustomer ? (
                                  <span className="badge bg-gradient-primary ms-1 mb-0 text-xxs">
                                    Default customer
                                  </span>
                                ) : null}
                                {isDefaultVendor ? (
                                  <span className="badge bg-gradient-dark ms-1 mb-0 text-xxs">
                                    Default vendor
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-sm">{item.email || '—'}</td>
                              <td className="text-sm">{userPhoneDisplay(item)}</td>
                              <td>{renderRoleCell(item.role)}</td>
                              <td
                                className={`text-sm text-end font-weight-bold ${balanceTextClass(
                                  openingBalance
                                )}`}
                              >
                                {fmtMoney(openingBalance)}
                              </td>
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
                              <td
                                className="text-sm text-muted"
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
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                </table>
              </ListDataTable>
              {deleteError && (
                <div className="alert alert-danger mx-3 mb-3" role="alert">
                  {deleteError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
