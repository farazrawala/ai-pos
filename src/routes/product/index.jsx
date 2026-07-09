import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaArrowsRotate, FaCloudArrowUp } from 'react-icons/fa6';
import {
  fetchProducts,
  deleteProduct,
  updateProduct,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/products/productsSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { withBase } from '../../config/appBase.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import ProductWarehouseStockModal from '../../components/product/ProductWarehouseStockModal.jsx';
import FetchProductsModal from '../../components/product/FetchProductsModal.jsx';
import SyncProductsModal from '../../components/product/SyncProductsModal.jsx';
import ViewProductSyncModal from '../../components/product/ViewProductSyncModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { productEditIdFromRecord, productIdFromRecord } from '../../components/product/productVariationUtils.js';
import { DEBUG } from '../../config/env.js';
import { formatMoney } from '../../utils/formatMoney.js';
import { fetchAllProductsForExportRequest } from '../../features/products/productsAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import {
  mapProductsToExportRows,
  PRODUCT_EXPORT_COLUMNS,
} from '../../features/products/productExportMapper.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import { toast } from '../../utils/toast.js';

const sumWarehouseInventory = (inventory) => {
  if (!Array.isArray(inventory) || inventory.length === 0) return null;
  return inventory.reduce((sum, inv) => sum + (Number(inv?.quantity) || 0), 0);
};

const getProductStock = (item) => {
  if (!item || typeof item !== 'object') return null;

  const direct = item.stock ?? item.total_stock ?? item.totalStock ?? item.quantity;
  if (direct != null && direct !== '') {
    const n = Number(direct);
    if (Number.isFinite(n)) return n;
  }

  const wi = sumWarehouseInventory(item.warehouse_inventory ?? item.warehouseInventory);
  if (wi != null) return wi;

  const children = item.childproducts ?? item.child_products ?? item.variations;
  if (Array.isArray(children) && children.length > 0) {
    let total = 0;
    let hasQty = false;
    for (const child of children) {
      const childDirect = child.stock ?? child.quantity;
      if (childDirect != null && childDirect !== '') {
        const n = Number(childDirect);
        if (Number.isFinite(n)) {
          total += n;
          hasQty = true;
          continue;
        }
      }
      const childWi = sumWarehouseInventory(child.warehouse_inventory ?? child.warehouseInventory);
      if (childWi != null) {
        total += childWi;
        hasQty = true;
      }
    }
    if (hasQty) return total;
  }

  return null;
};

const formatProductStock = (stock) => {
  if (stock == null || !Number.isFinite(stock)) return '—';
  return Number(stock).toLocaleString();
};

const warehouseNameFromInventoryRow = (row) => {
  if (!row || typeof row !== 'object') return 'Warehouse';
  const w = row.warehouse_id ?? row.warehouseId;
  if (w && typeof w === 'object' && !Array.isArray(w)) {
    const n = w.name ?? w.warehouse_name ?? w.title;
    if (n != null && String(n).trim() !== '') return String(n).trim();
  }
  if (w != null && typeof w !== 'object') return String(w);
  const fallback = row.warehouse_name ?? row.warehouseName;
  return fallback != null && String(fallback).trim() !== '' ? String(fallback).trim() : 'Warehouse';
};

/** Per-warehouse qty from list API `warehouse_inventory` (populated `warehouse_id`). */
const getWarehouseStockLines = (item) => {
  if (!item || typeof item !== 'object') return [];
  const inv = item.warehouse_inventory ?? item.warehouseInventory;
  if (!Array.isArray(inv) || inv.length === 0) return [];
  return inv.map((row, index) => ({
    key: String(row?._id ?? row?.id ?? `${warehouseNameFromInventoryRow(row)}-${index}`),
    name: warehouseNameFromInventoryRow(row),
    qty: Number(row?.quantity) || 0,
  }));
};

/** Total qty plus per-warehouse lines for the stock column. */
const getProductStockDisplay = (item) => {
  const lines = getWarehouseStockLines(item);
  if (lines.length > 0) {
    const warehouseTotal = lines.reduce((sum, line) => sum + line.qty, 0);
    return { total: warehouseTotal, lines };
  }
  return { total: getProductStock(item), lines: [] };
};

