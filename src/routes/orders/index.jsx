import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaCloudArrowUp } from 'react-icons/fa6';
import {
  fetchOrders,
  deleteOrder,
  setSearch,
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

const Orders = () => {
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
  } = useSelector((state) => state.orders);
  const { canCreate, canEdit, canDelete } = usePermissions('orders');
  useRequireModuleAccess('orders');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [editLoadingId, setEditLoadingId] = useState('');
  const [fetchOrdersModalOpen, setFetchOrdersModalOpen] = useState(false);
  const [syncOrdersModalOpen, setSyncOrdersModalOpen] = useState(false);
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchOrders(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  const refreshOrderList = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
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
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Orders</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">
                      List uses <code>order/get-order-by-order-item</code>. Invoice edit:{' '}
                      <code>order/get-order-by-order-no/:order_id</code>. Delete:{' '}
                      <code>order/order_delete/:order_id</code>.
                    </p>
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
                        placeholder="Search orders..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setFetchOrdersModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" />
                          Fetch Orders
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-md mb-0 text-sm"
                          onClick={() => setSyncOrdersModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync Orders
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
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
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('order_no')}
                          onDoubleClick={() => handleSort('order_no', true)}
                        >
                          Order No
                          {renderSortIcon('order_no')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Name
                          {renderSortIcon('name')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('email')}
                          onDoubleClick={() => handleSort('email', true)}
                        >
                          Email
                          {renderSortIcon('email')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('phone')}
                          onDoubleClick={() => handleSort('phone', true)}
                        >
                          Phone
                          {renderSortIcon('phone')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('no_of_items')}
                          onDoubleClick={() => handleSort('no_of_items', true)}
                        >
                          No. of items
                          {renderSortIcon('no_of_items')}
                        </th>
                        <th
                          className="text-end"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('order_items_total')}
                          onDoubleClick={() => handleSort('order_items_total', true)}
                        >
                          Total
                          {renderSortIcon('order_items_total')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('order_status')}
                          onDoubleClick={() => handleSort('order_status', true)}
                        >
                          Order status
                          {renderSortIcon('order_status')}
                        </th>
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
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('updatedAt')}
                          onDoubleClick={() => handleSort('updatedAt', true)}
                        >
                          Last Updated At
                          {renderSortIcon('updatedAt')}
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="12" className="text-center text-sm font-weight-normal p-4">
                            No orders found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const orderNo = item.order_no || item.orderNo || '-';
                          const statusValue = item.status || '-';
                          const isActive = String(statusValue).toLowerCase() === 'active';
                          const orderStatusRaw = getOrderStatusDisplay(item);
                          const orderStatusLabel = orderStatusRaw || '—';
                          const orderStatusActive =
                            String(orderStatusRaw).toLowerCase() === 'active';
                          const rowKey = String(item._id || item.id || index);
                          const isRowLoading = editLoadingId === rowKey;
                          return (
                            <tr key={key}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{orderNo}</td>
                              <td className="text-sm font-weight-normal">{item.name || '-'}</td>
                              <td className="text-sm font-weight-normal">{item.email || '-'}</td>
                              <td className="text-sm font-weight-normal">{item.phone || '-'}</td>
                              <td className="text-sm font-weight-normal">
                                {getNoOfItemsDisplay(item)}
                              </td>
                              <td className="text-sm font-weight-normal text-end">
                                {getOrderItemsTotalDisplay(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {orderStatusRaw ? (
                                  <span
                                    className={`badge ${
                                      orderStatusActive ? 'bg-success' : 'bg-secondary'
                                    }`}
                                  >
                                    {orderStatusLabel}
                                  </span>
                                ) : (
                                  orderStatusLabel
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <span
                                  className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {statusValue}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '-'}
                              </td>
                              <td
                                className="text-sm font-weight-normal text-muted"
                                title={
                                  item.updatedAt || item.updated_at
                                    ? moment(item.updatedAt || item.updated_at).format(
                                        'MM-DD-YYYY h:mm a'
                                      )
                                    : undefined
                                }
                              >
                                {item.updatedAt || item.updated_at
                                  ? moment(item.updatedAt || item.updated_at).fromNow()
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex flex-wrap gap-1">
                                  {canEdit ? (
                                    <button
                                      className="btn btn-outline-info btn-sm mb-0"
                                      type="button"
                                      disabled={editLoadingId === rowKey}
                                      onClick={() => handleOpenInvoice(item)}
                                    >
                                      {isRowLoading ? 'Opening…' : 'Edit'}
                                    </button>
                                  ) : null}
                                  {canDelete ? (
                                    <button
                                      className="btn btn-sm btn-danger mb-0"
                                      type="button"
                                      onClick={() => handleDelete(item)}
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                  {!canEdit && !canDelete ? '—' : null}
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
