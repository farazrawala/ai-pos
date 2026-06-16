import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchPurchaseOrderReturns,
  deletePurchaseOrderReturn,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/purchaseOrderReturns/purchaseOrderReturnsSlice.js';
import { DEBUG } from '../../config/env.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';

const poRef = (row) =>
  row?.purchase_return_no ??
  row?.purchaseReturnNo ??
  row?.purchase_order_no ??
  row?.po_no ??
  row?.order_no ??
  row?.reference ??
  row?.invoice_no ??
  '—';

const poStatus = (row) =>
  row?.return_status ??
  row?.returnStatus ??
  row?.order_status ??
  row?.status ??
  row?.purchase_order_status ??
  row?.po_status ??
  '—';

const vendorDisplayName = (vendor) => {
  if (vendor == null || typeof vendor !== 'object' || Array.isArray(vendor)) return null;
  const n =
    vendor.name ??
    vendor.vendor_name ??
    vendor.business_name ??
    vendor.company_name ??
    vendor.full_name ??
    '';
  const s = String(n).trim();
  return s || null;
};

const poSupplier = (row) =>
  row?.supplier_name ??
  vendorDisplayName(row?.vendor_id) ??
  row?.supplier?.name ??
  row?.vendor_name ??
  (row?.vendor_id != null && typeof row.vendor_id !== 'object' ? String(row.vendor_id) : null) ??
  (row?.supplier_id != null && typeof row.supplier_id !== 'object'
    ? String(row.supplier_id)
    : null) ??
  '—';

const poCreated = (row) => row?.createdAt ?? row?.created_at ?? null;

const poTraceId = (row) => row?._id ?? row?.id ?? '';

const poTotalAmount = (row) => {
  const v = row?.total_amount ?? row?.total ?? row?.grand_total;
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const poTransactionNumber = (row) => {
  const v =
    row?.transaction_number ??
    row?.transactionNumber ??
    row?.txn_no ??
    row?.transaction_no ??
    '';
  return v !== '' && v != null ? String(v) : '—';
};

const PurchaseOrderReturns = () => {
  useRequireModuleAccess('purchase-order-returns');
  const { canView, canDelete } = usePermissions('purchase-order-returns');
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
  } = useSelector((state) => state.purchaseOrderReturns);

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);

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
    dispatch(fetchPurchaseOrderReturns(params));
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

  useEffect(() => {
    if (error) {
      console.error('[Purchase order return module] Failed to fetch purchase order return list', error);
    }
  }, [error]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const handleSort = (column, forceDesc = false) => {
    if (forceDesc) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sort.sortBy === column) {
      dispatch(setSort({ sortBy: column, sortOrder: sort.sortOrder === 'asc' ? 'desc' : 'asc' }));
    } else {
      dispatch(setSort({ sortBy: column, sortOrder: 'asc' }));
    }
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh column={column} label={label} sort={sort} onSort={handleSort} className={className} />
  );

  const statusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active' || s === 'completed' || s === 'posted') return 'bg-gradient-success';
    if (s === 'pending' || s === 'draft') return 'bg-gradient-warning';
    if (s === 'cancelled' || s === 'void') return 'bg-gradient-danger';
    return 'bg-gradient-secondary';
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleDelete = async (purchaseOrderReturnId, returnLabel) => {
    const label =
      returnLabel && returnLabel !== '—' ? returnLabel : 'this purchase order return';
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) {
      return;
    }
    const result = await dispatch(deletePurchaseOrderReturn(purchaseOrderReturnId));
    if (deletePurchaseOrderReturn.fulfilled.match(result)) {
      toast.success('Purchase order return deleted successfully.');
    } else {
      toast.error(result.payload || 'Failed to delete purchase order return.');
    }
    dispatch(clearDeleteStatus());
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Purchase order returns</h5>
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
                        placeholder="Search returns…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search purchase order returns"
                      />
                    </div>
                    <AddNewButton to="/purchase-order-returns/add" label="Create return" size="sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--purchase-orders"
                loading={loading}
                loadingLabel="Loading purchase order returns…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="purchase-order-returns-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        {sortableTh('purchase_return_no', 'Return no')}
                        {sortableTh('transaction_number', 'Transaction', 'list-col-truncate')}
                        {sortableTh('return_status', 'Status')}
                        {sortableTh('supplier_name', 'Supplier')}
                        <th className="list-col-truncate-sm">Trace ID</th>
                        {sortableTh('total_amount', 'Amount', 'text-end list-col-amount')}
                        {sortableTh('createdAt', 'Created', 'list-col-date')}
                        <th className="text-end list-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-5 text-muted">
                            <p className="mb-3">No purchase order returns found. Try adjusting search.</p>
                            <AddNewButton to="/purchase-order-returns/add" label="Create purchase order return" />
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const id = poTraceId(item);
                          const created = poCreated(item);
                          const txn = poTransactionNumber(item);
                          const statusVal = poStatus(item);
                          const supplier = poSupplier(item);
                          return (
                            <tr key={id || index}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td className="text-sm font-weight-bold text-dark">{poRef(item)}</td>
                              <td className="text-sm list-cell-truncate" title={txn !== '—' ? txn : undefined}>
                                {txn}
                              </td>
                              <td className="text-sm">
                                <span className={`badge text-xxs ${statusBadgeClass(statusVal)}`}>
                                  {String(statusVal)}
                                </span>
                              </td>
                              <td className="text-sm list-cell-truncate" title={supplier}>
                                {supplier}
                              </td>
                              <td className="text-sm text-muted list-cell-truncate-sm font-monospace" title={id || undefined}>
                                {id ? `${id.slice(0, 8)}…` : '—'}
                              </td>
                              <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                                {poTotalAmount(item)}
                              </td>
                              <td className="text-sm text-nowrap list-col-date">
                                {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                              </td>
                              <td className="text-end">
                                {id ? (
                                  <div className="list-table-actions">
                                    {canView ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary mb-0"
                                        onClick={() =>
                                          navigate(`/purchase-order-returns/edit/${encodeURIComponent(id)}`)
                                        }
                                      >
                                        View
                                      </button>
                                    ) : null}
                                    {canDelete ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger mb-0"
                                        onClick={() => handleDelete(id, poRef(item))}
                                        disabled={deleteStatus === 'loading'}
                                      >
                                        Delete
                                      </button>
                                    ) : null}
                                    {!canView && !canDelete ? (
                                      <span className="text-muted">—</span>
                                    ) : null}
                                  </div>
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
              </ListDataTable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderReturns;
