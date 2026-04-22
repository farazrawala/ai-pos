import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchPurchaseOrders,
  setSearch,
  setPage,
  setLimit,
  setSort,
  setFilterPurchaseItemId,
} from '../../features/purchaseOrders/purchaseOrdersSlice.js';
import { PURCHASE_ITEM_QUERY_KEY } from '../../features/purchaseOrders/purchaseOrdersAPI.js';

const poRef = (row) =>
  row?.purchase_order_no ??
  row?.po_no ??
  row?.order_no ??
  row?.reference ??
  row?.invoice_no ??
  '—';

const poStatus = (row) =>
  row?.order_status ?? row?.status ?? row?.purchase_order_status ?? row?.po_status ?? '—';

const poSupplier = (row) =>
  row?.supplier_name ??
  row?.supplier?.name ??
  row?.vendor_name ??
  (row?.supplier_id != null ? String(row.supplier_id) : null) ??
  '—';

const poCreated = (row) => row?.createdAt ?? row?.created_at ?? null;

const PurchaseOrders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    filterPurchaseItemId,
  } = useSelector((state) => state.purchaseOrders);

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localFilterId, setLocalFilterId] = useState(filterPurchaseItemId || '');
  const searchTimeoutRef = useRef(null);
  const filterTimeoutRef = useRef(null);
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
    if (filterPurchaseItemId && String(filterPurchaseItemId).trim()) {
      params.filterPurchaseItemId = String(filterPurchaseItemId).trim();
    }
    dispatch(fetchPurchaseOrders(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    sort.sortBy,
    sort.sortOrder,
    filterPurchaseItemId,
  ]);

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

  const handleFilterIdChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalFilterId(value);
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
      filterTimeoutRef.current = setTimeout(() => {
        dispatch(setFilterPurchaseItemId(value));
      }, 500);
    },
    [dispatch]
  );

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    setLocalFilterId(filterPurchaseItemId || '');
  }, [filterPurchaseItemId]);

  useEffect(() => {
    if (error) {
      console.error('[Purchase order module] Failed to fetch purchase order list', error);
    }
  }, [error]);

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
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }} />;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }} />
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }} />
    );
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                    <h5 className="mb-0">Purchase orders</h5>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-shrink-0"
                      onClick={() => navigate('/purchase-orders/add')}
                    >
                      <i className="fas fa-plus me-1" aria-hidden="true" />
                      Create purchase order
                    </button>
                  </div>
                  <p className="text-sm mb-0 text-muted">
                    Server-side pagination and search —{' '}
                    <code className="small">GET /purchase_order/get-purchase-order-by-purchase-item</code>
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex flex-column flex-md-row justify-content-md-end align-items-stretch align-items-md-center gap-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '100%' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true" />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search purchase orders"
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ maxWidth: '100%' }}>
                      <span className="input-group-text text-body text-nowrap" title={PURCHASE_ITEM_QUERY_KEY}>
                        Item id
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Optional ${PURCHASE_ITEM_QUERY_KEY}`}
                        value={localFilterId}
                        onChange={handleFilterIdChange}
                        aria-label="Filter by purchase item id"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <PaginationControls />

              <div className="table-responsive">
                {loading && (
                  <div className="text-center p-4">
                    <p className="mb-0">Loading purchase orders…</p>
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
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('purchase_order_no')}
                          onDoubleClick={() => handleSort('purchase_order_no', true)}
                        >
                          Reference
                          {renderSortIcon('purchase_order_no')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('order_status')}
                          onDoubleClick={() => handleSort('order_status', true)}
                        >
                          Status
                          {renderSortIcon('order_status')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('supplier_name')}
                          onDoubleClick={() => handleSort('supplier_name', true)}
                        >
                          Supplier
                          {renderSortIcon('supplier_name')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                        <th className="text-muted small">Id</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-sm p-4 text-muted">
                            <p className="mb-3">
                              No purchase orders found. Try adjusting search or optional purchase item
                              filter.
                            </p>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/purchase-orders/add')}
                            >
                              <i className="fas fa-plus me-1" aria-hidden="true" />
                              Create purchase order
                            </button>
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const id = item._id ?? item.id ?? '';
                          const created = poCreated(item);
                          return (
                            <tr key={id || index}>
                              <td className="text-sm">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{poRef(item)}</td>
                              <td className="text-sm font-weight-normal">
                                <span className="badge bg-secondary text-wrap">{String(poStatus(item))}</span>
                              </td>
                              <td className="text-sm font-weight-normal">{poSupplier(item)}</td>
                              <td className="text-sm font-weight-normal">
                                {created ? moment(created).format('MM-DD-YYYY h:mm a') : '—'}
                              </td>
                              <td className="text-sm font-weight-normal text-muted text-break" style={{ maxWidth: '120px' }}>
                                {id || '—'}
                              </td>
                              <td className="text-sm">
                                {id ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => navigate(`/purchase-orders/edit/${encodeURIComponent(id)}`)}
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <span className="text-muted">—</span>
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

export default PurchaseOrders;
