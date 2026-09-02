import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  setFilterProductId,
  clearDeleteStatus,
} from '../../features/purchaseOrders/purchaseOrdersSlice.js';
import {
  fetchPurchaseOrdersListRequest,
  fetchAllPurchaseOrdersForExportRequest,
} from '../../features/purchaseOrders/purchaseOrdersAPI.js';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import {
  PURCHASE_ORDER_EXPORT_COLUMNS,
  mapPurchaseOrdersToExportRows,
} from '../../features/purchaseOrders/purchaseOrderExportMapper.js';
import { DEBUG } from '../../config/env.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ListDateExportBar from '../../components/list/ListDateExportBar.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import { openAppPathInNewTab } from '../../config/appBase.js';

const PURCHASE_ORDER_COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'reference', label: 'Reference', alwaysVisible: true },
  { key: 'transaction', label: 'Transaction' },
  { key: 'status', label: 'Status' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'trace_id', label: 'Trace ID' },
  { key: 'amount', label: 'Amount' },
  { key: 'dates', label: 'Created / Updated' },
  { key: 'actors', label: 'Created / Updated by' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

/** Display name from a populated user ref (or plain string id fallback). */
function getUserRefLabel(user) {
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    const name = String(user.name ?? user.fullName ?? user.username ?? '').trim();
    if (name) return name;
    const email = String(user.email ?? '').trim();
    if (email) return email;
    return '';
  }
  if (typeof user === 'string' && user.trim()) return user.trim();
  return '';
}

function getCreatedByLabel(row) {
  if (!row || typeof row !== 'object') return '';
  return (
    getUserRefLabel(row.created_by ?? row.createdBy) ||
    String(row.created_by_name ?? row.createdByName ?? '').trim()
  );
}

function getUpdatedByLabel(row) {
  if (!row || typeof row !== 'object') return '';
  return (
    getUserRefLabel(row.updated_by ?? row.updatedBy) ||
    String(row.updated_by_name ?? row.updatedByName ?? '').trim()
  );
}

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

const poUpdated = (row) => row?.updatedAt ?? row?.updated_at ?? null;

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

