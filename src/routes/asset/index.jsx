import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import moment from 'moment';
import { fetchAssets, setSearch, setPage, setLimit, setSort } from '../../features/assets/assetsSlice.js';
import { toast } from '../../utils/toast.js';

const assetUserDisplayName = (userRef) => {
  if (userRef == null || userRef === '') return '—';
  if (typeof userRef === 'object') {
    const name = String(userRef.name ?? '').trim();
    if (name) return name;
    const email = String(userRef.email ?? '').trim();
    if (email) return email;
    return '—';
  }
  return '—';
};

const assetAccountDisplayName = (accountRef) => {
  if (accountRef == null || accountRef === '') return '—';
  if (typeof accountRef === 'object') {
    const name = String(accountRef.name ?? accountRef.account_name ?? '').trim();
    if (name) return name;
    const code = String(accountRef.code ?? accountRef.account_code ?? '').trim();
    if (code) return code;
    return '—';
  }
  return '—';
};

const formatAssetType = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const AssetIndex = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.assets);
  const loading = listStatus === 'idle' || listStatus === 'loading';
  const error = listError;
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  const loadAssets = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchAssets(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    sort.sortBy,
    sort.sortOrder,
  ]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

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

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

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
    } else {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
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

  useEffect(() => {
    if (error) {
      console.error('[Asset module] Failed to fetch asset list', error);
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  const PaginationControls = () => {
    if (loading || error || pagination.total === 0) return null;
    return (
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center flex-wrap">
          <span className="text-sm text-muted me-2">Show:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={pagination.limit}
            onChange={handleLimitChange}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-muted ms-2">
            Showing {startItem} to {endItem} of {pagination.total} entries
          </span>
        </div>
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
              >
                First
              </button>
            </li>
            <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
            </li>
            <li className="page-item active">
              <span className="page-link">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
            </li>
            <li
              className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}
            >
              <button
                type="button"
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
                type="button"
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

  const colCount = 10;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Assets</h5>
                  <p className="text-sm mb-0 text-muted">
                    List from{' '}
                    <code className="text-xs">
                      GET /assets/get-all-active?populate=account_id,user_id
                    </code>
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search assets…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <NavLink className="btn btn-primary btn-sm" to="/assets/add">
                      <i className="fas fa-plus me-1"></i>
                      Add asset
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />
              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p className="mb-0">Loading assets…</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    <p className="mb-2">{error}</p>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={loadAssets}>
                      Retry
                    </button>
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush table-sm align-middle">
                    <thead className="thead-light">
                      <tr>
                        <th>#</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th>User</th>
                        <th>Payment type</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('asset_type')}
                          onDoubleClick={() => handleSort('asset_type', true)}
                        >
                          Asset type
                          {renderSortIcon('asset_type')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('amount')}
                          onDoubleClick={() => handleSort('amount', true)}
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </th>
                        <th>Description</th>
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
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center text-sm p-4 text-muted">
                            No assets found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const description =
                            item.description != null ? String(item.description) : '';
                          return (
                            <tr key={rowKey}>
                              <td className="text-sm text-muted">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{item.name || '—'}</td>
                              <td className="text-sm font-weight-normal">
                                {assetUserDisplayName(item.user_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {assetAccountDisplayName(item.account_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <span className="badge bg-gradient-info">
                                  {formatAssetType(item.asset_type)}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.amount != null ? Number(item.amount).toLocaleString() : '—'}
                              </td>
                              <td
                                className="text-sm font-weight-normal"
                                style={{ maxWidth: '200px' }}
                                title={description}
                              >
                                {description ? (
                                  <span
                                    className="text-truncate d-inline-block"
                                    style={{ maxWidth: '190px' }}
                                  >
                                    {description}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm">
                                <span
                                  className={`badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                              <td className="text-sm text-muted text-nowrap">
                                {item.createdAt
                                  ? moment(item.createdAt).format('YYYY-MM-DD HH:mm')
                                  : '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() =>
                                    navigate(`/assets/edit/${item._id || item.id}`)
                                  }
                                >
                                  Edit
                                </button>
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

export default AssetIndex;
