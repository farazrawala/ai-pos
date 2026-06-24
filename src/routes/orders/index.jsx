import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaCloudArrowUp } from 'react-icons/fa6';
import {
  fetchOrders,
  deleteOrder,
  setSearch,
  setDateFilters,
  clearDateFilters,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/orders/ordersSlice.js';
import {
  pickInvoiceRouteId,
  pickOrderDocumentId,
  getNoOfItemsDisplay,
} from '../../features/orders/ordersAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import FetchOrdersModal from '../../components/order/FetchOrdersModal.jsx';
import SyncOrdersModal from '../../components/order/SyncOrdersModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { DEBUG } from '../../config/env.js';
import { toast } from '../../utils/toast.js';

const getOrderStatusDisplay = (row) => {
  if (!row || typeof row !== 'object') return '';
  const v = row.order_status ?? row.orderStatus;
  if (v == null || String(v).trim() === '') return '';
  return String(v).trim();
};

const getOrderItemsTotalDisplay = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const raw =
    row.order_items_total ??
    row.orderItemsTotal ??
    row.items_total ??
    row.itemsTotal;
  if (raw == null || raw === '') return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const orderDisplayStatus = (row) => {
  const orderStatus = getOrderStatusDisplay(row);
  if (orderStatus) return orderStatus;
  const s = row?.status;
  if (s == null || String(s).trim() === '') return '—';
  return String(s).trim();
};

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'posted' || s === 'delivered') {
    return 'bg-gradient-success';
  }
  if (s === 'pending' || s === 'draft' || s === 'placed') return 'bg-gradient-warning';
  if (s === 'cancelled' || s === 'void' || s === 'refunded') return 'bg-gradient-danger';
  return 'bg-gradient-secondary';
};

