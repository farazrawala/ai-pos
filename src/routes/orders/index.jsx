import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchOrders,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/orders/ordersSlice.js';
import {
  fetchOrderByOrderItemRequest,
  pickInvoiceRouteId,
  getNoOfItemsDisplay,
  getOrderLineItems,
} from '../../features/orders/ordersAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const firstOrderItemId = (row) => {
  if (!row || typeof row !== 'object') return '';
  if (row.order_item_id) return String(row.order_item_id);
  if (row.order_item && typeof row.order_item === 'string') return String(row.order_item);
  if (row.order_item?._id) return String(row.order_item._id);
  const items = getOrderLineItems(row);
  if (items[0]?._id) return String(items[0]._id);
  if (items[0]?.id) return String(items[0].id);
  return '';
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
  } = useSelector((state) => state.orders);
  const { canView, canEdit } = usePermissions('orders');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [editLoadingId, setEditLoadingId] = useState('');
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
    const rowKey = String(row._id || row.id || '');
    setEditLoadingId(rowKey);
    try {
      const orderItemId = firstOrderItemId(row);
      let invoiceId = pickInvoiceRouteId(row);

      if (invoiceId && getOrderLineItems(row).length > 0) {
        navigate(`/pos/invoice/${encodeURIComponent(invoiceId)}`);
        return;
      }

      if (orderItemId) {
        const order = await fetchOrderByOrderItemRequest(orderItemId);
        invoiceId = pickInvoiceRouteId(order) || invoiceId;
      }

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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Orders</h5>
                  <p className="text-sm mb-0">
                    List and edit both use <code>order/get-order-by-order-item</code> (list:
                    pagination query only; edit: same API with the first line item id). Invoice:{' '}
                    <code>/pos/invoice/:order_no</code> when available.
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-end align-items-center gap-2">
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search orders..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              {!loading && !error && pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center">
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
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page === 1}
                      onClick={() => dispatch(setPage(pagination.page - 1))}
                    >
                      Prev
                    </button>
                    <button
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
                    <p>Loading orders...</p>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger m-3" role="alert">
                    Error loading orders: {error}
                  </div>
                )}
                {!loading && !error && (
                  <table className="table table-flush">
                    <thead className="thead-light">
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
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
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
                              <td className="text-sm font-weight-normal">
                                {canEdit ? (
                                  <button
                                    className="btn btn-outline-info btn-sm mb-0"
                                    type="button"
                                    disabled={editLoadingId === rowKey}
                                    onClick={() => handleOpenInvoice(item)}
                                  >
                                    {isRowLoading ? 'Opening…' : 'Edit'}
                                  </button>
                                ) : (
                                  '-'
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;
