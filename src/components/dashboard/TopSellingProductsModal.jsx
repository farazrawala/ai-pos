import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { FaBoxOpen, FaChartLine, FaXmark } from 'react-icons/fa6';
import { fetchTopSellingProductsRequest } from '../../features/orders/ordersAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { withBase } from '../../config/appBase.js';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import { toast } from '../../utils/toast.js';
import NavIcon from '../NavIcon.jsx';
import SearchInputIcon from '../SearchInputIcon.jsx';
import ListSortableTh from '../list/ListSortableTh.jsx';
import '../order/customerOrderHistoryModal.css';
import './topSellingProductsModal.css';

const ALL_PRODUCTS_LIMIT = 100;

const PERIOD_OPTIONS = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '3w', label: '3 weeks' },
  { value: '1m', label: '1 month' },
  { value: '2m', label: '2 months' },
  { value: '3m', label: '3 months' },
  { value: 'custom', label: 'Custom' },
];

function todayYmd() {
  return moment().format('YYYY-MM-DD');
}

function defaultCustomRange() {
  return {
    from: moment().subtract(1, 'month').format('YYYY-MM-DD'),
    to: todayYmd(),
  };
}

function getDateRangeForPeriod(periodKey, custom = {}) {
  if (periodKey === 'custom') {
    return { from: custom.from || '', to: custom.to || '' };
  }
  const to = todayYmd();
  const ranges = {
    '1w': moment().subtract(7, 'days'),
    '2w': moment().subtract(14, 'days'),
    '3w': moment().subtract(21, 'days'),
    '1m': moment().subtract(1, 'month'),
    '2m': moment().subtract(2, 'months'),
    '3m': moment().subtract(3, 'months'),
  };
  const fromMoment = ranges[periodKey] || ranges['1m'];
  return { from: fromMoment.format('YYYY-MM-DD'), to };
}

function formatCustomRangeLabel(from, to) {
  if (!from || !to) return 'Custom';
  const start = moment(from, 'YYYY-MM-DD', true);
  const end = moment(to, 'YYYY-MM-DD', true);
  if (!start.isValid() || !end.isValid()) return 'Custom';
  return `${start.format('DD MMM YYYY')} – ${end.format('DD MMM YYYY')}`;
}

function rankClass(index) {
  if (index === 0) return 'tsp-modal__rank tsp-modal__rank--1';
  if (index === 1) return 'tsp-modal__rank tsp-modal__rank--2';
  if (index === 2) return 'tsp-modal__rank tsp-modal__rank--3';
  return 'tsp-modal__rank';
}

function formatSoldQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

function timeProgressFloor(elapsedMs) {
  if (elapsedMs < 1200) return 14 + (elapsedMs / 1200) * 26;
  if (elapsedMs < 5000) return 40 + ((elapsedMs - 1200) / 3800) * 28;
  return Math.min(88, 68 + ((elapsedMs - 5000) / 10000) * 20);
}

function TrendingLoadState({ elapsedMs }) {
  const percent = Math.min(92, timeProgressFloor(elapsedMs));
  return (
    <div className="tsp-modal__load" role="status" aria-live="polite">
      <div className="d-flex justify-content-between align-items-baseline gap-3 mb-2">
        <div>
          <div className="tsp-modal__load-label">Loading trending products</div>
          <div className="text-xs text-muted">Ranking sales for the selected period…</div>
        </div>
        <div className="tsp-modal__load-pct">{Math.round(percent)}%</div>
      </div>
      <div
        className="progress tsp-modal__load-bar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Loading trending products"
      >
        <div
          className="progress-bar progress-bar-striped progress-bar-animated"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="tsp-modal__table-wrap mt-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="tsp-modal__skel-row">
            <div className="tsp-modal__skel tsp-modal__skel--rank" />
            <div className="tsp-modal__skel tsp-modal__skel--thumb" />
            <div className="tsp-modal__skel-copy">
              <div className="tsp-modal__skel tsp-modal__skel--line" style={{ width: `${58 - (index % 3) * 8}%` }} />
              <div className="tsp-modal__skel tsp-modal__skel--line tsp-modal__skel--line-sm" style={{ width: '34%' }} />
            </div>
            <div className="tsp-modal__skel tsp-modal__skel--metric" />
            <div className="tsp-modal__skel tsp-modal__skel--metric" />
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultTableSort(sortBy) {
  return {
    key: sortBy === 'revenue' ? 'totalRevenue' : 'totalQty',
    dir: 'desc',
  };
}

const NUMERIC_SORT_KEYS = new Set(['rank', 'totalQty', 'totalRevenue', 'totalProfit']);

const TABLE_SORT_LABELS = {
  rank: 'By rank',
  name: 'By name',
  totalQty: 'By quantity',
  totalRevenue: 'By revenue',
  totalProfit: 'By profit',
};

function sortTrendingRows(rows, key, dir) {
  const list = [...rows];
  const factor = dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (key === 'name') {
      const cmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base',
      });
      return cmp !== 0 ? cmp * factor : a.rank - b.rank;
    }
    const av = Number(a[key]);
    const bv = Number(b[key]);
    const aNum = Number.isFinite(av) ? av : 0;
    const bNum = Number.isFinite(bv) ? bv : 0;
    if (aNum === bNum) return a.rank - b.rank;
    return (aNum - bNum) * factor;
  });
  return list;
}