const Orders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    filters,
    sort,
    deleteStatus,
  } = useSelector((state) => state.orders);
  const { canCreate, canEdit, canDelete } = usePermissions('orders');
  useRequireModuleAccess('orders');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  const [editLoadingId, setEditLoadingId] = useState('');
  const [fetchOrdersModalOpen, setFetchOrdersModalOpen] = useState(false);
  const [syncOrdersModalOpen, setSyncOrdersModalOpen] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchOrders(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    filters.startDate,
    filters.endDate,
    sort.sortBy,
    sort.sortOrder,
  ]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    setLocalStartDate(filters.startDate || '');
    setLocalEndDate(filters.endDate || '');
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);


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

  const applyDateFilters = () => {
    if (localStartDate && localEndDate && localStartDate > localEndDate) {
      toast.error('From date cannot be later than to date.');
      return;
    }
    dispatch(
      setDateFilters({
        startDate: localStartDate,
        endDate: localEndDate,
      })
    );
  };

  const resetDateFilters = () => {
    setLocalStartDate('');
    setLocalEndDate('');
    dispatch(clearDateFilters());
  };

  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh column={column} label={label} sort={sort} onSort={handleSort} className={className} />
  );

  const handleOpenInvoice = async (row) => {
    const rowKey = String(row._id || row.id || row.order_no || row.orderNo || '');
    setEditLoadingId(rowKey);
    try {
      const invoiceId = pickInvoiceRouteId(row);

      if (!invoiceId) {
        console.error('[Orders module] open invoice: could not resolve invoice id', { row });
        window.alert('Could not open invoice: missing order / invoice reference.');
        return;
      }

      navigate(`/pos/invoice/${encodeURIComponent(invoiceId)}`);
    } catch (err) {
      console.error('[Orders module] open invoice failed', err);
      window.alert(err?.message || 'Failed to load order for this line.');
    } finally {
      setEditLoadingId('');
    }
  };

  const handleDelete = async (row) => {
    const orderId = pickOrderDocumentId(row);
    if (!orderId) {
      toast.error('Could not delete: missing order id.');
      return;
    }
    const orderNo = row.order_no || row.orderNo || orderId;
    if (
      !window.confirm(`Delete order "${orderNo}"? This action cannot be undone.`)
    ) {
      return;
    }
    const result = await dispatch(deleteOrder(orderId));
    if (deleteOrder.fulfilled.match(result)) {
      toast.success('Order deleted successfully.');
    } else {
      toast.error(result.payload || 'Failed to delete order.');
    }
    dispatch(clearDeleteStatus());
  };

  const refreshOrderList = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchOrders(params));
  };

  const handleFetchOrdersSaved = () => {
    toast.success('Order fetch process queued successfully!');
    refreshOrderList();
  };

  const handleSyncOrdersSaved = () => {
    toast.success('Order sync processes queued successfully!');
    refreshOrderList();
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Orders</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">Server-side pagination and search.</p>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search orders…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search orders"
                      />
                    </div>
                    {canCreate ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setFetchOrdersModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" aria-hidden="true" />
                          Fetch orders
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setSyncOrdersModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync orders
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-3 pb-0">
              <div className="row g-2 align-items-end mb-3">
                <div className="col-md-3 col-sm-6">
                  <label className="form-label mb-1 text-sm" htmlFor="orders-from-date">
                    From date
                  </label>
                  <input
                    id="orders-from-date"
                    type="date"
                    className="form-control form-control-sm"
                    value={localStartDate}
                    onChange={(e) => setLocalStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3 col-sm-6">
                  <label className="form-label mb-1 text-sm" htmlFor="orders-to-date">
                    To date
                  </label>
                  <input
                    id="orders-to-date"
                    type="date"
                    className="form-control form-control-sm"
                    value={localEndDate}
                    onChange={(e) => setLocalEndDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-0"
                    onClick={applyDateFilters}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm mb-0"
                    onClick={resetDateFilters}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--orders"
                loading={loading}
                loadingLabel="Loading orders…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="orders-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        {sortableTh('order_no', 'Order no')}
                        {sortableTh('name', 'Customer', 'list-col-truncate')}
                        {sortableTh('email', 'Email', 'list-col-truncate')}
                        {sortableTh('phone', 'Phone', 'list-col-truncate-sm')}
                        {sortableTh('no_of_items', 'Items', 'text-center')}
                        {sortableTh('order_items_total', 'Total', 'text-end list-col-amount')}
                        {sortableTh('order_status', 'Status')}
                        {sortableTh('createdAt', 'Created', 'list-col-date')}
                        <th className="text-end list-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-5 text-muted">
                            No orders found. Try adjusting your search or date range.
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const orderNo = item.order_no || item.orderNo || '—';
                          const statusVal = orderDisplayStatus(item);
                          const rowKey = String(item._id || item.id || index);
                          const isRowLoading = editLoadingId === rowKey;
                          const created = item.createdAt ?? item.created_at;
                          const updated = item.updatedAt ?? item.updated_at;
                          const customerName = item.name || '—';
                          const email = item.email || '—';
                          const phone = item.phone || '—';
                          const total = getOrderItemsTotalDisplay(item);
                          return (
                            <tr key={key}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td className="text-sm font-weight-bold text-dark">{orderNo}</td>
                              <td className="text-sm list-cell-truncate" title={customerName !== '—' ? customerName : undefined}>
                                {customerName}
                              </td>
                              <td className="text-sm list-cell-truncate" title={email !== '—' ? email : undefined}>
                                {email}
                              </td>
                              <td className="text-sm list-cell-truncate-sm text-nowrap">{phone}</td>
                              <td className="text-sm text-center">{getNoOfItemsDisplay(item)}</td>
                              <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                                {total !== '—' ? `PKR ${total}` : total}
                              </td>
                              <td className="text-sm">
                                <span className={`badge text-xxs ${statusBadgeClass(statusVal)}`}>
                                  {String(statusVal)}
                                </span>
                              </td>
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
                              <td className="text-end">
                                <div className="list-table-actions">
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary mb-0"
                                      disabled={isRowLoading}
                                      onClick={() => handleOpenInvoice(item)}
                                    >
                                      {isRowLoading ? 'Opening…' : 'View'}
                                    </button>
                                  ) : null}
                                  {canDelete ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger mb-0"
                                      onClick={() => handleDelete(item)}
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                  {!canEdit && !canDelete ? (
                                    <span className="text-muted">—</span>
                                  ) : null}
                                </div>
                              </td>
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

      <FetchOrdersModal
        open={fetchOrdersModalOpen}
        onClose={() => setFetchOrdersModalOpen(false)}
        onSaved={handleFetchOrdersSaved}
      />

      <SyncOrdersModal
        open={syncOrdersModalOpen}
        onClose={() => setSyncOrdersModalOpen(false)}
        onSaved={handleSyncOrdersSaved}
      />
    </div>
  );
};

export default Orders;
