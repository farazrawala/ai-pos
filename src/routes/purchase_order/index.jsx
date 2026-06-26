import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaFilter } from 'react-icons/fa6';
import {
  fetchPurchaseOrders,
  deletePurchaseOrder,
  setSearch,
  setDateFilters,
  clearDateFilters,
  setPage,
  setLimit,
  setSort,
  setFilterPurchaseItemId,
  clearDeleteStatus,
} from '../../features/purchaseOrders/purchaseOrdersSlice.js';
import {
  PURCHASE_ITEM_QUERY_KEY,
  fetchAllPurchaseOrdersForExportRequest,
} from '../../features/purchaseOrders/purchaseOrdersAPI.js';
import {
  PURCHASE_ORDER_EXPORT_COLUMNS,
  mapPurchaseOrdersToExportRows,
} from '../../features/purchaseOrders/purchaseOrderExportMapper.js';
import { DEBUG } from '../../config/env.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ListDateExportBar from '../../components/list/ListDateExportBar.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';

const poRef = (row) =>
  row?.purchase_order_no ??
  row?.po_no ??
  row?.order_no ??
  row?.reference ??
  row?.invoice_no ??
  '—';

const poStatus = (row) =>
  row?.order_status ?? row?.status ?? row?.purchase_order_status ?? row?.po_status ?? '—';

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

const PurchaseOrders = () => {
  useRequireModuleAccess('purchase-orders');
  const { canEdit, canDelete } = usePermissions('purchase-orders');
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
    filterPurchaseItemId,
    deleteStatus,
  } = useSelector((state) => state.purchaseOrders);

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localFilterId, setLocalFilterId] = useState(filterPurchaseItemId || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.startDate || filters.endDate)
  );
  const searchTimeoutRef = useRef(null);
  const filterTimeoutRef = useRef(null);

  const activeFilterCount = (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);

  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
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
    filters.startDate,
    filters.endDate,
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
    setLocalStartDate(filters.startDate || '');
    setLocalEndDate(filters.endDate || '');
  }, [filters.startDate, filters.endDate]);

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

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const applyDateFilters = () => {
    if (localStartDate && localEndDate && localStartDate > localEndDate) {
      toast.error('From date cannot be later than to date.');
      return;
    }
    dispatch(setDateFilters({ startDate: localStartDate, endDate: localEndDate }));
  };

  const resetDateFilters = () => {
    setLocalStartDate('');
    setLocalEndDate('');
    dispatch(clearDateFilters());
  };

  const buildExportParams = () => {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    if (filterPurchaseItemId && String(filterPurchaseItemId).trim()) {
      params.filterPurchaseItemId = String(filterPurchaseItemId).trim();
    }
    return params;
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const records = await fetchAllPurchaseOrdersForExportRequest(buildExportParams());
      if (!records.length) {
        toast.info('No purchase orders to export.');
        return;
      }
      const mapped = mapPurchaseOrdersToExportRows(records);
      const stamp = moment().format('YYYY-MM-DD-HHmm');
      const filename = `purchase-orders-${stamp}`;
      if (format === 'csv') {
        exportRowsToCsv({ columns: PURCHASE_ORDER_EXPORT_COLUMNS, rows: mapped, filename });
      } else if (format === 'excel') {
        exportRowsToExcel({
          columns: PURCHASE_ORDER_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          sheetTitle: 'Purchase orders',
        });
      } else if (format === 'pdf') {
        await exportRowsToPdf({
          columns: PURCHASE_ORDER_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          title: 'Purchase orders (with line items)',
        });
      }
      toast.success(
        `Exported ${mapped.length} line(s) from ${records.length} purchase order(s) as ${format.toUpperCase()}.`
      );
    } catch (err) {
      console.error('[Purchase orders] export failed', err);
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
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
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    };
  }, []);

  const handleDelete = async (purchaseOrderId, referenceLabel) => {
    const label = referenceLabel && referenceLabel !== '—' ? referenceLabel : 'this purchase order';
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) {
      return;
    }
    const result = await dispatch(deletePurchaseOrder(purchaseOrderId));
    if (deletePurchaseOrder.fulfilled.match(result)) {
      toast.success('Purchase order deleted successfully.');
    } else {
      toast.error(result.payload || 'Failed to delete purchase order.');
    }
    dispatch(clearDeleteStatus());
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Purchase orders</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">
                      Server-side pagination and search.
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '220px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search orders…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search purchase orders"
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ maxWidth: '200px' }}>
                      <span className="input-group-text text-body text-nowrap" title={PURCHASE_ITEM_QUERY_KEY}>
                        Item id
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Optional"
                        value={localFilterId}
                        onChange={handleFilterIdChange}
                        aria-label="Filter by purchase item id"
                      />
                    </div>
                    <AddNewButton to="/purchase-orders/add" label="Create purchase order" size="sm" />
                    <button
                      type="button"
                      className={`btn btn-sm mb-0 position-relative ${
                        showFilters || activeFilterCount > 0
                          ? 'btn-primary'
                          : 'btn-outline-primary'
                      }`}
                      onClick={() => setShowFilters((prev) => !prev)}
                      aria-expanded={showFilters}
                      aria-controls="purchase-orders-filter-panel"
                      aria-label="Filters and export"
                      title="Filters & export"
                    >
                      <NavIcon icon={FaFilter} size={14} />
                      {activeFilterCount > 0 ? (
                        <span className="badge bg-gradient-danger text-white rounded-pill position-absolute top-0 start-100 translate-middle">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <ListDateExportBar
              idPrefix="purchase-orders"
              show={showFilters}
              localStartDate={localStartDate}
              localEndDate={localEndDate}
              onStartDateChange={setLocalStartDate}
              onEndDateChange={setLocalEndDate}
              onApply={applyDateFilters}
              onClear={resetDateFilters}
              exporting={exporting}
              onExport={handleExport}
            />
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--purchase-orders"
                loading={loading}
                loadingLabel="Loading purchase orders…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="purchase-orders-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        {sortableTh('purchase_order_no', 'Reference')}
                        {sortableTh('transaction_number', 'Transaction', 'list-col-truncate')}
                        {sortableTh('order_status', 'Status')}
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
                            <p className="mb-3">
                              No purchase orders found. Try adjusting search, date range, or the optional item filter.
                            </p>
                            <AddNewButton to="/purchase-orders/add" label="Create purchase order" />
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const id = poTraceId(item);
                          const created = poCreated(item);
                          const txn = poTransactionNumber(item);
                          const statusVal = poStatus(item);
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
                              <td className="text-sm list-cell-truncate" title={poSupplier(item)}>
                                {poSupplier(item)}
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
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary mb-0"
                                        onClick={() =>
                                          navigate(`/purchase-orders/edit/${encodeURIComponent(id)}`)
                                        }
                                      >
                                        Edit
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
                                    {!canEdit && !canDelete ? (
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

export default PurchaseOrders;
