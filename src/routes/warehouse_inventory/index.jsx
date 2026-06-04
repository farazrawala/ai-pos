import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchWarehouseInventory,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/warehouseInventory/warehouseInventorySlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

const formatQty = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString();
};

const WarehouseInventoryListing = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.warehouseInventory);

  usePermissions('warehouse-inventory');
  useRequireModuleAccess('warehouse-inventory');

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    dispatch(fetchWarehouseInventory(params));
  }, [dispatch, searchTerm]);

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
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <h5 className="mb-0">Warehouse inventory</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      <code className="small">
                        GET /warehouse_inventory/get-all-active?populate=product_id,warehouse_id
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
                        placeholder="Search products…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search warehouse inventory"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                        <td colSpan="7" className="text-center text-sm font-weight-normal p-4">
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
                            <td className="text-sm font-weight-normal">{item.productName || '—'}</td>
                            <td className="text-sm font-weight-normal">{item.barcode || '—'}</td>
                            <td className="text-sm font-weight-normal">{item.unit || '—'}</td>
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
