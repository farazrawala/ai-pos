import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchStockMovements,
  setSearch,
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
  getReferenceName,
  getReferenceType,
  getCreatedByLabel,
} from '../../features/stockMovement/stockMovementAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import StockTransferForm from '../../components/stock/StockTransferForm.jsx';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

const movementBadgeClass = (type) => {
  if (type === 'in') return 'bg-gradient-success';
  if (type === 'out') return 'bg-gradient-warning';
  return 'bg-gradient-secondary';
};

const StockListing = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.stockMovement);
  const { canView, canCreate, canEdit } = usePermissions('stock');
  useRequireModuleAccess('stock');
  const canTransfer = canCreate || canEdit;

  const loading = status === 'loading';
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchStockMovements(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchStockMovements(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-5 col-md-6">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h5 className="mb-0">Stock movements</h5>
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
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-7 col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '300px' }}>
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
                      <th className="list-col-truncate-sm">Barcode</th>
                      <th className="list-col-truncate-sm">Warehouse</th>
                      {sortableTh('movement_type', 'Movement')}
                      {sortableTh('quantity', 'Qty', 'text-end')}
                      {sortableTh('reference_type', 'Reference', 'list-col-truncate')}
                      {sortableTh('status', 'Status')}
                      <th className="list-col-truncate-sm">Moved by</th>
                      {sortableTh('createdAt', 'Created', 'list-col-date')}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-5 text-muted">
                          No stock movements found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item._id || item.id || index;
                        const movementType = getMovementType(item);
                        const qty = getMovementQuantity(item);
                        const refName = getReferenceName(item);
                        const refType = getReferenceType(item);
                        const productLabel = getProductLabel(item);
                        const sku = getProductSku(item);
                        const warehouse = getWarehouseLabel(item);
                        const movedBy = getCreatedByLabel(item);
                        const created = item.createdAt || item.created_at;
                        const isActive = String(item.status || '').toLowerCase() === 'active';
                        return (
                          <tr key={key}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            <td
                              className="text-sm font-weight-bold text-dark list-cell-truncate"
                              title={productLabel}
                            >
                              {productLabel || '—'}
                            </td>
                            <td
                              className="text-sm text-muted list-cell-truncate-sm"
                              title={sku || undefined}
                            >
                              {sku || '—'}
                            </td>
                            <td
                              className="text-sm list-cell-truncate-sm"
                              title={warehouse || undefined}
                            >
                              {warehouse || '—'}
                            </td>
                            <td className="text-sm">
                              {movementType ? (
                                <span
                                  className={`badge text-xxs ${movementBadgeClass(movementType)}`}
                                >
                                  {movementType.toUpperCase()}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-sm text-end font-weight-bold">
                              {qty != null ? qty : '—'}
                            </td>
                            <td className="text-sm list-cell-truncate">
                              {refName || refType ? (
                                <div className="d-flex flex-column gap-1">
                                  {refName ? (
                                    <span className="text-truncate" title={refName}>
                                      {refName}
                                    </span>
                                  ) : null}
                                  {refType ? (
                                    <span className="badge text-xxs bg-light text-dark border align-self-start">
                                      {refType
                                        .replace(/_/g, ' ')
                                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-sm">
                              {item.status ? (
                                <span
                                  className={`badge text-xxs ${
                                    isActive ? 'bg-gradient-success' : 'bg-gradient-secondary'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td
                              className="text-sm list-cell-truncate-sm"
                              title={movedBy || undefined}
                            >
                              {movedBy || '—'}
                            </td>
                            <td
                              className="text-sm text-nowrap list-col-date"
                              title={
                                created ? moment(created).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {created ? moment(created).fromNow() : '—'}
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
