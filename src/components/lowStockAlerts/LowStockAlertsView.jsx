import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBoxOpen, FaRotateRight, FaTriangleExclamation } from 'react-icons/fa6';
import {
  fetchAllLowStockAlerts,
  rowMatchesLowStockDate,
  rowMatchesLowStockSearch,
  sortLowStockRows,
} from '../../features/alerts/alertsAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { withBase } from '../../config/appBase.js';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import { toast } from '../../utils/toast.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../NavIcon.jsx';
import SearchInputIcon from '../SearchInputIcon.jsx';
import ListSortableTh from '../list/ListSortableTh.jsx';
import TablePagination from '../TablePagination.jsx';

const NUMERIC_SORT_KEYS = new Set(['stock', 'alertQty', 'shortage', 'price', 'wholesalePrice']);

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatQty(value) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toLocaleString('en-PK');
}

function formatAlertDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  if (status === 'out') {
    return <span className="badge badge-sm bg-gradient-danger">Out of stock</span>;
  }
  return <span className="badge badge-sm bg-gradient-warning">Low stock</span>;
}

function timeProgressFloor(elapsedMs) {
  if (elapsedMs < 1200) return 14 + (elapsedMs / 1200) * 26;
  if (elapsedMs < 5000) return 40 + ((elapsedMs - 1200) / 3800) * 28;
  return Math.min(88, 68 + ((elapsedMs - 5000) / 10000) * 20);
}

function KpiCard({ label, value, hint, tone }) {
  return (
    <div className="card lsa-kpi h-100 mb-0">
      <div className="card-body p-3">
        <div className="lsa-kpi__label mb-1">{label}</div>
        <div className={`lsa-kpi__value${tone ? ` lsa-kpi__value--${tone}` : ''}`}>{value}</div>
        {hint ? <div className="text-xs text-muted mt-1">{hint}</div> : null}
      </div>
    </div>
  );
}

