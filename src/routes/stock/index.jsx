import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchStockMovements,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/stockMovement/stockMovementSlice.js';
import {
  getProductLabel,
  getProductSku,
  getWarehouseLabel,
} from '../../features/stockMovement/stockMovementAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const StockListing = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.stockMovement);
  const { canView } = usePermissions('warehouse');

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
    dispatch(fetchStockMovements(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (error) {
      console.error('[Stock movement module] Failed to fetch stock movement list', error);
    }
  }, [error]);

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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <h5 className="mb-0">Stock movements</h5>
                  <p className="text-sm mb-0 text-muted">
                    <code className="small">
                      GET /stock_movement/get-all-active?populate=product_id,warehouse_id
                    </code>
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search stock movements"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              {!loading && !error && pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center flex-wrap">
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
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page === 1}
                      onClick={() => dispatch(setPage(pagination.page - 1))}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
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
                {loading && (
                  <div className="text-center p-4">
                    <p className="mb-0">Loading stock movements…</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th>Product</th>
                        <th>SKU / code</th>
                        <th>Warehouse</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('type')}
                          onDoubleClick={() => handleSort('type', true)}
                        >
                          Type
                          {renderSortIcon('type')}
                        </th>
                        <th
                          className="text-end"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('quantity')}
                          onDoubleClick={() => handleSort('quantity', true)}
                        >
                          Qty
                          {renderSortIcon('quantity')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('direction')}
                          onDoubleClick={() => handleSort('direction', true)}
                        >
                          Direction
                          {renderSortIcon('direction')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('reason')}
                          onDoubleClick={() => handleSort('reason', true)}
                        >
                          Reason
                          {renderSortIcon('reason')}
                        </th>
                        <th>Reference</th>
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
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="text-center text-sm font-weight-normal p-4">
                            No stock movements found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const dir = String(item.direction || '').toLowerCase();
                          return (
                            <tr key={key}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{getProductLabel(item)}</td>
                              <td className="text-sm font-weight-normal">{getProductSku(item)}</td>
                              <td className="text-sm font-weight-normal">{getWarehouseLabel(item)}</td>
                              <td className="text-sm font-weight-normal">
                                {item.type ? (
                                  <span className="badge bg-secondary">{item.type}</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal text-end">
                                {item.quantity != null ? item.quantity : '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {dir ? (
                                  <span
                                    className={`badge ${
                                      dir === 'in' ? 'bg-success' : dir === 'out' ? 'bg-warning text-dark' : 'bg-secondary'
                                    }`}
                                  >
                                    {item.direction}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">{item.reason || '—'}</td>
                              <td className="text-sm font-weight-normal text-break" style={{ maxWidth: '140px' }}>
                                {item.reference_id || '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.status ? (
                                  <span
                                    className={`badge ${
                                      String(item.status).toLowerCase() === 'active'
                                        ? 'bg-success'
                                        : 'bg-secondary'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockListing;
