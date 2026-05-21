import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import moment from 'moment';
import {
  fetchAdjustments,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/adjustments/adjustmentsSlice.js';
import {
  formatAdjustmentType,
  getAdjustmentProductName,
} from '../../features/adjustments/adjustmentsAPI.js';

const AdjustmentIndex = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.adjustments);
  const loading = listStatus === 'loading';
  const error = listError;
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
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
    dispatch(fetchAdjustments(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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
        dispatch(setSort({ sortBy, sortOrder: 'asc' }));
        sortClickTimeoutRef.current = null;
      }, 250);
    }
  };

  const renderSortIcon = (column) => {
    if (sort.sortBy !== column) return null;
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up ms-1" aria-hidden="true"></i>
    ) : (
      <i className="fas fa-sort-down ms-1" aria-hidden="true"></i>
    );
  };

  const loadAdjustments = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchAdjustments(params));
  };

  const PaginationControls = () => {
    if (pagination.totalPages <= 1 && pagination.total <= pagination.limit) return null;
    return (
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <label className="text-sm mb-0" htmlFor="adjustment-limit">
            Show
          </label>
          <select
            id="adjustment-limit"
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
          <span className="text-sm text-muted">
            of {pagination.total} adjustment{pagination.total !== 1 ? 's' : ''}
          </span>
        </div>
        <nav aria-label="Adjustments pagination">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
              >
                First
              </button>
            </li>
            <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Prev
              </button>
            </li>
            <li className="page-item disabled">
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

  const colCount = 7;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Stock adjustments</h5>
                  <p className="text-sm mb-0 text-muted">
                    List from <code className="text-xs">GET /adjustment/get-all-active</code>
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
                        placeholder="Search adjustments…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <NavLink className="btn btn-primary btn-sm" to="/adjustments/add">
                      <i className="fas fa-plus me-1"></i>
                      Add adjustment
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
                    <p className="mb-0">Loading adjustments…</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    <p className="mb-2">{error}</p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={loadAdjustments}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush table-sm align-middle">
                    <thead className="thead-light">
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('quantity')}
                          onDoubleClick={() => handleSort('quantity', true)}
                        >
                          Quantity
                          {renderSortIcon('quantity')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('type')}
                          onDoubleClick={() => handleSort('type', true)}
                        >
                          Type
                          {renderSortIcon('type')}
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
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center text-sm p-4 text-muted">
                            No adjustments found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const description =
                            item.description != null ? String(item.description) : '';
                          const typeBadge =
                            item.type === 'add'
                              ? 'bg-success'
                              : item.type === 'remove'
                                ? 'bg-warning text-dark'
                                : 'bg-secondary';
                          return (
                            <tr key={rowKey}>
                              <td className="text-sm text-muted">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {getAdjustmentProductName(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.quantity != null
                                  ? Number(item.quantity).toLocaleString()
                                  : '—'}
                              </td>
                              <td className="text-sm">
                                <span className={`badge ${typeBadge}`}>
                                  {formatAdjustmentType(item.type)}
                                </span>
                              </td>
                              <td
                                className="text-sm font-weight-normal"
                                style={{ maxWidth: '220px' }}
                                title={description}
                              >
                                {description ? (
                                  <span
                                    className="text-truncate d-inline-block"
                                    style={{ maxWidth: '210px' }}
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
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {!loading && !error && <PaginationControls />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentIndex;
