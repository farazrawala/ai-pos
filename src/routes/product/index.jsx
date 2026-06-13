import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
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
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import ProductWarehouseStockModal from '../../components/product/ProductWarehouseStockModal.jsx';
import { DEBUG } from '../../config/env.js';
import { formatMoney } from '../../utils/formatMoney.js';

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

  // Get product permissions
  const { canView, canCreate, canEdit, canDelete } = usePermissions('products');
  useRequireModuleAccess('products');

  // Fetch data from API using Redux with pagination, search, and sort
  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };

    if (searchTerm) {
      params.search = searchTerm;
    }

    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }

    dispatch(fetchProducts(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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

  // Handle sort change with double-click detection
  const sortClickTimeoutRef = useRef(null);

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
      }
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
  };

  // Render sort icon
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

      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (sort.sortBy) {
        params.sortBy = sort.sortBy;
        params.sortOrder = sort.sortOrder;
      }
      dispatch(fetchProducts(params));
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
        const params = {
          page: pagination.page,
          limit: pagination.limit,
        };
        if (searchTerm) {
          params.search = searchTerm;
        }
        if (sort.sortBy) {
          params.sortBy = sort.sortBy;
          params.sortOrder = sort.sortOrder;
        }
        dispatch(fetchProducts(params));
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
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
      }
    };
  }, []);

  const firstSegment = window.location.pathname.split('/')[1];

  // Calculate pagination info
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  // Reusable Pagination Component

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">
                    {firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)}
                  </h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Server-side pagination and search enabled.</p>
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
                        placeholder="Search products..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    {canCreate && (
                      <AddNewButton to="/products/add" label="Add New Product" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading products…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="products-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0" id="datatable-search">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                          onDoubleClick={() => handleSort('name', true)}
                        >
                          Image
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
                          className="text-end"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('stock')}
                          onDoubleClick={() => handleSort('stock', true)}
                        >
                          Stock
                          {renderSortIcon('stock')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('wholesale_price')}
                          onDoubleClick={() => handleSort('wholesale_price', true)}
                        >
                          Wholesale price
                          {renderSortIcon('wholesale_price')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('price')}
                          onDoubleClick={() => handleSort('price', true)}
                        >
                          Price
                          {renderSortIcon('price')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('tax_rate')}
                          onDoubleClick={() => handleSort('tax_rate', true)}
                        >
                          Tax
                          {renderSortIcon('tax_rate')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('alert_qty')}
                          onDoubleClick={() => handleSort('alert_qty', true)}
                        >
                          Alert quantity
                          {renderSortIcon('alert_qty')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('barcode')}
                          onDoubleClick={() => handleSort('barcode', true)}
                        >
                          Barcode
                          {renderSortIcon('barcode')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('product_type')}
                          onDoubleClick={() => handleSort('product_type', true)}
                        >
                          Product Type
                          {renderSortIcon('product_type')}
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
                          Last updated at
                          {renderSortIcon('updatedAt')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="14" className="text-center text-sm font-weight-normal p-4">
                            No products found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
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
                          return (
                            <tr key={item._id || index}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {mainImage ? (
                                  <img
                                    src={mainImage}
                                    alt={item.product_name || 'Product'}
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                    }}
                                    onError={(e) => {
                                      e.target.src = '/assets/img/default.jpg';
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                      backgroundColor: '#f0f0f0',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <i className="fas fa-image text-muted"></i>
                                  </div>
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.name || item.product_name || '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex flex-column align-items-end gap-1">
                                  <span
                                    className="badge bg-gradient-dark text-white mb-0"
                                    title="Total quantity"
                                  >
                                    Total: {formatProductStock(stockTotal)}
                                  </span>
                                  {warehouseLines.length > 0 ? (
                                    <div className="d-flex flex-wrap justify-content-end gap-1">
                                      {warehouseLines.map((line) => (
                                        <span
                                          key={line.key}
                                          role="button"
                                          tabIndex={0}
                                          className="badge bg-light text-dark border mb-0"
                                          style={{ cursor: 'pointer' }}
                                          title={`${line.name} — open stock movements`}
                                          onClick={() =>
                                            setWarehouseStockTarget({
                                              productId:
                                                item._id || item.id || item.product_id,
                                              productName:
                                                item.name || item.product_name || 'Product',
                                            })
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              setWarehouseStockTarget({
                                                productId:
                                                  item._id || item.id || item.product_id,
                                                productName:
                                                  item.name || item.product_name || 'Product',
                                              });
                                            }
                                          }}
                                        >
                                          {line.name}: {formatProductStock(line.qty)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-secondary p-0 mb-0"
                                      onClick={() =>
                                        setWarehouseStockTarget({
                                          productId:
                                            item._id || item.id || item.product_id,
                                          productName:
                                            item.name || item.product_name || 'Product',
                                        })
                                      }
                                    >
                                      Stock details
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.wholesale_price != null && item.wholesale_price !== ''
                                  ? formatMoney(item.wholesale_price)
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.price || item.product_price
                                  ? formatMoney(item.price || item.product_price || 0)
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {(() => {
                                  const rate = item.tax_rate ?? item.taxRate;
                                  if (rate == null || rate === '') return '-';
                                  const n = parseFloat(rate);
                                  return Number.isFinite(n) ? `${n}%` : String(rate);
                                })()}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.alert_qty != null && item.alert_qty !== ''
                                  ? item.alert_qty
                                  : item.alertQty != null && item.alertQty !== ''
                                    ? item.alertQty
                                    : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.barcode ? String(item.barcode) : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.product_type || item.productType || '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex align-items-center gap-2">
                                  <div className="form-check form-switch mb-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      role="switch"
                                      id={`toggle-${item._id || item.id || item.product_id || index}`}
                                      checked={
                                        item.status === 'active' ||
                                        item.isActive ||
                                        item.status === 1
                                      }
                                      onChange={() =>
                                        handleToggleStatus(
                                          item._id || item.id || item.product_id,
                                          item.status === 'active' ||
                                            item.isActive ||
                                            item.status === 1
                                        )
                                      }
                                      disabled={
                                        togglingProductId ===
                                        (item._id || item.id || item.product_id)
                                      }
                                      style={{
                                        width: '2.5rem',
                                        height: '1.25rem',
                                        cursor:
                                          togglingProductId ===
                                          (item._id || item.id || item.product_id)
                                            ? 'not-allowed'
                                            : 'pointer',
                                      }}
                                    />
                                  </div>
                                  {togglingProductId ===
                                  (item._id || item.id || item.product_id) ? (
                                    <span
                                      className="spinner-border spinner-border-sm text-primary"
                                      role="status"
                                      style={{ width: '1rem', height: '1rem' }}
                                    >
                                      <span className="visually-hidden">Loading...</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`badge ${
                                        item.status === 'active' ||
                                        item.isActive ||
                                        item.status === 1
                                          ? 'bg-success'
                                          : 'bg-secondary'
                                      }`}
                                    >
                                      {item.status === 'active' ||
                                      item.isActive ||
                                      item.status === 1
                                        ? 'Active'
                                        : 'Inactive'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.updatedAt || item.updated_at
                                  ? moment(item.updatedAt || item.updated_at).fromNow()
                                  : '-'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex gap-1">
                                  {canEdit && (
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={() =>
                                        navigate(
                                          `/products/edit/${item._id || item.id || item.product_id}`
                                        )
                                      }
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() =>
                                        handleDelete(
                                          item._id || item.id || item.product_id,
                                          item.name || item.product_name || 'Product'
                                        )
                                      }
                                      disabled={deleteStatus === 'loading'}
                                    >
                                      {deleteStatus === 'loading' ? 'Deleting...' : 'Delete'}
                                    </button>
                                  )}
                                  {!canEdit && !canDelete && (
                                    <span className="text-muted text-sm">No actions available</span>
                                  )}
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
