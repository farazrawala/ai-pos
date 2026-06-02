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
import StockTransferForm from '../../components/stock/StockTransferForm.jsx';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

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
  const { canView, canCreate, canEdit } = usePermissions('warehouse');
  const canTransfer = canCreate || canEdit;

  const loading = status === 'loading';
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

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
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h5 className="mb-0">Stock</h5>
                    {canTransfer ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary mb-0 ml-4"
                        onClick={() => setShowTransferForm(true)}
                      >
                        <i className="fas fa-plus me-1" aria-hidden="true" />
                        Move Stock
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
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search…"
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
                        <th>S.No</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Warehouse</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('movement_type')}
                          onDoubleClick={() => handleSort('movement_type', true)}
                        >
                          Movement
                          {renderSortIcon('movement_type')}
                        </th>
                        <th
                          className="text-end"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('quantity')}
                          onDoubleClick={() => handleSort('quantity', true)}
                        >
                          Qty
                          {renderSortIcon('quantity')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('reference_type')}
                          onDoubleClick={() => handleSort('reference_type', true)}
                        >
                          Reference
                          {renderSortIcon('reference_type')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('status')}
                          onDoubleClick={() => handleSort('status', true)}
                        >
                          Status
                          {renderSortIcon('status')}
                        </th>
                        <th>Moved by</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="text-center text-sm font-weight-normal p-4">
                            No stock found
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
                          return (
                            <tr key={key}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {getProductLabel(item)}
                              </td>
                              <td className="text-sm font-weight-normal">{getProductSku(item)}</td>
                              <td className="text-sm font-weight-normal">
                                {getWarehouseLabel(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {movementType ? (
                                  <span
                                    className={`badge ${
                                      movementType === 'in'
                                        ? 'bg-success'
                                        : movementType === 'out'
                                          ? 'bg-warning text-dark'
                                          : 'bg-secondary'
                                    }`}
                                  >
                                    {movementType.toUpperCase()}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal text-end">
                                {qty != null ? qty : '—'}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {refName || refType ? (
                                  <>
                                    {refType ? (
                                      <span className="badge bg-light text-dark border mt-1">
                                        {refType
                                          .replace(/_/g, ' ')
                                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.status ? (
                                  <span
                                    className={`badge ${
                                      String(item.status).toLowerCase() === 'active'
                                        ? 'bg-success'
                                        : 'bg-secondary'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {getCreatedByLabel(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '—'}
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