const productOptionId = (p) => String(p?._id || p?.id || p?.product_id || '').trim();
const productOptionName = (p) => p?.name || p?.product_name || 'Product';

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
    filterProductId,
    deleteStatus,
  } = useSelector((state) => state.purchaseOrders);

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.startDate || filters.endDate)
  );
  const [poFilterOptions, setPoFilterOptions] = useState([]);
  const [poFilterOptionsStatus, setPoFilterOptionsStatus] = useState('idle');
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    'purchase-orders',
    PURCHASE_ORDER_COLUMNS
  );

  const activeFilterCount = (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);

  const buildListParams = useCallback(() => {
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
    if (filterProductId && String(filterProductId).trim()) {
      params.product_id = String(filterProductId).trim();
    }
    return params;
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    filters.startDate,
    filters.endDate,
    sort.sortBy,
    sort.sortOrder,
    filterPurchaseItemId,
    filterProductId,
  ]);

  useEffect(() => {
    dispatch(fetchPurchaseOrders(buildListParams()));
  }, [dispatch, buildListParams]);

  useEffect(() => {
    let cancelled = false;
    setPoFilterOptionsStatus('loading');
    (async () => {
      try {
        const result = await fetchPurchaseOrdersListRequest({ page: 1, limit: 500 });
        if (cancelled) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        setPoFilterOptions([
          { value: '', label: 'All purchase orders' },
          ...rows
            .map((row) => {
              const value = String(row?._id ?? row?.id ?? '').trim();
              if (!value) return null;
              const ref = poRef(row);
              const supplier = poSupplier(row);
              return {
                value,
                label: ref !== '—' ? String(ref) : value.slice(0, 10),
                subLabel: supplier !== '—' ? String(supplier) : undefined,
              };
            })
            .filter(Boolean),
        ]);
        setPoFilterOptionsStatus('succeeded');
      } catch (err) {
        console.error('[Purchase orders] Failed to load PO filter options', err);
        if (!cancelled) {
          setPoFilterOptions([{ value: '', label: 'All purchase orders' }]);
          setPoFilterOptionsStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProductsStatus('loading');
    (async () => {
      try {
        const result = await fetchProductActiveRequest({
          page: 1,
          limit: 2000,
          includeInactive: true,
        });
        if (cancelled) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        rows.sort((a, b) =>
          String(productOptionName(a)).localeCompare(String(productOptionName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setProducts(rows);
        setProductsStatus('succeeded');
      } catch (err) {
        console.error('[Purchase orders] Failed to load products for filter', err);
        if (!cancelled) {
          setProducts([]);
          setProductsStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = useMemo(() => {
    const rows = products
      .map((p) => {
        const id = productOptionId(p);
        if (!id) return null;
        const sku = p.sku || p.product_code || '';
        return {
          value: id,
          label: productOptionName(p),
          subLabel: sku || undefined,
        };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All products' }, ...rows];
  }, [products]);

  const handleRetryFetch = useCallback(() => {
    dispatch(fetchPurchaseOrders(buildListParams()));
  }, [dispatch, buildListParams]);

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

  const handlePurchaseOrderFilterChange = useCallback(
    (next) => {
      dispatch(setFilterPurchaseItemId(next || ''));
    },
    [dispatch]
  );

  const handleProductFilterChange = useCallback(
    (next) => {
      dispatch(setFilterProductId(next || ''));
    },
    [dispatch]
  );

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

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
    if (filterProductId && String(filterProductId).trim()) {
      params.product_id = String(filterProductId).trim();
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
                    <div style={{ minWidth: '200px', maxWidth: '260px', flex: '1 1 200px' }}>
                      <SearchableSelect
                        id="purchase-orders-product-filter"
                        options={productOptions}
                        value={filterProductId || ''}
                        placeholder="All products"
                        searchPlaceholder="Search products…"
                        disabled={loading || productsStatus === 'loading'}
                        onChange={handleProductFilterChange}
                      />
                    </div>
                    <div style={{ minWidth: '200px', maxWidth: '260px', flex: '1 1 200px' }}>
                      <SearchableSelect
                        options={poFilterOptions}
                        value={filterPurchaseItemId || ''}
                        placeholder="All purchase orders"
                        disabled={loading || poFilterOptionsStatus === 'loading'}
                        onChange={handlePurchaseOrderFilterChange}
                      />
                    </div>
                    <ColumnVisibilityMenu
                      columns={PURCHASE_ORDER_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id="purchaseOrdersColumnVisibilityMenu"
                    />
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
                onRetry={handleRetryFetch}
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
                        {isVisible('transaction')
                          ? sortableTh('transaction_number', 'Transaction', 'list-col-truncate')
                          : null}
                        {isVisible('status') ? sortableTh('order_status', 'Status') : null}
                        {isVisible('supplier') ? sortableTh('supplier_name', 'Supplier') : null}
                        {isVisible('trace_id') ? (
                          <th className="list-col-truncate-sm">Trace ID</th>
                        ) : null}
                        {isVisible('amount')
                          ? sortableTh('total_amount', 'Amount', 'text-end list-col-amount')
                          : null}
                        {isVisible('dates')
                          ? sortableTh('createdAt', 'Created / Updated', 'list-col-date')
                          : null}
                        {isVisible('actors') ? (
                          <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                            Created / Updated by
                          </th>
                        ) : null}
                        <th className="text-end list-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={visibleCount} className="text-center py-5 text-muted">
                            <p className="mb-3">
                              No purchase orders found. Try adjusting search, product, date range, or the optional order filter.
                            </p>
                            <AddNewButton to="/purchase-orders/add" label="Create purchase order" />
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const id = poTraceId(item);
                          const ref = poRef(item);
                          const created = poCreated(item);
                          const updated = poUpdated(item);
                          const createdByLabel = getCreatedByLabel(item);
                          const updatedByLabel = getUpdatedByLabel(item);
                          const txn = poTransactionNumber(item);
                          const statusVal = poStatus(item);
                          return (
                            <tr key={id || index}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td className="text-sm font-weight-bold text-dark">
                                {id && ref !== '—' ? (
                                  <a
                                    href={`/purchase-orders/edit/${encodeURIComponent(id)}`}
                                    className="text-primary font-weight-bold text-decoration-none text-nowrap"
                                    title={`Open ${ref} in new browser tab`}
                                    onClick={(e) => {
                                      // Left-click: force a real browser tab (bypass installed PWA capture).
                                      // Ctrl/Cmd/Shift/middle-click keep native browser behavior.
                                      if (
                                        e.defaultPrevented ||
                                        e.button !== 0 ||
                                        e.metaKey ||
                                        e.ctrlKey ||
                                        e.shiftKey ||
                                        e.altKey
                                      ) {
                                        return;
                                      }
                                      e.preventDefault();
                                      openAppPathInNewTab(
                                        `/purchase-orders/edit/${encodeURIComponent(id)}`
                                      );
                                    }}
                                  >
                                    {ref}
                                  </a>
                                ) : (
                                  ref
                                )}
                              </td>
                              {isVisible('transaction') ? (
                                <td className="text-sm list-cell-truncate" title={txn !== '—' ? txn : undefined}>
                                  {txn}
                                </td>
                              ) : null}
                              {isVisible('status') ? (
                                <td className="text-sm">
                                  <span className={`badge text-xxs ${statusBadgeClass(statusVal)}`}>
                                    {String(statusVal)}
                                  </span>
                                </td>
                              ) : null}
                              {isVisible('supplier') ? (
                                <td className="text-sm list-cell-truncate" title={poSupplier(item)}>
                                  {poSupplier(item)}
                                </td>
                              ) : null}
                              {isVisible('trace_id') ? (
                                <td className="text-sm text-muted list-cell-truncate-sm font-monospace" title={id || undefined}>
                                  {id ? `${id.slice(0, 8)}…` : '—'}
                                </td>
                              ) : null}
                              {isVisible('amount') ? (
                                <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                                  {poTotalAmount(item)}
                                </td>
                              ) : null}
                              {isVisible('dates') ? (
                                <td className="text-sm list-col-date">
                                  {created || updated ? (
                                    <div className="oms-dates-cell">
                                      <div
                                        className="oms-dates-cell__created text-nowrap"
                                        title={
                                          created
                                            ? moment(created).format('DD MMM YYYY h:mm a')
                                            : undefined
                                        }
                                      >
                                        {created
                                          ? moment(created).format('DD MMM YYYY h:mm a')
                                          : '—'}
                                      </div>
                                      <div
                                        className="oms-dates-cell__updated text-nowrap"
                                        title={
                                          updated
                                            ? moment(updated).format('DD MMM YYYY h:mm a')
                                            : undefined
                                        }
                                      >
                                        {updated ? `Updated ${moment(updated).fromNow()}` : '—'}
                                      </div>
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              ) : null}
                              {isVisible('actors') ? (
                                <td className="text-sm">
                                  {createdByLabel || updatedByLabel ? (
                                    <div className="oms-actors-cell">
                                      {createdByLabel ? (
                                        <div
                                          className="oms-actors-cell__line text-truncate"
                                          title={`Created by ${createdByLabel}`}
                                        >
                                          <span className="oms-actors-cell__label">Created</span>
                                          {createdByLabel}
                                        </div>
                                      ) : null}
                                      {updatedByLabel ? (
                                        <div
                                          className="oms-actors-cell__line text-truncate"
                                          title={`Updated by ${updatedByLabel}`}
                                        >
                                          <span className="oms-actors-cell__label">Updated</span>
                                          {updatedByLabel}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              ) : null}
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
