import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchUsers,
  setSearch,
  setPage,
  setLimit,
  setSort,
  deleteUser,
  clearDeleteStatus,
} from '../../features/users/usersSlice.js';
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
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import UsersPermissionsCell from '../../components/UsersPermissionsCell.jsx';
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
    user.profile_image ?? user.profileImage ?? user.avatar ?? user.image ?? user.photo ?? '';
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
      !window.confirm(`Are you sure you want to delete "${label}"? This action cannot be undone.`)
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

  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh column={column} label={label} sort={sort} onSort={handleSort} className={className} />
  );

  const renderRoleCell = (role) => {
    const roles = Array.isArray(role) ? role : role ? [role] : [];
    if (roles.length === 0) return <span className="text-muted text-sm">—</span>;
    return (
      <div className="d-flex flex-wrap gap-1">
        {roles.map((item) => (
          <span key={item} className="badge text-xxs bg-gradient-info mb-0">
            {item}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Users</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">
                      User list with role and permissions details.
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search users…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search users"
                      />
                    </div>
                    {canCreate ? (
                      <AddNewButton to="/users/add" label="Add user" size="sm" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--users"
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
                      <th className="text-center list-col-sno">#</th>
                      <th className="list-col-user-photo">Photo</th>
                      {sortableTh('name', 'Name', 'list-col-truncate')}
                      {sortableTh('email', 'Email', 'list-col-truncate')}
                      <th className="list-col-truncate-sm">Phone</th>
                      <th className="list-col-user-roles">Role</th>
                      {sortableTh('initial_balance', 'Balance', 'text-end list-col-amount')}
                      <th className="list-col-permissions">Permissions</th>
                      {sortableTh('status', 'Status')}
                      {sortableTh('createdAt', 'Created', 'list-col-date')}
                      <th className="text-end list-col-actions list-col-actions--users">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-5 text-muted">
                          No users found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item._id || item.id || index;
                        const statusVal = item.status || '—';
                        const isActive = String(statusVal).toLowerCase() === 'active';
                        const openingBalance = userOpeningBalance(item);
                        const profileUrl = userProfileImageUrl(item);
                        const userId = item._id || item.id;
                        const displayName = item.name || '—';
                        const email = item.email || '—';
                        const phone = userPhoneDisplay(item);
                        const isCustomer = userHasRole(item, 'CUSTOMER');
                        const isVendor = userHasRole(item, 'VENDOR');
                        const isDefaultCustomer = isDefaultCustomerUser(item);
                        const isDefaultVendor = isDefaultVendorUser(item);
                        const isMarking = markingDefaultUserId === String(userId);
                        const created = item.createdAt ?? item.created_at;
                        const updated = item.updatedAt ?? item.updated_at;
                        const dropdownId = `user-actions-${userId || index}`;
                        const hasExtraActions =
                          (canEdit && isCustomer && !isDefaultCustomer) ||
                          (canEdit && isVendor && !isDefaultVendor) ||
                          canDelete;
                        return (
                          <tr key={key}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            <td>
                              {profileUrl ? (
                                <img
                                  src={profileUrl}
                                  alt={displayName !== '—' ? `${displayName} profile` : 'Profile'}
                                  className="list-user-avatar"
                                />
                              ) : (
                                <div className="list-user-avatar list-user-avatar--empty">
                                  <i className="fas fa-user text-muted" aria-hidden="true" />
                                </div>
                              )}
                            </td>
                            <td className="list-cell-truncate">
                              <div
                                className="text-sm font-weight-bold text-dark text-truncate"
                                title={displayName !== '—' ? displayName : undefined}
                              >
                                {displayName}
                              </div>
                              {isDefaultCustomer || isDefaultVendor ? (
                                <div className="d-flex flex-wrap gap-1 mt-1">
                                  {isDefaultCustomer ? (
                                    <span className="badge text-xxs bg-gradient-primary mb-0">
                                      Default customer
                                    </span>
                                  ) : null}
                                  {isDefaultVendor ? (
                                    <span className="badge text-xxs bg-gradient-dark mb-0">
                                      Default vendor
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                            <td
                              className="text-sm text-muted list-cell-truncate"
                              title={email !== '—' ? email : undefined}
                            >
                              {email}
                            </td>
                            <td
                              className="text-sm list-cell-truncate-sm"
                              title={phone !== '—' ? phone : undefined}
                            >
                              {phone}
                            </td>
                            <td>{renderRoleCell(item.role)}</td>
                            <td
                              className={`text-sm text-end font-weight-bold list-col-amount ${balanceTextClass(
                                openingBalance
                              )}`}
                            >
                              {fmtMoney(openingBalance)}
                            </td>
                            <td className="list-col-permissions">
                              <UsersPermissionsCell permissions={item.permissions} />
                            </td>
                            <td className="text-sm">
                              <span
                                className={`badge text-xxs mb-0 ${
                                  isActive ? 'bg-gradient-success' : 'bg-gradient-secondary'
                                }`}
                              >
                                {statusVal}
                              </span>
                            </td>
                            <td
                              className="text-sm text-nowrap list-col-date"
                              title={
                                updated
                                  ? `Updated ${moment(updated).format('DD MMM YYYY h:mm a')}`
                                  : undefined
                              }
                            >
                              {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                            </td>
                            <td className="text-end">
                              <div className="list-table-actions">
                                {canEdit ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0"
                                    onClick={() => navigate(`/users/edit/${userId}`)}
                                    disabled={isMarking || deleteStatus === 'loading'}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {hasExtraActions ? (
                                  <div className="dropdown">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary mb-0 dropdown-toggle"
                                      id={dropdownId}
                                      data-bs-toggle="dropdown"
                                      aria-expanded="false"
                                      disabled={isMarking || deleteStatus === 'loading'}
                                    >
                                      More
                                    </button>
                                    <ul
                                      className="dropdown-menu dropdown-menu-end"
                                      aria-labelledby={dropdownId}
                                    >
                                      {canEdit && isCustomer && !isDefaultCustomer ? (
                                        <li>
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            onClick={() => handleMarkDefaultCustomer(item)}
                                            disabled={isMarking}
                                          >
                                            Set as default customer
                                          </button>
                                        </li>
                                      ) : null}
                                      {canEdit && isVendor && !isDefaultVendor ? (
                                        <li>
                                          <button
                                            type="button"
                                            className="dropdown-item"
                                            onClick={() => handleMarkDefaultVendor(item)}
                                            disabled={isMarking}
                                          >
                                            Set as default vendor
                                          </button>
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
                                {!canEdit && !canDelete ? (
                                  <span className="text-muted text-sm">—</span>
                                ) : null}
                              </div>
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
