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
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { DEBUG } from '../../config/env.js';
import { integrationIdFromRecord, integrationNameFromRecord, storeTypeLabel } from './integrationForm.js';

/** Integrations table columns. `sno`, `store_name`, `actions` are always visible. */
const INTEGRATION_COLUMNS = [
  { key: 'sno', label: 'S.No', alwaysVisible: true },
  { key: 'image', label: 'Image' },
  { key: 'store_name', label: 'Store name', alwaysVisible: true },
  { key: 'store_type', label: 'Store type' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'url', label: 'URL' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

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
            <div className="card-header pb-0">
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
                      {isVisible('createdAt') ? sortableTh('createdAt', 'Created At') : null}
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
                            {isVisible('createdAt') ? (
                              <td>
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '-'}
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
