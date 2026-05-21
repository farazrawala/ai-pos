import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import moment from 'moment';
import {
  fetchAmountTransfers,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/amountTransfers/amountTransfersSlice.js';
import { accountDisplayName } from '../../features/amountTransfers/amountTransfersAPI.js';

const AmountTransferIndex = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.amountTransfers);
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
    dispatch(fetchAmountTransfers(params));
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

  const loadTransfers = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchAmountTransfers(params));
  };

  const PaginationControls = () => {
    if (pagination.totalPages <= 1 && pagination.total <= pagination.limit) return null;
    return (
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <label className="text-sm mb-0" htmlFor="amount-transfer-limit">
            Show
          </label>
          <select
            id="amount-transfer-limit"
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
            of {pagination.total} transfer{pagination.total !== 1 ? 's' : ''}
          </span>
        </div>
        <nav aria-label="Amount transfers pagination">
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
                  <h5 className="mb-0">Amount transfers</h5>
                  <p className="text-sm mb-0 text-muted">
                    List from{' '}
                    <code className="text-xs">
                      GET /amount_transfer/get-all-active?populate=from_account_id,to_account_id
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
                        placeholder="Search transfers…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <NavLink className="btn btn-primary btn-sm" to="/amount-transfers/add">
                      <i className="fas fa-plus me-1"></i>
                      Add transfer
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
                    <p className="mb-0">Loading amount transfers…</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    <p className="mb-2">{error}</p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={loadTransfers}
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
                        <th>From account</th>
                        <th>To account</th>
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
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center text-sm p-4 text-muted">
                            No amount transfers found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const rowId = item._id || item.id;
                          const description =
                            item.description != null ? String(item.description) : '';
                          return (
                            <tr key={rowKey}>
                              <td className="text-sm text-muted">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {accountDisplayName(item.from_account_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {accountDisplayName(item.to_account_id)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.amount != null
                                  ? Number(item.amount).toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })
                                  : '—'}
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
                              <td className="text-sm text-muted text-nowrap">
                                {item.createdAt
                                  ? moment(item.createdAt).format('YYYY-MM-DD HH:mm')
                                  : '—'}
                              </td>
                              <td className="text-sm text-end">
                                {rowId ? (
                                  <NavLink
                                    className="btn btn-sm btn-outline-primary"
                                    to={`/amount-transfers/edit/${rowId}`}
                                  >
                                    Edit
                                  </NavLink>
                                ) : (
                                  '—'
                                )}
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

export default AmountTransferIndex;
