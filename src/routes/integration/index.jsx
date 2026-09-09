import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchIntegrations,
  deleteIntegration,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/integration/integrationSlice.js';
import {
  pickIntegrationStoreLogoUrl,
  generateIntegrationTokensCronRequest,
} from '../../features/integration/integrationAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { DEBUG } from '../../config/env.js';
import { integrationIdFromRecord, integrationNameFromRecord, storeTypeLabel } from './integrationForm.js';

/** Integrations table columns. `sno`, `name`, `actions` are always visible. */
const INTEGRATION_COLUMNS = [
  { key: 'sno', label: 'S.No', alwaysVisible: true },
  { key: 'image', label: 'Image' },
  { key: 'name', label: 'Store name', alwaysVisible: true },
  { key: 'store_type', label: 'Store type' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'url', label: 'URL' },
  { key: 'token', label: 'Expiry' },
  { key: 'dates', label: 'Created / Updated' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

function integrationTimestamp(item, key) {
  if (!item || typeof item !== 'object') return null;
  if (key === 'updatedAt') return item.updatedAt ?? item.updated_at ?? null;
  return item.createdAt ?? item.created_at ?? null;
}

function unwrapIntegrationDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    if (value.$date != null) return unwrapIntegrationDate(value.$date);
    if (value.$numberLong != null) return unwrapIntegrationDate(value.$numberLong);
    if (typeof value.toISOString === 'function') return value.toISOString();
  }
  return value;
}

function integrationTokenExpiry(item) {
  if (!item || typeof item !== 'object') return null;
  return unwrapIntegrationDate(
    item.token_expiry ??
      item.tokenExpiry ??
      item.token_expires_at ??
      item.expires_at ??
      null
  );
}

function parseIntegrationMoment(value) {
  const raw = unwrapIntegrationDate(value);
  if (raw == null || raw === '') return null;
  const asString = String(raw).trim();
  if (/^\d{10,13}$/.test(asString)) {
    const n = Number(asString);
    const ms = asString.length >= 13 ? n : n * 1000;
    const unix = moment(ms);
    return unix.isValid() ? unix : null;
  }
  const m = moment(raw);
  return m.isValid() ? m : null;
}

function formatIntegrationTimestamp(value) {
  const when = parseIntegrationMoment(value);
  return when ? when.format('MM-DD-YYYY h:mm a') : '';
}

function formatIntegrationRelative(value) {
  const when = parseIntegrationMoment(value);
  if (!when) return '';
  const seconds = Math.max(0, moment().diff(when, 'seconds'));
  if (seconds < 60) return `${Math.max(1, seconds)} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  return when.fromNow();
}

/** Remaining time until expiry, e.g. `3 hr 2 min`. */
function formatIntegrationExpiryRemaining(value) {
  const when = parseIntegrationMoment(value);
  if (!when) return '';
  const remainingMs = when.diff(moment());
  if (remainingMs <= 0) return 'Expired';

  const duration = moment.duration(remainingMs);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const mins = duration.minutes();
  const secs = duration.seconds();
  const parts = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hr`);
  if (mins > 0) parts.push(`${mins} min`);
  if (parts.length === 0) parts.push(`${Math.max(1, secs)} sec`);
  return parts.join(' ');
}

function isShopifyStoreType(item) {
  return String(item?.store_type || item?.storeType || '').toLowerCase() === 'shopify';
}

