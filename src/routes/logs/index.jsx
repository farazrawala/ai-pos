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

const toReadableLabel = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatLogDescriptionJson = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';

  const source = obj.source ?? obj.Source ?? '';
  const module = obj.module ?? obj.Module ?? '';
  const action = obj.action ?? obj.Action ?? obj.event ?? obj.Event ?? '';

  const lines = [];
  if (source) lines.push(`Source: ${toReadableLabel(source)}`);
  if (module) lines.push(`Module: ${toReadableLabel(module)}`);
  if (action) lines.push(`Action: ${toReadableLabel(action)}`);

  if (lines.length > 0) {
    return lines.join('\n');
  }

  const entries = Object.entries(obj)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => {
      const val =
        typeof v === 'object'
          ? JSON.stringify(v)
          : toReadableLabel(String(v));
      return `${toReadableLabel(k)}: ${val}`;
    });

  return entries.length > 0 ? entries.join('\n') : '';
};

const getLogHumanReadablePreview = (fullText) => {
  const raw = String(fullText ?? '').trim();
  if (!raw) return '';
  const oneLine = raw.replace(/\s*\n+\s*/g, ' · ');
  if (oneLine.length <= 40) return oneLine;
  return `${oneLine.slice(0, 40)}…`;
};

/** Prefer API field; otherwise parse JSON `description` like `{ source, module, action }`. */
const getLogHumanReadableDescription = (item) => {
  const explicit = item?.human_readable_description ?? item?.humanReadableDescription;
  if (explicit != null && String(explicit).trim() !== '') {
    return String(explicit).trim();
  }

  const rawDesc = item?.description ?? item?.details ?? item?.detail ?? item?.message;
  if (rawDesc == null) return '';
  const text = String(rawDesc).trim();
  if (!text) return '';

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const formatted = Array.isArray(parsed)
          ? parsed.map((entry) => formatLogDescriptionJson(entry)).filter(Boolean).join('\n\n')
          : formatLogDescriptionJson(parsed);
        if (formatted) return formatted;
      }
    } catch {
      /* keep raw text below */
    }
  }

  return text;
};

function LogHumanReadablePreviewCell({ fullText, onOpen }) {
  const raw = fullText == null ? '' : String(fullText).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  const preview = getLogHumanReadablePreview(raw);
  return (
    <button
      type="button"
      className="btn btn-link btn-sm p-0 mb-0 text-start text-decoration-none text-dark font-weight-normal"
      onClick={() => onOpen?.(raw)}
      title="View full details"
    >
      <span
        className="text-truncate d-inline-block text-sm"
        style={{ maxWidth: 'min(16rem, 28vw)' }}
      >
        {preview}
      </span>
    </button>
  );
}

function LogDetailsModal({ open, text, onClose }) {
  if (!open) return null;
  const body = String(text ?? '').trim();
  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="logDetailsModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="logDetailsModalLabel">
                Log details
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {body ? (
                <div
                  className="text-sm mb-0"
                  style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
                >
                  {body}
                </div>
              ) : (
                <span className="text-muted">No details available.</span>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}

const LOG_FILTER_TABS = [
  { id: '', label: 'ALL' },
  { id: '404', label: '404' },
  { id: 'API', label: 'API' },
  { id: 'Cache', label: 'CACHE' },
  { id: 'Inventory_movement', label: 'Inventory_movement' },
  { id: 'account', label: 'account' },
  { id: 'add', label: 'add' },
  { id: 'adjustment', label: 'adjustment' },
  { id: 'amount_transfer', label: 'amount_transfer' },
  { id: 'api', label: 'api' },
  { id: 'assets', label: 'assets' },
  { id: 'authenticated', label: 'authenticated' },
  { id: 'bulk-create', label: 'bulk-create' },
  { id: 'company', label: 'company' },
  { id: 'create', label: 'create' },
  { id: 'create-product-variation', label: 'create-product-variation' },
  { id: 'custom-create', label: 'custom-create' },
  { id: 'custom-update', label: 'custom-update' },
  { id: 'delete', label: 'DELETE' },
  { id: 'error', label: 'ERROR' },
  { id: 'expense', label: 'expense' },
  { id: 'fetch_order', label: 'fetch_order' },
  { id: 'generic_create', label: 'generic_create' },
  { id: 'generic_update', label: 'generic_update' },
  { id: 'get', label: 'GET' },
  { id: 'get-all-active', label: 'GET-ALL-ACTIVE' },
  { id: 'imported_woocommerce', label: 'imported_woocommerce' },
  { id: 'in', label: 'in' },
  { id: 'insert', label: 'insert' },
  { id: 'inventory', label: 'inventory' },
  { id: 'inventory_movement', label: 'inventory_movement' },
  { id: 'not_found', label: 'not_found' },
  { id: 'order', label: 'order' },
  { id: 'outer', label: 'outer' },
  { id: 'out', label: 'out' },
  { id: 'patch', label: 'patch' },
  { id: 'payment_receipt', label: 'payment_receipt' },
  { id: 'post', label: 'post' },
  { id: 'process', label: 'process' },
  { id: 'product', label: 'product' },
  { id: 'public', label: 'public' },
  { id: 'purchase_order', label: 'purchase_order' },
  { id: 'purchase_order_delete', label: 'purchase_order_delete' },
  { id: 'purchase_order_update', label: 'purchase_order_update' },
  { id: 'purchase_return', label: 'purchase_return' },
  { id: 'put', label: 'put' },
  { id: 'remove-cache', label: 'REMOVE-CACHE' },
  { id: 'rollback', label: 'ROLLBACK' },
  { id: 'sale', label: 'sale' },
  { id: 'sales_return', label: 'sales_return' },
  { id: 'save', label: 'save' },
  { id: 'signup', label: 'signup' },
  { id: 'skipped_woocommerce', label: 'skipped_woocommerce' },
  { id: 'soft_delete', label: 'soft_delete' },
  { id: 'stock', label: 'stock' },
  { id: 'stock_alert', label: 'Stock Alert' },
  { id: 'stock_transfer', label: 'stock_transfer' },
  { id: 'subtract', label: 'subtract' },
  { id: 'sync', label: 'sync' },
  { id: 'transaction', label: 'transaction' },
  { id: 'unexpected', label: 'unexpected' },
  { id: 'update', label: 'UPDATE' },
  { id: 'update-product-variation', label: 'update-product-variation' },
  { id: 'user', label: 'user' },
  { id: 'user_company', label: 'user_company' },
  { id: 'wac_replay', label: 'wac_replay' },
  { id: 'warehouse', label: 'warehouse' },
  { id: 'wholesale_price', label: 'Wholesale Price' },
  { id: 'woocommerce', label: 'woocommerce' },
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
  const [logDetailsText, setLogDetailsText] = useState(null);
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
                        onClick={() => handleSort('human_readable_description')}
                        onDoubleClick={() => handleSort('human_readable_description', true)}
                      >
                        Human readable description
                        {renderSortIcon('human_readable_description')}
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
                              <LogHumanReadablePreviewCell
                                fullText={getLogHumanReadableDescription(item)}
                                onOpen={setLogDetailsText}
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

      <LogDetailsModal
        open={logDetailsText != null}
        text={logDetailsText ?? ''}
        onClose={() => setLogDetailsText(null)}
      />
    </div>
  );
};

export default Logs;