/** Products table columns. `sno`, `name`, `actions` are always visible. */
const PRODUCT_COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'image', label: 'Image' },
  { key: 'name', label: 'Name', alwaysVisible: true },
  { key: 'stock', label: 'Stock' },
  { key: 'wholesale', label: 'Wholesale' },
  { key: 'price', label: 'Price' },
  { key: 'tax', label: 'Tax' },
  { key: 'alert', label: 'Alert' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const productIsActive = (item) => item?.status === 'active' || item?.isActive || item?.status === 1;

const categoryOptionValue = (c) => String(c?._id ?? c?.id ?? '');

const categoryOptionLabel = (c) => {
  const name = c?.name ?? c?.category_name ?? '';
  return name ? String(name) : categoryOptionValue(c) || 'Category';
};

const Product = () => {
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
    deleteError,
  } = useSelector((state) => state.products);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const [togglingProductId, setTogglingProductId] = useState(null);
  const [warehouseStockTarget, setWarehouseStockTarget] = useState(null);
  const [fetchProductsModalOpen, setFetchProductsModalOpen] = useState(false);
  const [syncProductsModalOpen, setSyncProductsModalOpen] = useState(false);
  const [viewSyncProduct, setViewSyncProduct] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Get product permissions
  const { canView, canCreate, canEdit, canDelete } = usePermissions('products');
  useRequireModuleAccess('products');

  // Show/hide table columns (persisted in cache).
  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    'products',
    PRODUCT_COLUMNS
  );

  const buildListParams = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (categoryFilter) params.categoryId = categoryFilter;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    return params;
  }, [pagination.page, pagination.limit, searchTerm, categoryFilter, sort.sortBy, sort.sortOrder]);

  useEffect(() => {
    let cancelled = false;
    setCategoriesStatus('loading');
    (async () => {
      try {
        const result = await fetchCategoriesRequest({ page: 1, limit: 2000 });
        if (cancelled) return;
        setCategories(Array.isArray(result?.data) ? result.data : []);
        setCategoriesStatus('succeeded');
      } catch {
        if (!cancelled) {
          setCategories([]);
          setCategoriesStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch data from API using Redux with pagination, search, category, and sort
  useEffect(() => {
    dispatch(fetchProducts(buildListParams()));
  }, [dispatch, buildListParams]);

  const handleCategoryFilterChange = useCallback(
    (e) => {
      setCategoryFilter(e.target.value);
      dispatch(setPage(1));
    },
    [dispatch]
  );

  // Handle search input with debounce
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  // Handle limit change
  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  // Handle sort change
  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh
      column={column}
      label={label}
      sort={sort}
      onSort={handleSort}
      className={className}
    />
  );

  // Handle toggle status
  const handleToggleStatus = async (productId, currentStatus) => {
    const newStatus = !currentStatus;
    setTogglingProductId(productId);

    try {
      await dispatch(
        updateProduct({
          productId,
          productData: { status: newStatus ? 'active' : 'inactive' },
          images: [],
        })
      ).unwrap();

      dispatch(fetchProducts(buildListParams()));
    } catch (error) {
      console.error('Toggle status error:', error);
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }
        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          toastBody.textContent = error?.message || 'Failed to update product status';
        }
        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }
    } finally {
      setTogglingProductId(null);
    }
  };

  // Handle delete product
  const handleDelete = async (productId, productName) => {
    const productNameDisplay = productName || 'this product';
    if (
      window.confirm(
        `Are you sure you want to delete "${productNameDisplay}"? This action cannot be undone.`
      )
    ) {
      try {
        await dispatch(deleteProduct(productId)).unwrap();
        dispatch(fetchProducts(buildListParams()));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  // Sync local search with Redux search term
  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  // Show toast notifications for delete status
  useEffect(() => {
    if (deleteStatus === 'succeeded') {
      const toastElement = document.getElementById('successToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }

        setTimeout(() => {
          dispatch(clearDeleteStatus());
        }, 5500);
      }
    }
  }, [deleteStatus, dispatch]);

  useEffect(() => {
    if (deleteError) {
      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }
    }
  }, [deleteError]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (elementId, bodyText) => {
    const toastElement = document.getElementById(elementId);
    if (!toastElement) return;

    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }

    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }

    if (window.bootstrap && window.bootstrap.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    } else {
      toastElement.classList.remove('hide');
      toastElement.classList.add('show');
      setTimeout(() => {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');
      }, 5000);
    }
  };

  const refreshProductList = () => {
    dispatch(fetchProducts(buildListParams()));
  };

  const handleFetchProductsSaved = () => {
    showToast('successToast', 'Product fetch process queued successfully!');
    refreshProductList();
  };

  const handleSyncProductsSaved = () => {
    showToast('successToast', 'Product sync processes queued successfully!');
    refreshProductList();
  };

  const openWarehouseStock = (item) => {
    setWarehouseStockTarget({
      productId: productIdFromRecord(item),
      productName: item.name || item.product_name || 'Product',
    });
  };

  const buildExportParams = () => {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (categoryFilter) params.categoryId = categoryFilter;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    return params;
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const records = await fetchAllProductsForExportRequest(buildExportParams());
      if (!records.length) {
        toast.info('No products to export.');
        return;
      }
      const mapped = mapProductsToExportRows(records);
      const stamp = moment().format('YYYY-MM-DD-HHmm');
      const filename = `products-with-stock-${stamp}`;
      if (format === 'csv') {
        exportRowsToCsv({ columns: PRODUCT_EXPORT_COLUMNS, rows: mapped, filename });
      } else if (format === 'excel') {
        exportRowsToExcel({
          columns: PRODUCT_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          sheetTitle: 'Products',
        });
      } else if (format === 'pdf') {
        await exportRowsToPdf({
          columns: PRODUCT_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          title: 'Products with stock',
        });
      }
      toast.success(`Exported ${mapped.length} product(s) as ${format.toUpperCase()}.`);
    } catch (err) {
      console.error('[Products] export failed', err);
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-3 col-md-4">
                  <h5 className="mb-1">Products</h5>
                  {DEBUG ? (
                    <p className="text-sm text-muted mb-0">Server-side pagination and search.</p>
                  ) : null}
                </div>
                <div className="col-lg-9 col-md-8">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <select
                      id="products-category-filter"
                      className="form-select form-select-sm"
                      style={{ maxWidth: '200px' }}
                      value={categoryFilter}
                      onChange={handleCategoryFilterChange}
                      disabled={categoriesStatus === 'loading'}
                      aria-label="Filter by category"
                    >
                      <option value="">All categories</option>
                      {categories.map((cat) => (
                        <option key={categoryOptionValue(cat)} value={categoryOptionValue(cat)}>
                          {categoryOptionLabel(cat)}
                        </option>
                      ))}
                    </select>
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search products…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search products"
                      />
                    </div>
                    <ColumnVisibilityMenu
                      columns={PRODUCT_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                    />
                    {canView ? (
                      <div className="btn-group btn-group-sm" role="group" aria-label="Export products">
                        <button
                          type="button"
                          className="btn btn-outline-success mb-0"
                          disabled={exporting}
                          onClick={() => handleExport('csv')}
                          title="Export all products with stock (CSV)"
                        >
                          <i className="fas fa-file-csv me-1" aria-hidden="true" />
                          {exporting ? 'Exporting…' : 'Export CSV'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-success mb-0"
                          disabled={exporting}
                          onClick={() => handleExport('excel')}
                          title="Export all products with stock (Excel)"
                        >
                          <i className="fas fa-file-excel me-1" aria-hidden="true" />
                          Excel
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger mb-0"
                          disabled={exporting}
                          onClick={() => handleExport('pdf')}
                          title="Export all products with stock (PDF)"
                        >
                          <i className="fas fa-file-pdf me-1" aria-hidden="true" />
                          PDF
                        </button>
                      </div>
                    ) : null}
                    {canCreate ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setFetchProductsModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" aria-hidden="true" />
                          Fetch
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setSyncProductsModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync
                        </button>
                        <AddNewButton to="/products/add" label="Add product" size="sm" />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--products"
                loading={loading}
                loadingLabel="Loading products…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="products-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th className="text-center list-col-sno">#</th>
                      {isVisible('image') ? <th className="list-col-product-img">Image</th> : null}
                      {sortableTh('name', 'Name', 'list-col-truncate')}
                      {isVisible('stock')
                        ? sortableTh('stock', 'Stock', 'text-end list-col-stock')
                        : null}
                      {isVisible('wholesale')
                        ? sortableTh('wholesale_price', 'Wholesale', 'text-end list-col-amount')
                        : null}
                      {isVisible('price')
                        ? sortableTh('price', 'Price', 'text-end list-col-amount')
                        : null}
                      {isVisible('tax')
                        ? sortableTh('tax_rate', 'Tax', 'text-center list-col-tax')
                        : null}
                      {isVisible('alert')
                        ? sortableTh('alert_qty', 'Alert', 'text-center list-col-qty')
                        : null}
                      {isVisible('barcode')
                        ? sortableTh('barcode', 'Barcode', 'list-col-truncate-sm font-monospace')
                        : null}
                      {isVisible('type')
                        ? sortableTh('product_type', 'Type', 'list-col-truncate-sm')
                        : null}
                      {isVisible('status') ? sortableTh('status', 'Status') : null}
                      {isVisible('created')
                        ? sortableTh('createdAt', 'Created', 'list-col-date')
                        : null}
                      <th className="text-end list-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount} className="text-center py-5 text-muted">
                          No products found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const productId = productIdFromRecord(item);
                        const productEditId = productEditIdFromRecord(item);
                        const productName = item.name || item.product_name || 'Product';
                        const mainImage =
                          item.product_image ||
                          (item.multi_images && item.multi_images.length > 0
                            ? item.multi_images[0]
                            : null) ||
                          (item.images && item.images.length > 0 ? item.images[0] : null) ||
                          item.image ||
                          null;
                        const { total: stockTotal, lines: warehouseLines } =
                          getProductStockDisplay(item);
                        const isActive = productIsActive(item);
                        const isToggling = togglingProductId === productId;
                        const created = item.createdAt ?? item.created_at;
                        const updated = item.updatedAt ?? item.updated_at;
                        const taxRate = item.tax_rate ?? item.taxRate;
                        const alertQty =
                          item.alert_qty != null && item.alert_qty !== ''
                            ? item.alert_qty
                            : item.alertQty != null && item.alertQty !== ''
                              ? item.alertQty
                              : '—';
                        const productType = item.product_type || item.productType || '—';
                        const barcode = item.barcode ? String(item.barcode) : '—';

                        return (
                          <tr key={productId || index}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            {isVisible('image') ? (
                              <td>
                                {mainImage ? (
                                  <img
                                    src={mainImage}
                                    alt={productName}
                                    className="list-product-thumb"
                                    onError={(e) => {
                                      e.target.src = withBase('/assets/img/default.jpg');
                                    }}
                                  />
                                ) : (
                                  <div className="list-product-thumb list-product-thumb--empty">
                                    <i className="fas fa-image text-muted" aria-hidden="true" />
                                  </div>
                                )}
                              </td>
                            ) : null}
                            <td
                              className="text-sm font-weight-bold text-dark list-cell-truncate"
                              title={productName !== 'Product' ? productName : undefined}
                            >
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 mb-0 text-dark font-weight-bold text-decoration-none d-block w-100 text-truncate text-start"
                                  title={`Edit ${productName}`}
                                  onClick={() => navigate(`/products/edit/${productEditId}`)}
                                >
                                  {productName}
                                </button>
                              ) : (
                                productName
                              )}
                            </td>
                            {isVisible('stock') ? (
                              <td className="text-sm text-end list-col-stock">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 mb-0 text-dark font-weight-bold text-decoration-none list-stock-total"
                                  title="View stock by warehouse"
                                  onClick={() => openWarehouseStock(item)}
                                >
                                  {formatProductStock(stockTotal)}
                                </button>
                                {warehouseLines.length > 0 ? (
                                  <div className="list-stock-warehouses">
                                    {warehouseLines.slice(0, 2).map((line) => (
                                      <button
                                        key={line.key}
                                        type="button"
                                        className="btn btn-link btn-sm p-0 mb-0 text-muted text-xxs text-decoration-none list-cell-truncate-sm d-block w-100 text-end"
                                        title={`${line.name}: ${formatProductStock(line.qty)}`}
                                        onClick={() => openWarehouseStock(item)}
                                      >
                                        {line.name}: {formatProductStock(line.qty)}
                                      </button>
                                    ))}
                                    {warehouseLines.length > 2 ? (
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm p-0 mb-0 text-primary text-xxs text-decoration-none"
                                        onClick={() => openWarehouseStock(item)}
                                      >
                                        +{warehouseLines.length - 2} more
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </td>
                            ) : null}
                            {isVisible('wholesale') ? (
                              <td className="text-sm text-end text-nowrap list-col-amount">
                                {item.wholesale_price != null && item.wholesale_price !== ''
                                  ? formatMoney(item.wholesale_price)
                                  : '—'}
                              </td>
                            ) : null}
                            {isVisible('price') ? (
                              <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                                {item.price || item.product_price
                                  ? formatMoney(item.price || item.product_price || 0)
                                  : '—'}
                              </td>
                            ) : null}
                            {isVisible('tax') ? (
                              <td className="text-sm text-center">
                                {taxRate == null || taxRate === ''
                                  ? '—'
                                  : (() => {
                                      const n = parseFloat(taxRate);
                                      return Number.isFinite(n) ? `${n}%` : String(taxRate);
                                    })()}
                              </td>
                            ) : null}
                            {isVisible('alert') ? (
                              <td className="text-sm text-center">{alertQty}</td>
                            ) : null}
                            {isVisible('barcode') ? (
                              <td
                                className="text-sm font-monospace list-cell-truncate-sm"
                                title={barcode !== '—' ? barcode : undefined}
                              >
                                {barcode}
                              </td>
                            ) : null}
                            {isVisible('type') ? (
                              <td
                                className="text-sm list-cell-truncate-sm text-capitalize"
                                title={productType !== '—' ? productType : undefined}
                              >
                                {productType}
                              </td>
                            ) : null}
                            {isVisible('status') ? (
                              <td className="text-sm">
                                <div className="form-check form-switch mb-0 list-status-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`toggle-${productId || index}`}
                                    checked={isActive}
                                    onChange={() => handleToggleStatus(productId, isActive)}
                                    disabled={!canEdit || isToggling}
                                    aria-label={`Toggle ${productName} status`}
                                  />
                                  {isToggling ? (
                                    <span
                                      className="spinner-border spinner-border-sm text-primary ms-1"
                                      role="status"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                            {isVisible('created') ? (
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
                            ) : null}
                            <td className="text-end">
                              <div className="list-table-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary mb-0 px-2"
                                  title="View sync"
                                  aria-label="View sync"
                                  onClick={() =>
                                    setViewSyncProduct({ id: productId, name: productName })
                                  }
                                >
                                  <NavIcon icon={FaArrowsRotate} size={14} />
                                </button>
                                {canEdit ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0"
                                    onClick={() => navigate(`/products/edit/${productEditId}`)}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger mb-0"
                                    onClick={() => handleDelete(productId, productName)}
                                    disabled={deleteStatus === 'loading'}
                                  >
                                    {deleteStatus === 'loading' ? 'Deleting…' : 'Delete'}
                                  </button>
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

      <ProductWarehouseStockModal
        open={Boolean(warehouseStockTarget)}
        onClose={() => setWarehouseStockTarget(null)}
        productId={warehouseStockTarget?.productId}
        productName={warehouseStockTarget?.productName}
      />

      <FetchProductsModal
        open={fetchProductsModalOpen}
        onClose={() => setFetchProductsModalOpen(false)}
        onSaved={handleFetchProductsSaved}
      />

      <SyncProductsModal
        open={syncProductsModalOpen}
        onClose={() => setSyncProductsModalOpen(false)}
        onSaved={handleSyncProductsSaved}
      />

      <ViewProductSyncModal
        open={Boolean(viewSyncProduct?.id)}
        productId={viewSyncProduct?.id || ''}
        productName={viewSyncProduct?.name || ''}
        onClose={() => setViewSyncProduct(null)}
      />

      {/* Toast Notifications */}
      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Product deleted successfully!</div>
        </div>

        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">
            {deleteError || 'An error occurred while deleting the product.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Product;
