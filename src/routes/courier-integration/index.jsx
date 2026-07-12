import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchCouriers,
  deleteCourier,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/courier/courierSlice.js';
import { pickCourierId } from '../../features/courier/courierAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

const typeLabel = (type) => {
  const t = String(type || '').toLowerCase();
  if (t === 'tcs') return 'TCS';
  if (t === 'leopard') return 'Leopard';
  return type || '—';
};

const CourierIntegration = () => {
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
  } = useSelector((state) => state.courier);
  const { canCreate, canEdit, canDelete } = usePermissions('courier-integration');
  useRequireModuleAccess('courier-integration');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchCouriers(params));
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

  const handleDelete = async (courierId, label) => {
    if (!window.confirm(`Delete courier integration "${label || 'this record'}"?`)) return;
    try {
      await dispatch(deleteCourier(courierId)).unwrap();
      toast.success('Courier integration deleted.');
    } catch (err) {
      toast.error(err?.message || err || 'Failed to delete courier integration');
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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Courier Integration</h5>
                  <p className="text-sm mb-0 text-muted">TCS and Leopard courier API credentials</p>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
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
                        placeholder="Search couriers…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <AddNewButton to="/courier-integration/add" label="Add Courier" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading courier integrations…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="courier-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('type')}
                        onDoubleClick={() => handleSort('type', true)}
                      >
                        Type
                        {renderSortIcon('type')}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('url')}
                        onDoubleClick={() => handleSort('url', true)}
                      >
                        URL
                        {renderSortIcon('url')}
                      </th>
                      <th>Login</th>
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
                        <td colSpan="7" className="text-center text-sm font-weight-normal p-4">
                          No courier integrations found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const id = pickCourierId(item);
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        return (
                          <tr key={id || index}>
                            <td>{seriesNumber}</td>
                            <td>
                              <span className="badge bg-gradient-info text-xxs mb-0">
                                {typeLabel(item.type)}
                              </span>
                            </td>
                            <td
                              className="text-sm list-cell-truncate"
                              title={item.url || undefined}
                              style={{ maxWidth: 220 }}
                            >
                              {item.url || '—'}
                            </td>
                            <td className="text-sm">{item.login || '—'}</td>
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
                                ? moment(item.createdAt).format('DD MMM YYYY h:mm a')
                                : '—'}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary mb-0"
                                    onClick={() => navigate(`/courier-integration/edit/${id}`)}
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger mb-0"
                                    onClick={() =>
                                      handleDelete(id, `${typeLabel(item.type)} · ${item.login || id}`)
                                    }
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

export default CourierIntegration;
