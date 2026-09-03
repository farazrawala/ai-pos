import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import moment from 'moment';
import {
  fetchStockMovements,
  setSearch,
  setProductId,
  setPage,
  setLimit,
  setSort,
} from '../../features/stockMovement/stockMovementSlice.js';
import {
  getProductLabel,
  getProductSku,
  getWarehouseLabel,
  getMovementQuantity,
  getMovementType,
  getReferenceDisplay,
  getReferenceType,
  getReferenceId,
  getCreatedByLabel,
} from '../../features/stockMovement/stockMovementAPI.js';
import { routeForReferenceType } from '../../components/transactions/TransactionDescriptionLinks.jsx';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import StockTransferForm from '../../components/stock/StockTransferForm.jsx';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';
import './stock-module.css';

const productOptionId = (p) => String(p?._id || p?.id || p?.product_id || '').trim();
const productOptionName = (p) => p?.name || p?.product_name || 'Product';

const movementBadgeClass = (type) => {
  if (type === 'in') return 'sm-pill sm-pill--in';
  if (type === 'out') return 'sm-pill sm-pill--out';
  return 'sm-pill sm-pill--neutral';
};

const formatQty = (qty, movementType) => {
  if (qty == null || qty === '') return '—';
  const n = Number(qty);
  if (!Number.isFinite(n)) return String(qty);
  if (movementType === 'out') return n > 0 ? `−${n}` : String(n);
  if (movementType === 'in') return n > 0 ? `+${n}` : String(n);
  return String(n);
};

const StockListing = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    productId,
    sort,
  } = useSelector((state) => state.stockMovement);
  const { canCreate, canEdit } = usePermissions('stock');
  useRequireModuleAccess('stock');
  const canTransfer = canCreate || canEdit;

  const loading = status === 'loading';
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);

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
        console.error('[Stock movement module] Failed to load products for filter', err);
        setProducts([]);
        setProductsStatus('failed');
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

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (productId) params.product_id = productId;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchStockMovements(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    productId,
    sort.sortBy,
    sort.sortOrder,
  ]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (error) {
      console.error('[Stock movement module] Failed to fetch stock movement list', error);
    }
  }, [error]);

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

  const refreshList = useCallback(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (productId) params.product_id = productId;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchStockMovements(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    productId,
    sort.sortBy,
    sort.sortOrder,
  ]);

  return (
    <div className="container-fluid py-4 px-0 stock-page" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card stock-page__card" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-5 col-md-6">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h5 className="stock-page__title mb-0">Stock movements</h5>
                    {canTransfer ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary mb-0"
                        onClick={() => setShowTransferForm(true)}
                      >
                        <i className="fas fa-arrow-right-arrow-left me-1" aria-hidden="true" />
                        Move stock
                      </button>
                    ) : null}
                  </div>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      <code className="small">
                        GET
                        /inventory_movements/get-all-active?populate=product_id,warehouse_id,created_by
                        {productId ? `&product_id=${productId}` : ''}
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-7 col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <div style={{ minWidth: '220px', maxWidth: '280px', flex: '1 1 220px' }}>
                      <SearchableSelect
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
                    <div
                      className="input-group input-group-sm"
                      style={{ maxWidth: '300px', flex: '1 1 200px' }}
                    >
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search products, barcode, reference…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search stock"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--stock"
                loading={loading}
                loadingLabel="Loading stock…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="stock-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th className="text-center list-col-sno">#</th>
                      {sortableTh('product_id', 'Product', 'list-col-truncate')}
                      <th className="list-col-warehouse">Warehouse</th>
                      {sortableTh('movement_type', 'Type')}
                      {sortableTh('quantity', 'Qty', 'text-end')}
                      {sortableTh('reference_type', 'Reference')}
                      {sortableTh('status', 'Status')}
                      <th className="list-col-truncate-sm">Moved by</th>
                      {sortableTh('createdAt', 'Date', 'list-col-date')}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-5 text-muted">
                          No stock movements found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item._id || item.id || index;
                        const movementType = getMovementType(item);
                        const qty = getMovementQuantity(item);
                        const ref = getReferenceDisplay(item);
                        const refType = getReferenceType(item);
                        const refRoute = routeForReferenceType(refType, getReferenceId(item));
                        const productLabel = getProductLabel(item);
                        const productSku = getProductSku(item);
                        const warehouse = getWarehouseLabel(item);
                        const movedBy = getCreatedByLabel(item);
                        const created = item.createdAt || item.created_at;
                        const isActive = String(item.status || '').toLowerCase() === 'active';
                        const qtyClass =
                          movementType === 'in'
                            ? 'sm-qty sm-qty--in'
                            : movementType === 'out'
                              ? 'sm-qty sm-qty--out'
                              : 'sm-qty';
                        const refEl = ref.primary ? (
                          <span className="sm-ref">
                            {refRoute ? (
                              <Link
                                to={refRoute.to}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sm-ref__code"
                                title={refRoute.title}
                              >
                                {ref.primary}
                              </Link>
                            ) : (
                              <span className="sm-ref__code sm-ref__code--plain" title={ref.title}>
                                {ref.primary}
                              </span>
                            )}
                            {ref.secondary ? <span className="sm-ref__type">{ref.secondary}</span> : null}
                          </span>
                        ) : null;
                        return (
                          <tr key={key}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            <td title={productLabel}>
                              <span className="sm-product">
                                <span className="sm-product__name">{productLabel || '—'}</span>
                                {productSku && productSku !== '—' ? (
                                  <span className="sm-product__sku">{productSku}</span>
                                ) : null}
                              </span>
                            </td>
                            <td className="text-sm list-cell-warehouse" title={warehouse || undefined}>
                              {warehouse || '—'}
                            </td>
                            <td className="text-sm">
                              {movementType ? (
                                <span className={movementBadgeClass(movementType)}>
                                  {movementType}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className={`text-sm text-end ${qtyClass}`}>
                              {formatQty(qty, movementType)}
                            </td>
                            <td className="text-sm">{refEl || '—'}</td>
                            <td className="text-sm">
                              {item.status ? (
                                <span className={`sm-pill ${isActive ? 'sm-pill--neutral' : 'sm-pill--out'}`}>
                                  {item.status}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-sm list-cell-truncate-sm sm-user" title={movedBy || undefined}>
                              {movedBy || '—'}
                            </td>
                            <td
                              className="text-sm list-col-date"
                              title={
                                created ? moment(created).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {created ? (
                                <span className="sm-date">
                                  <span className="sm-date__day">{moment(created).format('DD MMM YYYY')}</span>
                                  <span className="sm-date__rel">{moment(created).fromNow()}</span>
                                </span>
                              ) : (
                                '—'
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

      <StockTransferForm
        show={showTransferForm}
        onClose={() => setShowTransferForm(false)}
        onSuccess={refreshList}
      />
    </div>
  );
};

export default StockListing;
