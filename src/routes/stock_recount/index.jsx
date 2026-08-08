import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchStockRecounts,
  setSearch,
  setWarehouseId,
  setPage,
  setLimit,
  setSort,
} from '../../features/stockRecount/stockRecountSlice.js';
import {
  fetchActiveWarehousesRequest,
  formatQty,
  shortSessionId,
} from '../../features/stockRecount/stockRecountAPI.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';

const warehouseOptionId = (w) => String(w?._id || w?.id || '').trim();
const warehouseOptionName = (w) => w?.name || w?.warehouse_name || w?.code || 'Warehouse';

const StockRecountIndex = () => {
  useRequireModuleAccess('stock-recounts');
  const { canCreate } = usePermissions('stock-recounts');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    warehouseId,
    sort,
  } = useSelector((state) => state.stockRecount);
  const loading = listStatus === 'loading';
  const error = listError;
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesStatus, setWarehousesStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setWarehousesStatus('loading');
    (async () => {
      try {
        const rows = await fetchActiveWarehousesRequest({ limit: 1000 });
        if (cancelled) return;
        rows.sort((a, b) =>
          String(warehouseOptionName(a)).localeCompare(String(warehouseOptionName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setWarehouses(rows);
        setWarehousesStatus('succeeded');
      } catch {
        if (cancelled) return;
        setWarehouses([]);
        setWarehousesStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const warehouseOptions = useMemo(() => {
    const rows = warehouses
      .map((w) => {
        const id = warehouseOptionId(w);
        if (!id) return null;
        return { value: id, label: warehouseOptionName(w) };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All warehouses' }, ...rows];
  }, [warehouses]);

  useEffect(() => {
    const params = { limit: 5000, skip: 0, sortBy: 'createdAt', sortOrder: 'desc' };
    if (warehouseId) params.warehouse_id = warehouseId;
    dispatch(fetchStockRecounts(params));
  }, [dispatch, warehouseId]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

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

  const loadRecounts = () => {
    const params = { limit: 5000, skip: 0, sortBy: 'createdAt', sortOrder: 'desc' };
    if (warehouseId) params.warehouse_id = warehouseId;
    dispatch(fetchStockRecounts(params));
  };

  const colCount = 8;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-5 col-md-5">
                  <h5 className="mb-1">Stock recounts</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      List from <code className="text-xs">GET /stock_recount/get-all-active</code>
                      {' · '}
                      start via <code className="text-xs">POST /stock_recount/start</code>
                    </p>
                  ) : (
                    <p className="text-sm mb-0 text-muted">Physical count sessions by warehouse</p>
                  )}
                </div>
                <div className="col-lg-7 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div style={{ minWidth: '180px', maxWidth: '240px', flex: '1 1 180px' }}>
                      <SearchableSelect
                        options={warehouseOptions}
                        value={warehouseId}
                        placeholder="All warehouses"
                        disabled={loading || warehousesStatus === 'loading'}
                        onChange={(next) => dispatch(setWarehouseId(next))}
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ maxWidth: '240px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search recounts…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search stock recounts"
                      />
                    </div>
                    {canCreate ? (
                      <AddNewButton to="/stock-recounts/add" label="Start recount" size="sm" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--stock-recounts"
                loading={loading}
                loadingLabel="Loading stock recounts…"
                error={error}
                onRetry={loadRecounts}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="stock-recounts-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th className="text-center list-col-sno">#</th>
                      <th>Session</th>
                      {sortableTh('warehouse', 'Warehouse')}
                      {sortableTh('lineCount', 'Products', 'text-end')}
                      {sortableTh('countedCount', 'Counted', 'text-end')}
                      <th className="text-end">Variance</th>
                      {sortableTh('status', 'Status')}
                      {sortableTh('createdAt', 'Created', 'list-col-date')}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="text-center py-5 text-muted">
                          No stock recounts yet. Start a recount to snapshot warehouse quantities.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const inProgress = item.status === 'in_progress';
                        return (
                          <tr
                            key={item.stockRecountId}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/stock-recounts/${item.stockRecountId}`)}
                          >
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            <td className="text-sm font-weight-bold text-dark">
                              #{shortSessionId(item.stockRecountId)}
                              {item.createdByName && item.createdByName !== '—' ? (
                                <div className="text-xs text-muted font-weight-normal">
                                  {item.createdByName}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-sm">{item.warehouseName || '—'}</td>
                            <td className="text-sm text-end">{item.lineCount}</td>
                            <td className="text-sm text-end">
                              {item.countedCount}/{item.lineCount}
                            </td>
                            <td className="text-sm text-end">
                              {item.varianceCount > 0 ? (
                                <span className="badge bg-gradient-warning text-xxs mb-0">
                                  {item.varianceCount} · {formatQty(item.totalVarianceQty)}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="text-sm">
                              <span
                                className={`badge text-xxs ${
                                  inProgress ? 'bg-gradient-info' : 'bg-gradient-success'
                                }`}
                              >
                                {inProgress ? 'In progress' : 'Counted'}
                              </span>
                            </td>
                            <td
                              className="text-sm text-nowrap list-col-date"
                              title={
                                item.createdAt
                                  ? moment(item.createdAt).format('DD MMM YYYY h:mm a')
                                  : undefined
                              }
                            >
                              {item.createdAt
                                ? moment(item.createdAt).format('DD MMM YYYY h:mm a')
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
    </div>
  );
};

export default StockRecountIndex;
