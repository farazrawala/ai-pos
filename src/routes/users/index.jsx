import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchUsers,
  updateUserStatus,
  setSearch,
  setPage,
  setLimit,
  setSort,
  setRoleFilter,
  setStateFilter,
  setCityFilter,
  USER_LIST_ROLE_TABS,
} from '../../features/users/usersSlice.js';
import { isDefaultCustomerUser, isDefaultVendorUser } from '../../features/users/usersAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import {
  PAKISTAN_STATES,
  getPakistanCities,
  getStateForCity,
} from '../../constants/pakistanLocations.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import UsersPermissionsCell from '../../components/UsersPermissionsCell.jsx';
import { DEBUG } from '../../config/env.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { fmtMoney, balanceTextClass } from '../../components/ledger/ledgerUtils.js';
import { showToast } from '../../utils/toast.js';
import './users-module.css';

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

const USER_COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'photo', label: 'Photo' },
  { key: 'name', label: 'Name', alwaysVisible: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'role', label: 'Role' },
  { key: 'balance', label: 'Balance' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

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
    roleFilter,
    stateFilter = '',
    cityFilter = '',
  } = useSelector((state) => state.users);

  const activeRoleTab = useMemo(
    () => USER_LIST_ROLE_TABS.find((t) => t.id === roleFilter) ?? USER_LIST_ROLE_TABS[0],
    [roleFilter]
  );

  const { canCreate, canEdit } = usePermissions('users');
  useRequireModuleAccess('users');
  const loading = status === 'loading';
  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility('users', USER_COLUMNS);
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [togglingUserId, setTogglingUserId] = useState(null);
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
    if (activeRoleTab.role) params.role = activeRoleTab.role;
    if (stateFilter) params.state = stateFilter;
    if (cityFilter) params.city = cityFilter;
    dispatch(fetchUsers(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    sort.sortBy,
    sort.sortOrder,
    activeRoleTab.role,
    stateFilter,
    cityFilter,
  ]);

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

  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh
      column={column}
      label={label}
      sort={sort}
      onSort={handleSort}
      className={className}
    />
  );

  const handleRoleTabChange = (tabId) => {
    dispatch(setRoleFilter(tabId));
  };

  const stateFilterOptions = useMemo(
    () => [
      { value: '', label: 'All states' },
      ...PAKISTAN_STATES.map((state) => ({ value: state, label: state })),
    ],
    []
  );

  const cityFilterOptions = useMemo(() => {
    const cities = getPakistanCities(stateFilter);
    return [
      { value: '', label: 'All cities' },
      ...cities.map((city) => ({
        value: city,
        label: city,
        subLabel: stateFilter ? undefined : getStateForCity(city) || undefined,
      })),
    ];
  }, [stateFilter]);

  const handleStateFilterChange = (nextState) => {
    dispatch(setStateFilter(nextState));
    if (cityFilter) {
      const cities = getPakistanCities(nextState);
      const stillValid = cities.some(
        (item) => item.toLowerCase() === String(cityFilter).toLowerCase()
      );
      if (!stillValid) dispatch(setCityFilter(''));
    }
  };

  const handleCityFilterChange = (nextCity) => {
    dispatch(setCityFilter(nextCity));
    if (nextCity && !stateFilter) {
      const matchedState = getStateForCity(nextCity);
      if (matchedState) dispatch(setStateFilter(matchedState));
    }
  };

  const handleToggleStatus = async (userId, isCurrentlyActive) => {
    if (!userId || !canEdit || togglingUserId) return;
    const nextStatus = isCurrentlyActive ? 'inactive' : 'active';
    setTogglingUserId(userId);
    try {
      await dispatch(updateUserStatus({ userId, status: nextStatus })).unwrap();
      showToast({
        message:
          nextStatus === 'active' ? 'User activated successfully.' : 'User deactivated successfully.',
        variant: 'success',
      });
    } catch (err) {
      const message =
        typeof err === 'string' ? err : err?.message || 'Failed to update user status';
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingUserId(null);
    }
  };

  const filteredData = useMemo(() => {
    const stateNeedle = String(stateFilter || '').trim().toLowerCase();
    const cityNeedle = String(cityFilter || '').trim().toLowerCase();
    if (!stateNeedle && !cityNeedle) return data;
    return data.filter((user) => {
      const userState = String(user?.state || '').trim().toLowerCase();
      const userCity = String(user?.city || '').trim().toLowerCase();
      if (stateNeedle && userState !== stateNeedle) return false;
      if (cityNeedle && userCity !== cityNeedle) return false;
      return true;
    });
  }, [data, stateFilter, cityFilter]);

  const emptyMessage = useMemo(() => {
    const locationHint =
      stateFilter || cityFilter ? ' Try a different state or city filter.' : '';
    if (activeRoleTab.id === 'customer')
      return `No customers found. Try adjusting your search.${locationHint}`;
    if (activeRoleTab.id === 'vendor')
      return `No vendors found. Try adjusting your search.${locationHint}`;
    return `No users found. Try adjusting your search.${locationHint}`;
  }, [activeRoleTab.id, stateFilter, cityFilter]);

  const searchPlaceholder = useMemo(() => {
    if (activeRoleTab.id === 'customer') return 'Search customers…';
    if (activeRoleTab.id === 'vendor') return 'Search vendors…';
    return 'Search users…';
  }, [activeRoleTab.id]);

  const addButtonLabel = useMemo(() => {
    if (activeRoleTab.id === 'customer') return 'Add customer';
    if (activeRoleTab.id === 'vendor') return 'Add vendor';
    return 'Add user';
  }, [activeRoleTab.id]);

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
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Users</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">
                      Filter by role — staff, customers, or vendors.
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <ColumnVisibilityMenu
                      columns={USER_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id="usersColumnVisibilityMenu"
                    />
                    <div className="users-location-filter">
                      <SearchableSelect
                        id="users-filter-state"
                        options={stateFilterOptions}
                        value={stateFilter}
                        placeholder="All states"
                        searchPlaceholder="Search state…"
                        onChange={handleStateFilterChange}
                      />
                    </div>
                    <div className="users-location-filter">
                      <SearchableSelect
                        id="users-filter-city"
                        options={cityFilterOptions}
                        value={cityFilter}
                        placeholder="All cities"
                        searchPlaceholder="Search city…"
                        onChange={handleCityFilterChange}
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={searchPlaceholder}
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label={searchPlaceholder}
                      />
                    </div>
                    {canCreate ? (
                      <AddNewButton to="/users/add" label={addButtonLabel} size="sm" />
                    ) : null}
                  </div>
                </div>
              </div>
              <ul className="nav nav-tabs users-role-tabs mt-3 border-0">
                {USER_LIST_ROLE_TABS.map((tab) => (
                  <li className="nav-item" key={tab.id}>
                    <button
                      type="button"
                      className={`nav-link ${roleFilter === tab.id ? 'active' : ''}`}
                      onClick={() => handleRoleTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
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
                      {isVisible('sno') ? <th className="text-center list-col-sno">#</th> : null}
                      {isVisible('photo') ? <th className="list-col-user-photo">Photo</th> : null}
                      {isVisible('name') ? sortableTh('name', 'Name', 'list-col-truncate') : null}
                      {isVisible('email')
                        ? sortableTh('email', 'Email', 'list-col-truncate')
                        : null}
                      {isVisible('phone') ? <th className="list-col-truncate-sm">Phone</th> : null}
                      {isVisible('city')
                        ? sortableTh('city', 'City', 'list-col-truncate-sm')
                        : null}
                      {isVisible('state')
                        ? sortableTh('state', 'State', 'list-col-truncate-sm')
                        : null}
                      {isVisible('role') ? <th className="list-col-user-roles">Role</th> : null}
                      {isVisible('balance')
                        ? sortableTh('initial_balance', 'Balance', 'text-end list-col-amount')
                        : null}
                      {isVisible('permissions') ? (
                        <th className="list-col-permissions">Permissions</th>
                      ) : null}
                      {isVisible('status') ? sortableTh('status', 'Status') : null}
                      {isVisible('created')
                        ? sortableTh('createdAt', 'Created', 'list-col-date')
                        : null}
                      {isVisible('actions') ? (
                        <th className="text-end list-col-actions list-col-actions--users">
                          Actions
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount || 13} className="text-center py-5 text-muted">
                          {emptyMessage}
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item._id || item.id || index;
                        const isActive = String(item.status || '').toLowerCase() === 'active';
                        const openingBalance = userOpeningBalance(item);
                        const profileUrl = userProfileImageUrl(item);
                        const userId = item._id || item.id;
                        const isDefaultCustomer = isDefaultCustomerUser(item);
                        const isDefaultVendor = isDefaultVendorUser(item);
                        const displayName =
                          item.name || item.fullName || item.username || '—';
                        const email = String(item.email || '').trim() || '—';
                        const phone = userPhoneDisplay(item);
                        const city = String(item.city || '').trim() || '—';
                        const state = String(item.state || '').trim() || '—';
                        const created = item.createdAt ?? item.created_at ?? item.created;
                        const updated = item.updatedAt ?? item.updated_at ?? item.updated;
                        return (
                          <tr key={key}>
                            {isVisible('sno') ? (
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            ) : null}
                            {isVisible('photo') ? (
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
                            ) : null}
                            {isVisible('name') ? (
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
                            ) : null}
                            {isVisible('email') ? (
                              <td
                                className="text-sm text-muted list-cell-truncate"
                                title={email !== '—' ? email : undefined}
                              >
                                {email}
                              </td>
                            ) : null}
                            {isVisible('phone') ? (
                              <td
                                className="text-sm list-cell-truncate-sm"
                                title={phone !== '—' ? phone : undefined}
                              >
                                {phone}
                              </td>
                            ) : null}
                            {isVisible('city') ? (
                              <td
                                className="text-sm list-cell-truncate-sm"
                                title={city !== '—' ? city : undefined}
                              >
                                {city}
                              </td>
                            ) : null}
                            {isVisible('state') ? (
                              <td
                                className="text-sm list-cell-truncate-sm"
                                title={state !== '—' ? state : undefined}
                              >
                                {state}
                              </td>
                            ) : null}
                            {isVisible('role') ? <td>{renderRoleCell(item.role)}</td> : null}
                            {isVisible('balance') ? (
                              <td
                                className={`text-sm text-end font-weight-bold list-col-amount ${balanceTextClass(
                                  openingBalance
                                )}`}
                              >
                                {fmtMoney(openingBalance)}
                              </td>
                            ) : null}
                            {isVisible('permissions') ? (
                              <td className="list-col-permissions">
                                <UsersPermissionsCell permissions={item.permissions} />
                              </td>
                            ) : null}
                            {isVisible('status') ? (
                              <td className="text-sm">
                                {canEdit ? (
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="form-check form-switch mb-0">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id={`user-status-${userId || index}`}
                                        checked={isActive}
                                        onChange={() => handleToggleStatus(userId, isActive)}
                                        disabled={togglingUserId === userId}
                                        aria-label={`${displayName} status ${isActive ? 'active' : 'inactive'}`}
                                        style={{
                                          width: '2.5rem',
                                          height: '1.25rem',
                                          cursor:
                                            togglingUserId === userId ? 'not-allowed' : 'pointer',
                                        }}
                                      />
                                    </div>
                                    {togglingUserId === userId ? (
                                      <span
                                        className="spinner-border spinner-border-sm text-primary"
                                        role="status"
                                        style={{ width: '1rem', height: '1rem' }}
                                      >
                                        <span className="visually-hidden">Saving…</span>
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-muted text-sm">—</span>
                                )}
                              </td>
                            ) : null}
                            {isVisible('created') ? (
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
                            ) : null}
                            {isVisible('actions') ? (
                              <td className="text-end">
                                <div className="list-table-actions">
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary mb-0"
                                      onClick={() => navigate(`/users/edit/${userId}`)}
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <span className="text-muted text-sm">—</span>
                                  )}
                                </div>
                              </td>
                            ) : null}
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
