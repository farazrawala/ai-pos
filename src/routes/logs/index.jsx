import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchLogs,
  setSearch,
  setLogTag,
  setProductReference,
  setPage,
  setLimit,
  setSort,
} from '../../features/logs/logsSlice.js';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';

const productId = (p) => String(p?._id || p?.id || p?.product_id || '');
const productName = (p) => p?.name || p?.product_name || 'Product';

/** Logs list: show at most 40 chars; full URL in native tooltip on hover. */
function LogUrlCell({ url }) {
  const raw = url == null ? '' : String(url).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  const display = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
  return (
    <code className="text-xs" title={raw}>
      {display}
    </code>
  );
}

/** Single-line ellipsis in table; full text on hover via `title`. */
function LogDescriptionCell({ text, maxWidth = 'min(22rem, 38vw)' }) {
  const raw = text == null ? '' : String(text).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="text-truncate text-sm" style={{ maxWidth }} title={raw}>
      {raw}
    </div>
  );
}

const LOG_FILTER_TABS = [
  { id: '', label: 'ALL' },
  { id: 'API', label: 'API' },
  { id: 'get', label: 'GET' },
  { id: 'get-all-active', label: 'GET-ALL-ACTIVE' },
  { id: 'Cache', label: 'CACHE' },
  { id: 'delete', label: 'DELETE' },
  { id: 'remove-cache', label: 'REMOVE-CACHE' },
  { id: 'error', label: 'ERROR' },
  { id: 'rollback', label: 'ROLLBACK' },
  { id: 'update', label: 'UPDATE' },
  { id: 'inventory_movement', label: 'inventory_movement' },
  { id: 'sync', label: 'sync' },
  { id: 'in', label: 'in' },
  { id: 'out', label: 'out' },
  { id: 'wholesale_price', label: 'Wholesale Price' },
  { id: 'stock_alert', label: 'Stock Alert' },
];

const Logs = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    logTag,
    referenceId,
    referenceType,
    sort,
  } = useSelector((state) => state.logs);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  usePermissions('logs');
  useRequireModuleAccess('logs');

  useEffect(() => {
    let cancelled = false;
    setProductsStatus('loading');
    (async () => {
      try {
        const res = await fetchProductsRequest({ page: 1, limit: 2000 });
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) =>
          String(productName(a)).localeCompare(String(productName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setProducts(rows);
        setProductsStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load products for filter', err);
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
        const id = productId(p);
        if (!id) return null;
        const sku = p.sku || p.product_code || '';
        return {
          value: id,
          label: productName(p),
          subLabel: sku || undefined,
        };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All products' }, ...rows];
  }, [products]);

  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (logTag) params.tag = logTag;
    if (referenceId) {
      params.reference_id = referenceId;
      params.reference_type = referenceType || 'product';
    }
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchLogs(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    logTag,
    referenceId,
    referenceType,
    sort.sortBy,
    sort.sortOrder,
  ]);

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

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
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

  useEffect(() => {
    if (error) {
      console.error('[Logs module] Failed to fetch logs list', error);
    }
  }, [error]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const firstSegment = window.location.pathname.split('/')[1] || 'logs';
  const title =
    firstSegment.length > 0 ? firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1) : 'Logs';

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">{title}</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">
                      Audit log entries (read-only). Server-side pagination.
                    </p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <div style={{ minWidth: '220px', maxWidth: '280px', flex: '1 1 220px' }}>
                      <SearchableSelect
                        options={productOptions}
                        value={referenceId}
                        placeholder="All products"
                        disabled={loading || productsStatus === 'loading'}
                        onChange={(next) => dispatch(setProductReference(next))}
                      />
                      {productsStatus === 'loading' && (
                        <p className="text-xs text-muted mb-0 mt-1">Loading products…</p>
                      )}
                    </div>
                    <div className="input-group" style={{ maxWidth: '300px', flex: '1 1 200px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search logs..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-3 pt-3 pb-0">
              <div
                className="btn-group btn-group-sm flex-wrap"
                role="group"
                aria-label="Filter logs by tag"
              >
                {LOG_FILTER_TABS.map(({ id, label }) => {
                  const active = logTag === id;
                  return (
                    <button
                      key={id || 'all'}
                      type="button"
                      aria-pressed={active}
                      className={`btn mb-0 ${active ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => dispatch(setLogTag(id))}
                      disabled={loading}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading logs…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="logs-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>User</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('action')}
                        onDoubleClick={() => handleSort('action', true)}
                      >
                        Action
                        {renderSortIcon('action')}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('url')}
                        onDoubleClick={() => handleSort('url', true)}
                      >
                        URL
                        {renderSortIcon('url')}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('description')}
                        onDoubleClick={() => handleSort('description', true)}
                      >
                        Description
                        {renderSortIcon('description')}
                      </th>
                      <th>Tags</th>
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
                        Created at
                        {renderSortIcon('createdAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-sm font-weight-normal p-4">
                          No log entries found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const tags = Array.isArray(item.tags) ? item.tags : [];
                        const creatorName =
                          item?.created_by?.name ||
                          item?.createdBy?.name ||
                          item?.user?.name ||
                          item?.created_by_name ||
                          item?.createdByName ||
                          item?.userName ||
                          (typeof item?.created_by === 'string' ? item.created_by : '') ||
                          (typeof item?.createdBy === 'string' ? item.createdBy : '') ||
                          '—';
                        return (
                          <tr key={item._id || index}>
                            <td className="text-sm font-weight-normal">{seriesNumber}</td>
                            <td className="text-sm font-weight-normal">{creatorName}</td>
                            <td className="text-sm font-weight-normal align-middle">
                              <LogDescriptionCell
                                text={item.action ?? item.title ?? item.event}
                                maxWidth="min(16rem, 28vw)"
                              />
                            </td>
                            <td className="text-sm font-weight-normal text-break">
                              <LogUrlCell url={item.url} />
                            </td>
                            <td className="text-sm font-weight-normal align-middle">
                              <LogDescriptionCell
                                text={
                                  item.description ?? item.details ?? item.detail ?? item.message
                                }
                              />
                            </td>
                            <td className="text-sm font-weight-normal">
                              <div className="d-flex flex-wrap gap-1">
                                {tags.length === 0 ? (
                                  <span className="text-muted">—</span>
                                ) : (
                                  tags.map((t) => (
                                    <span key={t} className="badge bg-gradient-secondary">
                                      {t}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="text-sm font-weight-normal">
                              <span
                                className={`badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                              >
                                {item.status || '—'}
                              </span>
                            </td>
                            <td
                              className="text-sm font-weight-normal"
                              title={
                                item.createdAt || item.created_at
                                  ? moment(item.createdAt || item.created_at).format(
                                      'MM-DD-YYYY h:mm a'
                                    )
                                  : undefined
                              }
                            >
                              {item.createdAt || item.created_at
                                ? moment(item.createdAt || item.created_at).fromNow()
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

export default Logs;