const Integration = () => {
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
  } = useSelector((state) => state.integration);
  const { canCreate, canEdit, canDelete } = usePermissions('integration');
  useRequireModuleAccess('integration');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [refreshingTokens, setRefreshingTokens] = useState(false);
  const searchTimeoutRef = useRef(null);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    'integrations',
    INTEGRATION_COLUMNS
  );

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchIntegrations(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

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

  const handleDelete = async (integrationId, integrationName) => {
    if (window.confirm(`Delete "${integrationName || 'this integration'}"?`)) {
      await dispatch(deleteIntegration(integrationId));
    }
  };

  const handleRefreshToken = async () => {
    if (refreshingTokens) return;
    setRefreshingTokens(true);
    try {
      const result = await generateIntegrationTokensCronRequest();
      const message =
        (result && typeof result === 'object' && (result.message || result.msg)) ||
        'Shopify token refreshed.';
      toast.success(typeof message === 'string' ? message : 'Shopify token refreshed.');
      const params = { page: pagination.page, limit: pagination.limit };
      if (searchTerm) params.search = searchTerm;
      if (sort.sortBy) {
        params.sortBy = sort.sortBy;
        params.sortOrder = sort.sortOrder;
      }
      dispatch(fetchIntegrations(params));
    } catch (err) {
      toast.error(err?.message || 'Failed to refresh Shopify token.');
    } finally {
      setRefreshingTokens(false);
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
    };
  }, []);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Integrations</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Connect external stores and sales channels.</p>
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
                        placeholder="Search integrations..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <ColumnVisibilityMenu
                      columns={INTEGRATION_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id="integrationColumnVisibilityMenu"
                    />
                    {canCreate && <AddNewButton to="/integration/add" label="Add Integration" />}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading integrations…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="integration-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      {isVisible('image') ? <th className="list-col-product-img">Image</th> : null}
                      <th>Store name</th>
                      {isVisible('store_type') ? sortableTh('store_type', 'Store type') : null}
                      {isVisible('city') ? <th>City</th> : null}
                      {isVisible('state') ? <th>State</th> : null}
                      {isVisible('email') ? <th>Email</th> : null}
                      {isVisible('phone') ? <th>Phone</th> : null}
                      {isVisible('url') ? <th>URL</th> : null}
                      {isVisible('token') ? sortableTh('token_expiry', 'Expiry') : null}
                      {isVisible('dates') ? sortableTh('createdAt', 'Created / Updated') : null}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount} className="text-center text-sm font-weight-normal p-4">
                          No integrations found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const id = integrationIdFromRecord(item);
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const logoSrc = pickIntegrationStoreLogoUrl(item);
                        const displayName = integrationNameFromRecord(item);
                        const created = integrationTimestamp(item, 'createdAt');
                        const updated = integrationTimestamp(item, 'updatedAt');
                        const createdLabel = formatIntegrationTimestamp(created);
                        const updatedAbsolute = formatIntegrationTimestamp(updated);
                        const updatedLabel = formatIntegrationRelative(updated);
                        const tokenExpiryAt = integrationTokenExpiry(item);
                        const tokenExpiryAbsolute = formatIntegrationTimestamp(tokenExpiryAt);
                        const tokenExpiryLabel = formatIntegrationExpiryRemaining(tokenExpiryAt);
                        const tokenExpired = tokenExpiryLabel === 'Expired';
                        const showRefreshUnderExpiry = tokenExpired && isShopifyStoreType(item);
                        return (
                          <tr key={id || index}>
                            <td>{seriesNumber}</td>
                            {isVisible('image') ? (
                              <td>
                                {logoSrc ? (
                                  <img
                                    src={logoSrc}
                                    alt={displayName}
                                    className="list-product-thumb"
                                  />
                                ) : (
                                  <div className="list-product-thumb list-product-thumb--empty">
                                    <i className="fas fa-image text-muted" aria-hidden="true" />
                                  </div>
                                )}
                              </td>
                            ) : null}
                            <td>{displayName}</td>
                            {isVisible('store_type') ? (
                              <td>{storeTypeLabel(item.store_type || item.storeType)}</td>
                            ) : null}
                            {isVisible('city') ? <td>{item.city || '-'}</td> : null}
                            {isVisible('state') ? <td>{item.state || '-'}</td> : null}
                            {isVisible('email') ? <td>{item.email || '-'}</td> : null}
                            {isVisible('phone') ? <td>{item.phone || '-'}</td> : null}
                            {isVisible('url') ? (
                              <td>
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                                    {item.url}
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </td>
                            ) : null}
                            {isVisible('token') ? (
                              <td className="text-sm list-col-date" title={tokenExpiryAbsolute || undefined}>
                                {tokenExpiryLabel ? (
                                  <div className="d-flex flex-column align-items-start gap-1">
                                    <span className="text-nowrap">{tokenExpiryLabel}</span>
                                    {showRefreshUnderExpiry ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info mb-0"
                                        onClick={handleRefreshToken}
                                        disabled={refreshingTokens}
                                      >
                                        {refreshingTokens ? 'Refreshing…' : 'Refresh Token'}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                            ) : null}
                            {isVisible('dates') ? (
                              <td className="text-sm list-col-date">
                                {createdLabel || updatedLabel ? (
                                  <div className="oms-dates-cell">
                                    <div
                                      className="oms-dates-cell__created text-nowrap"
                                      title={createdLabel || undefined}
                                    >
                                      {createdLabel || '—'}
                                    </div>
                                    <div
                                      className="oms-dates-cell__updated text-nowrap"
                                      title={updatedAbsolute || undefined}
                                    >
                                      {updatedLabel ? `Updated ${updatedLabel}` : '—'}
                                    </div>
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                            ) : null}
                            <td>
                              <div className="d-flex gap-1">
                                {canEdit && (
                                  <button
                                    className="btn btn-sm btn-primary mb-0"
                                    onClick={() => navigate(`/integration/edit/${id}`)}
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className="btn btn-sm btn-danger mb-0"
                                    onClick={() => handleDelete(id, displayName)}
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

export default Integration;
