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
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import ProductWarehouseStockModal from '../../components/product/ProductWarehouseStockModal.jsx';
import FetchProductsModal from '../../components/product/FetchProductsModal.jsx';
import SyncProductsModal from '../../components/product/SyncProductsModal.jsx';
import ViewProductSyncModal from '../../components/product/ViewProductSyncModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
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

const productIdFromRecord = (item) => item?._id || item?.id || item?.product_id || '';

const statusBadgeClass = (active) => (active ? 'bg-gradient-success' : 'bg-gradient-secondary');

const productIsActive = (item) => item?.status === 'active' || item?.isActive || item?.status === 1;

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
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchProducts(params));
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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">Products</h5>
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
                        placeholder="Search products…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search products"
                      />
                    </div>
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
                      <th className="list-col-product-img">Image</th>
                      {sortableTh('name', 'Name', 'list-col-truncate')}
                      {sortableTh('stock', 'Stock', 'text-end list-col-stock')}
                      {sortableTh('wholesale_price', 'Wholesale', 'text-end list-col-amount')}
                      {sortableTh('price', 'Price', 'text-end list-col-amount')}
                      {sortableTh('tax_rate', 'Tax', 'text-center list-col-tax')}
                      {sortableTh('alert_qty', 'Alert', 'text-center list-col-qty')}
                      {sortableTh('barcode', 'Barcode', 'list-col-truncate-sm font-monospace')}
                      {sortableTh('product_type', 'Type', 'list-col-truncate-sm')}
                      {sortableTh('status', 'Status')}
                      {sortableTh('createdAt', 'Created', 'list-col-date')}
                      <th className="text-end list-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-5 text-muted">
                          No products found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const productId = productIdFromRecord(item);
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
                            <td
                              className="text-sm font-weight-bold text-dark list-cell-truncate"
                              title={productName !== 'Product' ? productName : undefined}
                            >
                              {productName}
                            </td>
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
                            <td className="text-sm text-end text-nowrap list-col-amount">
                              {item.wholesale_price != null && item.wholesale_price !== ''
                                ? formatMoney(item.wholesale_price)
                                : '—'}
                            </td>
                            <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                              {item.price || item.product_price
                                ? formatMoney(item.price || item.product_price || 0)
                                : '—'}
                            </td>
                            <td className="text-sm text-center">
                              {taxRate == null || taxRate === ''
                                ? '—'
                                : (() => {
                                    const n = parseFloat(taxRate);
                                    return Number.isFinite(n) ? `${n}%` : String(taxRate);
                                  })()}
                            </td>
                            <td className="text-sm text-center">{alertQty}</td>
                            <td
                              className="text-sm font-monospace list-cell-truncate-sm"
                              title={barcode !== '—' ? barcode : undefined}
                            >
                              {barcode}
                            </td>
                            <td
                              className="text-sm list-cell-truncate-sm text-capitalize"
                              title={productType !== '—' ? productType : undefined}
                            >
                              {productType}
                            </td>
                            <td className="text-sm">
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className={`badge text-xxs ${statusBadgeClass(isActive)}`}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                {canEdit ? (
                                  <div className="form-check form-switch mb-0 list-status-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      role="switch"
                                      id={`toggle-${productId || index}`}
                                      checked={isActive}
                                      onChange={() => handleToggleStatus(productId, isActive)}
                                      disabled={isToggling}
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
                                ) : null}
                              </div>
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
                                    onClick={() => navigate(`/products/edit/${productId}`)}
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
