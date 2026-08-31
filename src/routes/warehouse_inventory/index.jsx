import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FaArrowsRotate, FaFilter } from 'react-icons/fa6';
import {
  fetchWarehouseInventory,
  setSearch,
  setProductId,
  setPage,
  setLimit,
  setSort,
  setFilters,
  clearFilters,
} from '../../features/warehouseInventory/warehouseInventorySlice.js';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { collectGroupedProductUnits } from '../../features/warehouseInventory/warehouseInventoryAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { DEBUG } from '../../config/env.js';
import { formatMoney } from '../../utils/formatMoney.js';

const productOptionId = (p) => String(p?._id || p?.id || p?.product_id || '').trim();
const productOptionName = (p) => p?.name || p?.product_name || 'Product';

const categoryOptionValue = (c) => String(c?._id ?? c?.id ?? '');
const categoryOptionLabel = (c) => {
  const name = c?.name ?? c?.category_name ?? '';
  return name ? String(name) : categoryOptionValue(c) || 'Category';
};

const formatQty = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString();
};

const formatPrice = (n) => {
  if (n == null || n === '') return '—';
  return formatMoney(n);
};

const WarehouseInventoryListing = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    groupedAll,
    status,
    error,
    pagination,
    search: searchTerm,
    productId,
    filters,
    sort,
  } = useSelector((state) => state.warehouseInventory);

  usePermissions('warehouse-inventory');
  useRequireModuleAccess('warehouse-inventory');

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  const activeFilterCount =
    (productId ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.minPrice !== '' ? 1 : 0) +
    (filters.maxPrice !== '' ? 1 : 0) +
    (filters.unit ? 1 : 0) +
    (filters.minStock !== '' ? 1 : 0) +
    (filters.maxStock !== '' ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    setProductsStatus('loading');
    (async () => {
      try {
        const res = await fetchProductsRequest({ page: 1, limit: 2000 });
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) =>
          String(productOptionName(a)).localeCompare(String(productOptionName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setProducts(rows);
        setProductsStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Warehouse inventory] Failed to load products for filter', err);
        setProducts([]);
        setProductsStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCategoriesStatus('loading');
    (async () => {
      try {
        const result = await fetchCategoriesRequest({ page: 1, limit: 2000 });
        if (cancelled) return;
        const rows = Array.isArray(result?.data) ? result.data : [];
        rows.sort((a, b) =>
          String(categoryOptionLabel(a)).localeCompare(String(categoryOptionLabel(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setCategories(rows);
        setCategoriesStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Warehouse inventory] Failed to load categories for filter', err);
        setCategories([]);
        setCategoriesStatus('failed');
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

  const unitOptions = useMemo(() => {
    const units = collectGroupedProductUnits(groupedAll);
    return [{ value: '', label: 'All units' }, ...units.map((unit) => ({ value: unit, label: unit }))];
  }, [groupedAll]);

  useEffect(() => {
    const params = {};
    if (productId) params.product_id = productId;
    dispatch(fetchWarehouseInventory(params));
  }, [dispatch, productId]);

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

  const handleFilterChange = useCallback(
    (key, value) => {
      dispatch(setFilters({ [key]: value }));
    },
    [dispatch]
  );

  const handleClearFilters = useCallback(() => {
    dispatch(clearFilters());
    dispatch(setProductId(''));
  }, [dispatch]);

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

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <div className="row align-items-center gy-2">
                <div className="col-md-5">
                  <h5 className="mb-0">Warehouse inventory</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      <code className="small">
                        GET /warehouse_inventory/get-all-active?populate=product_id,warehouse_id
                        {productId ? `&product_id=${productId}` : ''}
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="col-md-7">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 overflow-visible">
                    <div
                      className="d-flex align-items-center gap-2 flex-grow-1 flex-md-grow-0"
                      style={{ minWidth: 0, maxWidth: '420px' }}
                    >
                      <div className="input-group input-group-sm flex-grow-1">
                        <span className="input-group-text text-body">
                          <SearchInputIcon />
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search name, barcode, or SKU…"
                          value={localSearch}
                          onChange={handleSearchChange}
                          aria-label="Search warehouse inventory"
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm mb-0 flex-shrink-0 position-relative ${
                          showFilters || activeFilterCount > 0
                            ? 'btn-primary'
                            : 'btn-outline-primary'
                        }`}
                        onClick={() => setShowFilters((prev) => !prev)}
                        aria-expanded={showFilters}
                        aria-controls="warehouse-inventory-filter-panel"
                        aria-label="Filters"
                        title="Filters"
                      >
                        <NavIcon icon={FaFilter} size={14} />
                        {activeFilterCount > 0 ? (
                          <span
                            className="badge bg-gradient-danger text-white rounded-pill position-absolute"
                            style={{ top: '-0.35rem', right: '-0.35rem', fontSize: '0.65rem' }}
                          >
                            {activeFilterCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showFilters ? (
              <div className="card-body pt-0 px-3 pb-0">
                <div className="orders-filter-panel" id="warehouse-inventory-filter-panel">
                  <div className="row g-3 align-items-end">
                    <div className="col-xl-3 col-md-6 col-sm-12">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-product-filter"
                      >
                        Product
                      </label>
                      <SearchableSelect
                        id="wi-product-filter"
                        options={productOptions}
                        value={productId}
                        placeholder="All products"
                        disabled={loading || productsStatus === 'loading'}
                        onChange={(next) => dispatch(setProductId(next))}
                      />
                      {productsStatus === 'loading' ? (
                        <p className="text-xs text-muted mb-0 mt-1">Loading products…</p>
                      ) : null}
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-category-filter"
                      >
                        Category
                      </label>
                      <select
                        id="wi-category-filter"
                        className="form-select form-select-sm"
                        value={filters.categoryId}
                        onChange={(e) => handleFilterChange('categoryId', e.target.value)}
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
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-unit-filter"
                      >
                        Unit
                      </label>
                      <select
                        id="wi-unit-filter"
                        className="form-select form-select-sm"
                        value={filters.unit}
                        onChange={(e) => handleFilterChange('unit', e.target.value)}
                        disabled={loading && unitOptions.length <= 1}
                        aria-label="Filter by unit"
                      >
                        {unitOptions.map((opt) => (
                          <option key={opt.value || 'all'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-min-stock-filter"
                      >
                        Min stock
                      </label>
                      <input
                        id="wi-min-stock-filter"
                        type="number"
                        min="0"
                        step="1"
                        className="form-control form-control-sm"
                        placeholder="Min"
                        value={filters.minStock}
                        onChange={(e) => handleFilterChange('minStock', e.target.value)}
                        aria-label="Minimum total stock"
                      />
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-max-stock-filter"
                      >
                        Max stock
                      </label>
                      <input
                        id="wi-max-stock-filter"
                        type="number"
                        min="0"
                        step="1"
                        className="form-control form-control-sm"
                        placeholder="Max"
                        value={filters.maxStock}
                        onChange={(e) => handleFilterChange('maxStock', e.target.value)}
                        aria-label="Maximum total stock"
                      />
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-min-price-filter"
                      >
                        Min price
                      </label>
                      <input
                        id="wi-min-price-filter"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        placeholder="Min"
                        value={filters.minPrice}
                        onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                        aria-label="Minimum retail price"
                      />
                    </div>
                    <div className="col-xl-2 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="wi-max-price-filter"
                      >
                        Max price
                      </label>
                      <input
                        id="wi-max-price-filter"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        placeholder="Max"
                        value={filters.maxPrice}
                        onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                        aria-label="Maximum retail price"
                      />
                    </div>
                    <div className="col-xl-2 col-md-12 d-flex flex-wrap align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mb-0"
                        onClick={handleClearFilters}
                        disabled={activeFilterCount === 0}
                      >
                        <NavIcon icon={FaArrowsRotate} className="me-1" size={14} />
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading warehouse inventory…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="warehouse-inventory-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('product_name')}
                        onDoubleClick={() => handleSort('product_name', true)}
                      >
                        Product
                        {renderSortIcon('product_name')}
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
                        onClick={() => handleSort('unit')}
                        onDoubleClick={() => handleSort('unit', true)}
                      >
                        Unit
                        {renderSortIcon('unit')}
                      </th>
                      <th
                        className="text-end"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('price')}
                        onDoubleClick={() => handleSort('price', true)}
                      >
                        Retail price
                        {renderSortIcon('price')}
                      </th>
                      <th
                        className="text-end"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('wholesale_price')}
                        onDoubleClick={() => handleSort('wholesale_price', true)}
                      >
                        Wholesale price
                        {renderSortIcon('wholesale_price')}
                      </th>
                      <th
                        className="text-end"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('quantity')}
                        onDoubleClick={() => handleSort('quantity', true)}
                      >
                        Total stock
                        {renderSortIcon('quantity')}
                      </th>
                      <th>Stock by warehouse</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('updatedAt')}
                        onDoubleClick={() => handleSort('updatedAt', true)}
                      >
                        Last updated
                        {renderSortIcon('updatedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
                          No warehouse inventory found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item.productId || index;
                        return (
                          <tr key={key}>
                            <td className="text-sm font-weight-normal">{seriesNumber}</td>
                            <td className="text-sm font-weight-normal">
                              {item.productId ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 mb-0 text-dark text-decoration-none text-start"
                                  title={`Open ${item.productName || 'product'}`}
                                  onClick={() => navigate(`/products/edit/${item.productId}`)}
                                >
                                  {item.productName || '—'}
                                </button>
                              ) : (
                                item.productName || '—'
                              )}
                            </td>
                            <td className="text-sm font-weight-normal">{item.barcode || '—'}</td>
                            <td className="text-sm font-weight-normal">{item.unit || '—'}</td>
                            <td className="text-sm font-weight-normal text-end text-nowrap">
                              {formatPrice(item.retailPrice)}
                            </td>
                            <td className="text-sm font-weight-normal text-end text-nowrap">
                              {formatPrice(item.wholesalePrice)}
                            </td>
                            <td className="text-sm font-weight-normal text-end">
                              <span className="badge bg-gradient-dark text-white mb-0">
                                {formatQty(item.totalQuantity)}
                              </span>
                            </td>
                            <td className="text-sm font-weight-normal">
                              {item.warehouseLines?.length > 0 ? (
                                <div className="d-flex flex-wrap gap-1">
                                  {item.warehouseLines.map((line) => (
                                    <span
                                      key={line.key}
                                      className="badge bg-light text-dark border mb-0"
                                      title={`${line.warehouseName} — ${formatQty(line.quantity)}`}
                                    >
                                      {line.warehouseName}: {formatQty(line.quantity)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td
                              className="text-sm font-weight-normal"
                              title={
                                item.latestUpdatedAt
                                  ? moment(item.latestUpdatedAt).format('MM-DD-YYYY h:mm a')
                                  : undefined
                              }
                            >
                              {item.latestUpdatedAt ? moment(item.latestUpdatedAt).fromNow() : '—'}
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

export default WarehouseInventoryListing;