function LoadState({ elapsedMs }) {
  const percent = Math.min(92, timeProgressFloor(elapsedMs));
  return (
    <div className="lsa-load" role="status" aria-live="polite">
      <div className="d-flex justify-content-between align-items-baseline gap-3 mb-2">
        <div>
          <div className="lsa-load__label">Loading low stock alerts</div>
          <div className="text-xs text-muted">Checking on-hand quantity against alert levels…</div>
        </div>
        <div className="lsa-load__pct">{Math.round(percent)}%</div>
      </div>
      <div
        className="progress lsa-load__bar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Loading low stock alerts"
      >
        <div
          className="progress-bar progress-bar-striped progress-bar-animated"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="lsa-table-wrap mt-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="lsa-skel-row">
            <div className="lsa-skel lsa-skel--thumb" />
            <div className="lsa-skel-copy">
              <div className="lsa-skel lsa-skel--line" style={{ width: `${56 - (index % 3) * 8}%` }} />
              <div className="lsa-skel lsa-skel--line lsa-skel--line-sm" style={{ width: '28%' }} />
            </div>
            <div className="lsa-skel lsa-skel--metric" />
            <div className="lsa-skel lsa-skel--metric" />
            <div className="lsa-skel lsa-skel--metric" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LowStockAlertsView() {
  useRequireModuleAccess('low-stock-alerts');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('live');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSort, setTableSort] = useState({ key: 'shortage', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [loadElapsedMs, setLoadElapsedMs] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllLowStockAlerts({
        mode,
      });
      setItems(result.items);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Could not load low stock alerts');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      setLoadElapsedMs(0);
      return undefined;
    }
    const started = Date.now();
    setLoadElapsedMs(0);
    const timer = window.setInterval(() => setLoadElapsedMs(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [loading]);

  const filteredItems = useMemo(() => {
    return items.filter(
      (row) => rowMatchesLowStockSearch(row, searchQuery) && rowMatchesLowStockDate(row, customFrom, customTo)
    );
  }, [items, searchQuery, customFrom, customTo]);

  const displayedItems = useMemo(
    () => sortLowStockRows(filteredItems, tableSort.key, tableSort.dir),
    [filteredItems, tableSort.key, tableSort.dir]
  );

  const totalPages = Math.max(1, Math.ceil(displayedItems.length / Math.max(limit, 1)));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = displayedItems.slice((pageSafe - 1) * limit, pageSafe * limit);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, tableSort.key, tableSort.dir, limit, customFrom, customTo, mode]);

  const kpis = useMemo(() => {
    const out = filteredItems.filter((row) => row.status === 'out').length;
    const low = filteredItems.filter((row) => row.status === 'low').length;
    const shortage = filteredItems.reduce((sum, row) => sum + (Number(row.shortage) || 0), 0);
    return { total: filteredItems.length, out, low, shortage };
  }, [filteredItems]);

  const handleTableSort = (column, forceDesc = false) => {
    if (forceDesc) {
      setTableSort({ key: column, dir: 'desc' });
      return;
    }
    if (tableSort.key === column) {
      setTableSort({ key: column, dir: tableSort.dir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setTableSort({
      key: column,
      dir: NUMERIC_SORT_KEYS.has(column) ? 'desc' : 'asc',
    });
  };

  const handleExport = async (kind) => {
    if (!displayedItems.length) {
      toast.error('No alerts to export.');
      return;
    }
    const columns = [
      { key: 'name', label: 'Product' },
      { key: 'code', label: 'Code' },
      { key: 'sku', label: 'SKU' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'unit', label: 'Unit' },
      { key: 'stock', label: 'On hand' },
      { key: 'alertQty', label: 'Alert qty' },
      { key: 'shortage', label: 'Shortage' },
      { key: 'price', label: 'Price' },
      { key: 'wholesalePrice', label: 'Wholesale' },
      { key: 'status', label: 'Status', value: (row) => (row.status === 'out' ? 'Out of stock' : 'Low stock') },
      { key: 'alertCreatedAt', label: 'Alert date', value: (row) => row.alertCreatedAt || '' },
    ];
    const from = customFrom || 'all';
    const to = customTo || todayYmd();
    const filename = `low-stock-alerts-${from}-to-${to}`;
    setExporting(true);
    try {
      if (kind === 'csv') exportRowsToCsv({ columns, rows: displayedItems, filename });
      else if (kind === 'excel') {
        exportRowsToExcel({ columns, rows: displayedItems, filename, sheetTitle: 'Low stock alerts' });
      } else {
        await exportRowsToPdf({
          columns,
          rows: displayedItems,
          filename,
          title: `Low stock alerts (${displayedItems.length})`,
        });
      }
      toast.success(`Exported ${displayedItems.length} products.`);
    } catch (err) {
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const sort = { sortBy: tableSort.key, sortOrder: tableSort.dir };
  const thClass = 'text-xxs text-uppercase font-weight-bolder opacity-7';
  const canExport = !loading && !error && displayedItems.length > 0;
  const maxDate = todayYmd();

  return (
    <div className="container-fluid py-4 px-3 low-stock-alerts-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-xs font-weight-bolder text-primary mb-1">Inventory</p>
          <h4 className="mb-1">Low stock alerts</h4>
          <p className="text-sm text-muted mb-0">
            Products at or below their alert quantity — shortage, on-hand, and reorder level.
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary mb-0" onClick={load} disabled={loading}>
          <NavIcon icon={FaRotateRight} size={12} className={`me-1${loading ? ' lsa-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <KpiCard label="Alerts" value={formatQty(kpis.total)} hint="Products below alert qty" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard label="Out of stock" value={formatQty(kpis.out)} tone="danger" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard label="Low stock" value={formatQty(kpis.low)} tone="warning" />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard label="Units short" value={formatQty(kpis.shortage)} hint="Alert qty minus on hand" tone="danger" />
        </div>
      </div>

      <div className="card lsa-panel mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-sm-6 col-lg-3 col-xl-2">
              <label className="form-label text-xs text-uppercase" htmlFor="lsa-mode">
                Source
              </label>
              <select
                id="lsa-mode"
                className="form-select form-select-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="live">Current stock</option>
                <option value="records">Alert records</option>
              </select>
            </div>
            <div className="col-6 col-lg-3 col-xl-2">
              <label className="form-label text-xs text-uppercase" htmlFor="lsa-from">
                From
              </label>
              <input
                id="lsa-from"
                type="date"
                className="form-control form-control-sm"
                value={customFrom}
                max={customTo || maxDate}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="col-6 col-lg-3 col-xl-2">
              <label className="form-label text-xs text-uppercase" htmlFor="lsa-to">
                To
              </label>
              <input
                id="lsa-to"
                type="date"
                className="form-control form-control-sm"
                value={customTo}
                min={customFrom || undefined}
                max={maxDate}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <div className="col-sm-6 col-lg-3 col-xl-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mb-0"
                onClick={() => {
                  setCustomFrom('');
                  setCustomTo('');
                }}
              >
                Clear dates
              </button>
            </div>
          </div>
          <p className="text-xs text-muted mb-0 mt-2">
            Date range filters by alert created date when present. Leave blank to include every current alert.
          </p>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>
            <NavIcon icon={FaTriangleExclamation} size={14} className="me-2" />
            {error}
          </span>
          <button type="button" className="btn btn-sm btn-white mb-0" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="card lsa-panel mb-0">
        <div className="card-body">
          <div className="lsa-toolbar">
            <div className="lsa-toolbar__meta">
              {loading ? (
                <span className="lsa-chip lsa-chip--live">Updating…</span>
              ) : (
                <span className="lsa-chip lsa-chip--count">
                  {displayedItems.length.toLocaleString()} product{displayedItems.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="lsa-toolbar__actions">
              <div className="input-group input-group-sm lsa-search">
                <span className="input-group-text">
                  <SearchInputIcon />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search product, code, SKU…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                  aria-label="Search low stock alerts"
                />
              </div>
              <div className="btn-group btn-group-sm lsa-export" role="group" aria-label="Export">
                <button
                  type="button"
                  className="btn btn-outline-secondary mb-0"
                  disabled={!canExport || exporting}
                  onClick={() => handleExport('csv')}
                >
                  <i className="fas fa-file-csv me-1" aria-hidden="true" />
                  CSV
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary mb-0"
                  disabled={!canExport || exporting}
                  onClick={() => handleExport('excel')}
                >
                  <i className="fas fa-file-excel me-1" aria-hidden="true" />
                  Excel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary mb-0"
                  disabled={!canExport || exporting}
                  onClick={() => handleExport('pdf')}
                >
                  <i className="fas fa-file-pdf me-1" aria-hidden="true" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadState elapsedMs={loadElapsedMs} />
          ) : !error && displayedItems.length === 0 ? (
            <div className="alert alert-secondary py-3 mb-0" role="status">
              {items.length === 0
                ? 'No low stock alerts. All tracked products are above their alert levels.'
                : `No products match “${searchQuery.trim()}”.`}
            </div>
          ) : !error ? (
            <>
              <div className="table-responsive lsa-table-wrap">
                <table className="table align-items-center mb-0 lsa-table">
                  <thead>
                    <tr>
                      <ListSortableTh column="name" label="Product" sort={sort} onSort={handleTableSort} className={thClass} />
                      <ListSortableTh column="code" label="Code" sort={sort} onSort={handleTableSort} className={thClass} />
                      <ListSortableTh column="sku" label="SKU" sort={sort} onSort={handleTableSort} className={thClass} />
                      <ListSortableTh
                        column="stock"
                        label="On hand"
                        sort={sort}
                        onSort={handleTableSort}
                        className={`${thClass} text-end`}
                      />
                      <ListSortableTh
                        column="alertQty"
                        label="Alert"
                        sort={sort}
                        onSort={handleTableSort}
                        className={`${thClass} text-end`}
                      />
                      <ListSortableTh
                        column="shortage"
                        label="Shortage"
                        sort={sort}
                        onSort={handleTableSort}
                        className={`${thClass} text-end`}
                      />
                      <ListSortableTh
                        column="price"
                        label="Price"
                        sort={sort}
                        onSort={handleTableSort}
                        className={`${thClass} text-end`}
                      />
                      <ListSortableTh
                        column="status"
                        label="Status"
                        sort={sort}
                        onSort={handleTableSort}
                        className={`${thClass} text-center`}
                      />
                      <ListSortableTh
                        column="alertCreatedAt"
                        label="Alerted"
                        sort={sort}
                        onSort={handleTableSort}
                        className={thClass}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const imageUrl = row.image ? resolveCategoryMediaUrl(row.image) : '';
                      return (
                        <tr key={row.alertId || `${row.id}-${row.sku}-${row.code}`}>
                          <td>
                            <div className="lsa-product">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt=""
                                  className="lsa-thumb flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.src = withBase('/assets/img/default.jpg');
                                  }}
                                />
                              ) : (
                                <div className="lsa-thumb lsa-thumb--empty flex-shrink-0">
                                  <NavIcon
                                    icon={row.status === 'out' ? FaTriangleExclamation : FaBoxOpen}
                                    size={13}
                                    className={row.status === 'out' ? 'text-danger' : 'text-warning'}
                                  />
                                </div>
                              )}
                              <div className="min-width-0">
                                {row.id ? (
                                  <Link
                                    to={`/products/edit/${row.id}`}
                                    className="lsa-product__name d-block text-truncate"
                                    title={row.name}
                                  >
                                    {row.name}
                                  </Link>
                                ) : (
                                  <span className="lsa-product__name d-block text-truncate" title={row.name}>
                                    {row.name}
                                  </span>
                                )}
                                {row.barcode ? (
                                  <span className="lsa-product__code d-block text-truncate">{row.barcode}</span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="text-sm">{row.code || '—'}</td>
                          <td className="text-sm">{row.sku || '—'}</td>
                          <td className={`text-end text-sm font-weight-bold ${row.status === 'out' ? 'text-danger' : 'text-warning'}`}>
                            {formatQty(row.stock)}
                            {row.unit ? <span className="text-muted fw-normal ms-1">{row.unit}</span> : null}
                          </td>
                          <td className="text-end text-sm">{formatQty(row.alertQty)}</td>
                          <td className="text-end text-sm font-weight-bold text-danger">{formatQty(row.shortage)}</td>
                          <td className="text-end text-sm">
                            {row.price != null && row.price !== '' ? formatCurrency(Number(row.price)) : '—'}
                          </td>
                          <td className="text-center">{statusBadge(row.status)}</td>
                          <td className="text-sm text-muted">{formatAlertDate(row.alertCreatedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                pagination={{ page: pageSafe, limit, total: displayedItems.length, totalPages }}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
                selectId="low-stock-alerts-page-size"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
