import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchPaymentReceipts,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/paymentReceipts/paymentReceiptsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { formatTransactionCreatedByLabel } from '../../components/ledger/ledgerTransactionMapper.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

function formatPKR(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PaymentReceiptsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.paymentReceipts);
  const { canView, canEdit } = usePermissions('accounts');

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

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
    dispatch(fetchPaymentReceipts(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (error) {
      console.error('[Payment receipt module] Failed to fetch payment receipt list', error);
    }
  }, [error]);

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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
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
                Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Payment receipts</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Active receipts from the server (paginated list).</p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 flex-wrap mt-2 mt-md-0">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search receipts..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <Link to="/accounts/payments" className="btn btn-outline-primary btn-sm">
                      <i className="ni ni-fat-add me-1"></i>
                      Record payment
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />

              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p>Loading payment receipts...</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    Error loading data: {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush" id="datatable-payment-receipts">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('transaction_number')}
                          onDoubleClick={() => handleSort('transaction_number', true)}
                        >
                          Transaction #
                          {renderSortIcon('transaction_number')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('amount')}
                          onDoubleClick={() => handleSort('amount', true)}
                        >
                          Amount
                          {renderSortIcon('amount')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('payment_type')}
                          onDoubleClick={() => handleSort('payment_type', true)}
                        >
                          Type
                          {renderSortIcon('payment_type')}
                        </th>
                        <th>Payment mode</th>
                        <th>User</th>
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
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
                            No payment receipts found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          return (
                            <tr key={item._id || index}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal font-monospace">
                                {item.transaction_number || '—'}
                              </td>
                              <td className="text-sm font-weight-normal">{formatPKR(item.amount)}</td>
                              <td className="text-sm font-weight-normal">
                                <span className="badge bg-gradient-info">{item.payment_type || '—'}</span>
                              </td>
                              <td className="text-sm font-weight-normal text-break">
                                {formatTransactionCreatedByLabel(item.payment_mode)}
                              </td>
                              <td className="text-sm font-weight-normal text-break">
                                {formatTransactionCreatedByLabel(
                                  item.user ?? item.user_id
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <span
                                  className={`badge ${
                                    item.status === 'active' ? 'bg-success' : 'bg-secondary'
                                  }`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('YYYY-MM-DD HH:mm')
                                  : '—'}
                              </td>
                              <td className="text-sm font-weight-normal text-end">
                                {canEdit ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() =>
                                      navigate(`/payment-receipts/edit/${item._id}`, {
                                        state: { receipt: item },
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <span className="text-muted text-xs">—</span>
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

              <PaginationControls />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceiptsList;