function FilterField({ id, label, children }) {
  return (
    <div className="tsp-modal__field">
      <label className="tsp-modal__toolbar-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TopSellingProductsModal({ open, onClose, sortBy = 'qty' }) {
  const [selectedPeriod, setSelectedPeriod] = useState('1m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [activeSortBy, setActiveSortBy] = useState(sortBy);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [loadElapsedMs, setLoadElapsedMs] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSort, setTableSort] = useState(() => defaultTableSort(sortBy));

  useEffect(() => {
    if (!open) return undefined;

    const { from, to } = getDateRangeForPeriod(selectedPeriod, {
      from: customFrom,
      to: customTo,
    });
    if (!from || !to) return undefined;
    if (from > to) {
      setError('From date must be on or before To date.');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProducts([]);

    fetchTopSellingProductsRequest({
      from,
      to,
      sort_by: sortBy,
      limit: ALL_PRODUCTS_LIMIT,
    })
      .then((result) => {
        if (cancelled) return;
        setProducts(result.products);
        setActiveSortBy(result.sortBy);
        setTotal(result.total || result.products.length);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setProducts([]);
        setTotal(0);
        setError(e?.message || 'Could not load trending products');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedPeriod, customFrom, customTo, sortBy]);

  useEffect(() => {
    if (!open) {
      setSelectedPeriod('1m');
      setCustomFrom('');
      setCustomTo('');
      setSearchQuery('');
      setTableSort(defaultTableSort(sortBy));
    }
  }, [open, sortBy]);

  useEffect(() => {
    if (!open || !loading) {
      setLoadElapsedMs(0);
      return undefined;
    }
    const started = Date.now();
    setLoadElapsedMs(0);
    const timer = window.setInterval(() => {
      setLoadElapsedMs(Date.now() - started);
    }, 200);
    return () => window.clearInterval(timer);
  }, [open, loading]);

  const rankedProducts = useMemo(
    () => products.map((row, index) => ({ ...row, rank: index + 1 })),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedProducts;
    return rankedProducts.filter((row) => {
      const haystack = [row.name, row.code, row.sku, row.productId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rankedProducts, searchQuery]);

  const displayedProducts = useMemo(
    () => sortTrendingRows(filteredProducts, tableSort.key, tableSort.dir),
    [filteredProducts, tableSort.key, tableSort.dir]
  );

  const handlePeriodChange = (value) => {
    setSelectedPeriod(value);
    if (value === 'custom' && (!customFrom || !customTo)) {
      const seeded = defaultCustomRange();
      setCustomFrom(seeded.from);
      setCustomTo(seeded.to);
    }
  };

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

  if (!open) return null;

  const sortLabel = TABLE_SORT_LABELS[tableSort.key] || (activeSortBy === 'revenue' ? 'By revenue' : 'By quantity');
  const selectedPeriodLabel =
    selectedPeriod === 'custom'
      ? formatCustomRangeLabel(customFrom, customTo)
      : PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.label || '1 month';
  const range = getDateRangeForPeriod(selectedPeriod, { from: customFrom, to: customTo });
  const maxDate = todayYmd();
  const searchActive = Boolean(searchQuery.trim());
  const canExport = !loading && !error && displayedProducts.length > 0;
  const countLabel = searchActive
    ? `${filteredProducts.length.toLocaleString()} of ${products.length.toLocaleString()} products`
    : `${(total || products.length).toLocaleString()} product${(total || products.length) === 1 ? '' : 's'}`;

  const handleExport = async (kind) => {
    if (!displayedProducts.length) {
      toast.error('No products to export.');
      return;
    }
    const columns = [
      { key: 'rank', label: '#' },
      { key: 'name', label: 'Product' },
      { key: 'code', label: 'Code' },
      { key: 'sku', label: 'SKU' },
      { key: 'sold', label: 'Sold' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'profit', label: 'Profit' },
    ];
    const rows = displayedProducts.map((row) => ({
      rank: row.rank,
      name: row.name,
      code: row.code || '',
      sku: row.sku || '',
      sold: row.totalQty,
      revenue: row.totalRevenue,
      profit: row.totalProfit,
    }));
    const from = range.from || 'start';
    const to = range.to || 'end';
    const filename = `trending-products-${from}-to-${to}`;
    setExporting(true);
    try {
      if (kind === 'csv') exportRowsToCsv({ columns, rows, filename });
      else if (kind === 'excel') {
        exportRowsToExcel({ columns, rows, filename, sheetTitle: 'Trending products' });
      } else {
        await exportRowsToPdf({
          columns,
          rows,
          filename,
          title: `Trending products (${selectedPeriodLabel})`,
        });
      }
      toast.success(`Exported ${rows.length} products.`);
    } catch (err) {
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="topSellingProductsModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable tsp-modal">
          <div className="modal-content coh-modal">
            <div className="modal-header coh-modal__header border-0 pb-0">
              <div className="d-flex align-items-start gap-3 min-width-0">
                <div className="coh-modal__icon" aria-hidden="true">
                  <NavIcon icon={FaChartLine} size={16} />
                </div>
                <div className="min-width-0">
                  <p className="coh-modal__eyebrow mb-1">Sales analytics</p>
                  <h5 className="modal-title coh-modal__title mb-0" id="topSellingProductsModalLabel">
                    Trending products
                  </h5>
                </div>
              </div>
              <button
                type="button"
                className="tsp-modal__close"
                aria-label="Close"
                onClick={onClose}
              >
                <NavIcon icon={FaXmark} size={16} />
              </button>
            </div>

            <div className="tsp-modal__toolbar">
              <div className={`tsp-modal__filters${selectedPeriod === 'custom' ? '' : ' tsp-modal__filters--preset'}`}>
                <FilterField id="trendingProductsPeriod" label="Period">
                  <select
                    id="trendingProductsPeriod"
                    className="form-select form-select-sm tsp-modal__period-select"
                    value={selectedPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
                {selectedPeriod === 'custom' ? (
                  <>
                    <FilterField id="trendingProductsFrom" label="From">
                      <input
                        id="trendingProductsFrom"
                        type="date"
                        className="form-control form-control-sm tsp-modal__date-input"
                        value={customFrom}
                        max={customTo || maxDate}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </FilterField>
                    <FilterField id="trendingProductsTo" label="To">
                      <input
                        id="trendingProductsTo"
                        type="date"
                        className="form-control form-control-sm tsp-modal__date-input"
                        value={customTo}
                        min={customFrom || undefined}
                        max={maxDate}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </FilterField>
                  </>
                ) : null}
              </div>
              <div className="tsp-modal__meta">
                <div className="tsp-modal__meta-chips">
                  {loading ? (
                    <span className="tsp-modal__summary-chip tsp-modal__summary-chip--live">Updating…</span>
                  ) : error ? null : (
                    <>
                      <span className="tsp-modal__summary-chip tsp-modal__summary-chip--count">
                        {countLabel}
                      </span>
                      <span className="tsp-modal__summary-chip">{sortLabel}</span>
                      <span className="tsp-modal__summary-chip">{selectedPeriodLabel}</span>
                    </>
                  )}
                </div>
                <div className="tsp-modal__actions">
                  <div className="input-group input-group-sm tsp-modal__search">
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
                      aria-label="Search trending products"
                    />
                  </div>
                  <div className="btn-group btn-group-sm tsp-modal__export" role="group" aria-label="Export">
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-0"
                    disabled={!canExport || exporting}
                    onClick={() => handleExport('csv')}
                    title="Download CSV"
                  >
                    <i className="fas fa-file-csv me-1" aria-hidden="true" />
                    CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-0"
                    disabled={!canExport || exporting}
                    onClick={() => handleExport('excel')}
                    title="Download Excel"
                  >
                    <i className="fas fa-file-excel me-1" aria-hidden="true" />
                    Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-0"
                    disabled={!canExport || exporting}
                    onClick={() => handleExport('pdf')}
                    title="Download PDF"
                  >
                    <i className="fas fa-file-pdf me-1" aria-hidden="true" />
                    PDF
                  </button>
                </div>
                </div>
              </div>
            </div>

            <div className="modal-body coh-modal__body pt-3">
              {loading ? (
                <TrendingLoadState elapsedMs={loadElapsedMs} />
              ) : error ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : products.length === 0 ? (
                <div className="alert alert-warning py-2 mb-0">
                  No trending products found for the selected period.
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="alert alert-warning py-2 mb-0">
                  No products match “{searchQuery.trim()}”.
                </div>
              ) : (
                <div className="table-responsive tsp-modal__table-wrap">
                  <table className="table align-items-center mb-0 tsp-modal__table">
                    <thead>
                      <tr>
                        <ListSortableTh
                          column="rank"
                          label="#"
                          sort={{ sortBy: tableSort.key, sortOrder: tableSort.dir }}
                          onSort={handleTableSort}
                          className="text-xxs text-uppercase font-weight-bolder opacity-7"
                          style={{ width: 52 }}
                        />
                        <ListSortableTh
                          column="name"
                          label="Product"
                          sort={{ sortBy: tableSort.key, sortOrder: tableSort.dir }}
                          onSort={handleTableSort}
                          className="text-xxs text-uppercase font-weight-bolder opacity-7"
                        />
                        <ListSortableTh
                          column="totalQty"
                          label="Sold"
                          sort={{ sortBy: tableSort.key, sortOrder: tableSort.dir }}
                          onSort={handleTableSort}
                          className="text-xxs text-uppercase font-weight-bolder opacity-7 text-end"
                        />
                        <ListSortableTh
                          column="totalRevenue"
                          label="Revenue"
                          sort={{ sortBy: tableSort.key, sortOrder: tableSort.dir }}
                          onSort={handleTableSort}
                          className="text-xxs text-uppercase font-weight-bolder opacity-7 text-end"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProducts.map((row) => {
                        const imageUrl = row.image ? resolveCategoryMediaUrl(row.image) : '';
                        const isTopThree = row.rank <= 3;

                        return (
                          <tr
                            key={row.productId || `${row.code}-${row.rank}`}
                            className={isTopThree ? 'tsp-modal__row--top' : undefined}
                          >
                            <td>
                              <span className={rankClass(row.rank - 1)}>{row.rank}</span>
                            </td>
                            <td>
                              <div className="tsp-modal__product">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={row.name}
                                    className="tsp-modal__thumb flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.src = withBase('/assets/img/default.jpg');
                                    }}
                                  />
                                ) : (
                                  <div className="tsp-modal__thumb tsp-modal__thumb--empty flex-shrink-0">
                                    <NavIcon icon={FaBoxOpen} size={13} />
                                  </div>
                                )}
                                <div className="min-width-0">
                                  {row.productId ? (
                                    <Link
                                      to={`/products/edit/${row.productId}`}
                                      className="tsp-modal__product-name d-block text-truncate"
                                      title={row.name}
                                      onClick={onClose}
                                    >
                                      {row.name}
                                    </Link>
                                  ) : (
                                    <span
                                      className="tsp-modal__product-name d-block text-truncate"
                                      title={row.name}
                                    >
                                      {row.name}
                                    </span>
                                  )}
                                  {(row.code || row.sku) && (
                                    <span className="tsp-modal__product-code d-block text-truncate">
                                      {row.code || row.sku}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="tsp-modal__metric">{formatSoldQty(row.totalQty)}</div>
                            </td>
                            <td className="text-end">
                              <div className="tsp-modal__metric">{formatCurrency(row.totalRevenue)}</div>
                              {row.totalProfit > 0 ? (
                                <div className="tsp-modal__metric-sub">
                                  Profit {formatCurrency(row.totalProfit)}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
