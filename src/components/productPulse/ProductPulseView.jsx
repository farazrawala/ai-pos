import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaBoxOpen,
  FaChartLine,
  FaCircleExclamation,
  FaCubes,
  FaFilter,
  FaRotateRight,
  FaWarehouse,
} from 'react-icons/fa6';
import {
  clearProductPulse,
  loadProductPulse,
  loadProductPulseSales,
  setSalesLimit,
  setSalesPage,
} from '../../features/productPulse/productPulseSlice.js';
import {
  fetchWarehousesForPulse,
  invoicePathForSale,
  searchProductsForPulse,
} from '../../features/productPulse/productPulseAPI.js';
import {
  DATE_PRESETS,
  DEFAULT_DATE_PRESET,
  pickTimelineMetric,
  resolveDateRange,
  roundPct,
  timelineHasChartableData,
} from '../../features/productPulse/productPulseEngine.js';
import { formatMoney } from '../../utils/formatMoney.js';
import { CURRENCY_CODE } from '../../config/env.js';
import { posInvoiceRoutePath } from '../../config/appBase.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import NavIcon from '../NavIcon.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import ListDataTable from '../list/ListDataTable.jsx';

function formatDisplayDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${roundPct(value)}%`;
}

function Delta({ value }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-muted">n/a</span>;
  }
  const up = value > 0;
  const down = value < 0;
  return (
    <span className={`pp-kpi__delta ${up ? 'text-success' : down ? 'text-danger' : 'text-muted'}`}>
      {up ? <NavIcon icon={FaArrowTrendUp} size={11} /> : null}
      {down ? <NavIcon icon={FaArrowTrendDown} size={11} /> : null} {up ? '+' : ''}
      {roundPct(value)}%
    </span>
  );
}

function HealthBadge({ status }) {
  if (!status) return null;
  const labels = {
    STRONG: 'Strong product',
    GOOD: 'Good product',
    WATCH: 'Watch',
    SLOW: 'Slow-moving',
    LOSS_MAKING: 'Loss-making',
  };
  return <span className={`pp-health pp-health--${status}`}>{labels[status] || status}</span>;
}

function SkeletonBlock({ height = 88 }) {
  return <div className="pp-skel w-100" style={{ height }} />;
}

function KpiCard({ label, value, hint, delta, icon: Icon, gradient }) {
  return (
    <div className="card pp-kpi h-100 mb-0">
      <div className="card-body p-3 d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="pp-kpi__label mb-1">{label}</div>
          <div className="pp-kpi__value">{value}</div>
          {hint ? <div className="text-xs text-muted mt-1">{hint}</div> : null}
          {delta != null ? <div className="mt-1">{delta}</div> : null}
        </div>
        {Icon ? (
          <div className={`pp-kpi__icon ${gradient}`}>
            <NavIcon icon={Icon} size={14} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimelineChart({ points, metric, loading }) {
  const canvasRef = useRef(null);
  const rows = Array.isArray(points) ? points : [];
  const hasData = timelineHasChartableData(rows);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;
      const ctx = canvas.getContext('2d');
      const color =
        metric === 'profit' ? '#2dce89' : metric === 'unitsSold' ? '#5e72e4' : '#11cdef';
      const gradient = ctx.createLinearGradient(0, 0, 0, 260);
      gradient.addColorStop(0, `${color}55`);
      gradient.addColorStop(1, `${color}05`);
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: rows.map((row) => row.label || row.date),
          datasets: [
            {
              label: metric === 'unitsSold' ? 'Units' : metric === 'profit' ? 'Profit' : 'Revenue',
              data: rows.map((row) => Number(row[metric] || 0)),
              borderColor: color,
              backgroundColor: gradient,
              borderWidth: 2.5,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const n = ctx.parsed.y ?? 0;
                  if (metric === 'unitsSold') return `Units: ${n}`;
                  return formatMoney(n);
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: '#8392ab', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
            y: {
              ticks: {
                color: '#8392ab',
                callback: (v) => (metric === 'unitsSold' ? v : formatMoney(v, { fractionDigits: 0 })),
              },
              grid: { color: 'rgba(0,0,0,0.04)' },
            },
          },
        },
      });
    },
    [rows, metric, hasData]
  );

  if (loading) return <SkeletonBlock height={280} />;
  if (!hasData) {
    return (
      <div className="pp-empty d-flex flex-column align-items-center justify-content-center text-center text-muted">
        <NavIcon icon={FaChartLine} size={28} className="mb-2 opacity-6" />
        <div className="text-sm">No sales in the selected period to chart.</div>
      </div>
    );
  }

  return (
    <div className="pp-chart">
      <canvas ref={canvasRef} aria-label="Product sales timeline" />
    </div>
  );
}

/** Set true to restore the warehouse filter dropdown. */
const WAREHOUSE_FILTER_ENABLED = false;

function sortRows(rows, key, dir) {
  const list = [...(Array.isArray(rows) ? rows : [])];
  const factor = dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * factor;
  });
  return list;
}

export default function ProductPulseView() {
  useRequireModuleAccess('product-pulse');
  const dispatch = useDispatch();
  const {
    overview,
    timeline,
    variants,
    warehouses,
    sales,
    salesPagination,
    status,
    timelineStatus,
    salesStatus,
    error,
    salesError,
  } = useSelector((s) => s.productPulse);

  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [granularity, setGranularity] = useState('daily');
  const [chartMetric, setChartMetric] = useState('unitsSold');
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [warehouseOptions, setWarehouseOptions] = useState([{ value: '', label: 'All warehouses' }]);
  const [variantSort, setVariantSort] = useState({ key: 'unitsSold', dir: 'desc' });
  const [warehouseSort, setWarehouseSort] = useState({ key: 'revenue', dir: 'desc' });
  const searchTimer = useRef(null);

  const range = useMemo(
    () => resolveDateRange(preset, { startDate: customStart, endDate: customEnd }),
    [preset, customStart, customEnd]
  );

  const filterParams = useMemo(
    () => ({
      productId,
      variantId,
      warehouseId,
      preset: range.preset,
      startDate: range.startDate,
      endDate: range.endDate,
      granularity,
      limit: salesPagination.limit,
    }),
    [
      productId,
      variantId,
      warehouseId,
      range.preset,
      range.startDate,
      range.endDate,
      salesPagination.limit,
    ]
  );
  const skipNextSalesFetch = useRef(false);

  useEffect(() => {
    if (WAREHOUSE_FILTER_ENABLED) {
      fetchWarehousesForPulse().then((rows) => {
        setWarehouseOptions([
          { value: '', label: 'All warehouses' },
          ...rows.map((w) => ({
            value: String(w._id || w.id || ''),
            label: String(w.name || w.warehouse_name || 'Warehouse'),
          })),
        ]);
      });
    }
    return () => dispatch(clearProductPulse());
  }, [dispatch]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!productQuery.trim()) {
      setProductOptions([]);
      return undefined;
    }
    searchTimer.current = window.setTimeout(async () => {
      setProductsLoading(true);
      try {
        const rows = await searchProductsForPulse(productQuery);
        setProductOptions(rows);
      } catch {
        setProductOptions([]);
      } finally {
        setProductsLoading(false);
      }
    }, 280);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [productQuery]);

  const reload = useCallback(() => {
    if (!productId) return;
    skipNextSalesFetch.current = true;
    dispatch(setSalesPage(1));
    dispatch(loadProductPulse({ ...filterParams, page: 1, granularity }));
  }, [dispatch, filterParams, productId, granularity]);

  useEffect(() => {
    if (!productId) return undefined;
    reload();
    return undefined;
  }, [productId, variantId, warehouseId, range.startDate, range.endDate, salesPagination.limit, granularity, reload]);

  useEffect(() => {
    if (!productId || status !== 'succeeded') return;
    if (skipNextSalesFetch.current) {
      skipNextSalesFetch.current = false;
      return;
    }
    dispatch(
      loadProductPulseSales({
        ...filterParams,
        page: salesPagination.page,
        limit: salesPagination.limit,
      })
    );
  }, [dispatch, filterParams, productId, salesPagination.page, salesPagination.limit, status]);

  useEffect(() => {
    const points = Array.isArray(timeline?.points) ? timeline.points : [];
    if (!points.length) return;
    const next = pickTimelineMetric(points, chartMetric);
    if (next && next !== chartMetric) setChartMetric(next);
  }, [timeline, chartMetric]);

  const handleGranularity = (next) => {
    setGranularity(next);
  };

  const handleSelectProduct = (id) => {
    const option = productOptions.find((o) => String(o.value) === String(id));
    if (option?.isVariantChild && option.parentId) {
      setProductId(option.parentId);
      setVariantId(String(id));
    } else {
      setProductId(String(id));
      setVariantId('');
    }
  };

  const product = overview?.product;
  const metrics = overview?.metrics;
  const health = overview?.health;
  const insights = overview?.insights || [];
  const variantRows = sortRows(variants?.rows, variantSort.key, variantSort.dir);
  const warehouseRows = sortRows(warehouses?.rows, warehouseSort.key, warehouseSort.dir);
  const hasVariantUi = Boolean(product?.hasVariants);
  const loading = status === 'loading';
  const noProduct = !productId;
  const noSales = Boolean(product && metrics && metrics.unitsSold === 0 && metrics.grossRevenue === 0);

  const selectedProductLabel =
    product?.name || productOptions.find((o) => o.value === productId)?.label || '';

  const toggleSort = (current, setCurrent, key) => {
    setCurrent((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div className="container-fluid py-4 px-3 product-pulse-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-xs font-weight-bolder text-primary mb-1">Analytics</p>
          <h4 className="mb-1">Product Pulse</h4>
          <p className="text-sm text-muted mb-0">
            How is this product actually performing — sales, cost at the time of sale, profit, and risk.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary mb-0"
          onClick={reload}
          disabled={!productId || loading}
        >
          <NavIcon icon={FaRotateRight} size={12} className={loading ? 'spin-icon me-1' : 'me-1'} />
          Refresh
        </button>
      </div>

      <div className="card pp-filters border-0 mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-lg-4">
              <label className="form-label text-xs text-uppercase font-weight-bold">Search product / SKU / barcode</label>
              <SearchableSelect
                options={productOptions}
                value={productId}
                placeholder="Search a product to analyse"
                searchPlaceholder="Name, SKU, barcode…"
                loading={productsLoading}
                filterLocally={false}
                selectedLabel={selectedProductLabel}
                onQueryChange={setProductQuery}
                onChange={handleSelectProduct}
              />
            </div>
            <div className="col-md-3 col-lg-2">
              <label className="form-label text-xs text-uppercase font-weight-bold">Date range</label>
              <select
                className="form-select form-select-sm"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {preset === 'custom' ? (
              <>
                <div className="col-md-2">
                  <label className="form-label text-xs text-uppercase font-weight-bold">From</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label text-xs text-uppercase font-weight-bold">To</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            {WAREHOUSE_FILTER_ENABLED ? (
              <div className="col-md-3 col-lg-2">
                <label className="form-label text-xs text-uppercase font-weight-bold">Warehouse</label>
                <select
                  className="form-select form-select-sm"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouseOptions.map((w) => (
                    <option key={w.value || 'all'} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {hasVariantUi ? (
              <div className="col-md-3 col-lg-2">
                <label className="form-label text-xs text-uppercase font-weight-bold">Variant</label>
                <select
                  className="form-select form-select-sm"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  <option value="">All variants</option>
                  {(overview?.variations || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.sku ? ` · ${v.sku}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="text-xs text-muted mt-2">
            <NavIcon icon={FaFilter} size={10} className="me-1" />
            {range.startDate} → {range.endDate} · default Last 30 Days · company-scoped on the server
          </div>
        </div>
      </div>

      {noProduct ? (
        <div className="card pp-panel pp-empty mb-0">
          <div className="card-body d-flex flex-column align-items-center justify-content-center text-center py-6">
            <div className="pp-kpi__icon bg-gradient-primary mb-3">
              <NavIcon icon={FaBoxOpen} size={18} />
            </div>
            <h5 className="mb-2">Select a product to open Product Pulse</h5>
            <p className="text-sm text-muted mb-0" style={{ maxWidth: 520 }}>
              Search by name, SKU, or barcode. Product Pulse shows first and last sale, units, historical
              cost at the time of sale, profit, returns, variants, and warehouse performance — without using
              today&apos;s product cost.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>
            <NavIcon icon={FaCircleExclamation} size={14} className="me-2" />
            {error}
          </span>
          <button type="button" className="btn btn-sm btn-white mb-0" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      {productId && loading ? (
        <div className="row g-3 mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="col-6 col-md-4 col-xl-3">
              <SkeletonBlock />
            </div>
          ))}
        </div>
      ) : null}

      {product && !loading ? (
        <>
          <div className="card pp-panel mb-4">
            <div className="card-body">
              <div className="pp-hero">
                {product.image ? (
                  <img src={product.image} alt="" className="pp-hero__image" />
                ) : (
                  <div className="pp-hero__image pp-hero__image--empty">
                    <NavIcon icon={FaCubes} size={22} />
                  </div>
                )}
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h5 className="mb-0">{product.name}</h5>
                    <HealthBadge status={health?.status} />
                  </div>
                  <div className="text-sm text-muted">
                    SKU {product.sku || '—'}
                    {product.category ? ` · ${product.category}` : ''}
                    {product.brand ? ` · ${product.brand}` : ''}
                    {overview?.selectedVariant ? ` · Variant ${overview.selectedVariant.name}` : hasVariantUi ? ' · All variants' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {noSales ? (
            <div className="alert alert-secondary" role="status">
              No sales recorded for this product in {range.startDate} to {range.endDate}. Try a wider date
              range, another warehouse, or All variants.
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Units sold"
                value={metrics?.unitsSold ?? 0}
                delta={<Delta value={metrics?.trend?.unitsSoldChangePercent} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Orders" value={metrics?.ordersCount ?? 0} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Revenue"
                value={formatMoney(metrics?.netRevenue)}
                delta={<Delta value={metrics?.trend?.revenueChangePercent} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="COGS" value={formatMoney(metrics?.totalCOGS)} hint="Historical cost at sale" />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Gross profit"
                value={formatMoney(metrics?.grossProfit)}
                delta={<Delta value={metrics?.trend?.profitChangePercent} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Profit margin"
                value={formatPct(metrics?.profitMargin)}
                hint={
                  metrics?.trend?.marginChange != null
                    ? `${metrics.trend.marginChange > 0 ? '+' : ''}${roundPct(metrics.trend.marginChange)} pts vs prior`
                    : null
                }
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Returns" value={metrics?.returnedUnits ?? 0} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Return rate" value={formatPct(metrics?.returnRate)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Last sold" value={formatDay(metrics?.lastSoldAt)} hint={metrics?.daysSinceLastSale != null ? `${metrics.daysSinceLastSale} days ago` : null} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="First sold" value={formatDay(metrics?.firstSoldAt)} />
            </div>
          </div>

          {overview?.missingHistoricalCostCount > 0 ? (
            <div className="alert alert-warning text-sm" role="status">
              {overview.missingHistoricalCostCount} sale line(s) are missing <code>cost_price_at_sale</code>.
              Product Pulse does not substitute today&apos;s product cost. Profit on those lines is incomplete.
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-xl-8">
              <div className="card pp-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <h6 className="mb-0">Sales timeline</h6>
                  <div className="d-flex flex-wrap gap-2">
                    <div className="btn-group btn-group-sm" role="group" aria-label="Granularity">
                      {['daily', 'weekly', 'monthly'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={`btn mb-0 ${granularity === g ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => handleGranularity(g)}
                        >
                          {g[0].toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="btn-group btn-group-sm pp-metric-tabs" role="group" aria-label="Chart metric">
                      {[
                        { id: 'unitsSold', label: 'Units' },
                        { id: 'netRevenue', label: 'Revenue' },
                        { id: 'profit', label: 'Profit' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`btn mb-0 ${chartMetric === m.id ? 'btn-dark' : 'btn-outline-dark'}`}
                          onClick={() => setChartMetric(m.id)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <TimelineChart
                    points={timeline?.points}
                    metric={chartMetric}
                    loading={timelineStatus === 'loading'}
                  />
                </div>
              </div>
            </div>
            <div className="col-xl-4">
              <div className="card pp-panel h-100 mb-0">
                <div className="card-header pb-0">
                  <h6 className="mb-0">Profitability</h6>
                </div>
                <div className="card-body">
                  <ul className="pp-breakdown">
                    <li>
                      <span>Revenue</span>
                      <span>{formatMoney(metrics?.grossRevenue)}</span>
                    </li>
                    <li>
                      <span>Discounts</span>
                      <span className="text-danger">− {formatMoney(metrics?.discount)}</span>
                    </li>
                    {metrics?.refundAmount ? (
                      <li>
                        <span>Refunds</span>
                        <span className="text-danger">− {formatMoney(metrics.refundAmount)}</span>
                      </li>
                    ) : null}
                    <li>
                      <span>Net revenue</span>
                      <span>{formatMoney(metrics?.netRevenue)}</span>
                    </li>
                    <li>
                      <span>COGS (at sale)</span>
                      <span>− {formatMoney(metrics?.totalCOGS)}</span>
                    </li>
                    <li>
                      <span>Gross profit</span>
                      <span className={metrics?.grossProfit < 0 ? 'text-danger' : 'text-success'}>
                        {formatMoney(metrics?.grossProfit)}
                      </span>
                    </li>
                    <li>
                      <span>Margin</span>
                      <span>{formatPct(metrics?.profitMargin)}</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted mb-0 mt-3">
                    COGS uses {CURRENCY_CODE} historical unit cost stored on each order item at sale, not the
                    current product cost.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {insights.length ? (
            <div className="row g-3 mb-4">
              {insights.map((insight) => (
                <div key={insight.id} className="col-md-6 col-xl-4">
                  <div className={`pp-insight pp-insight--${insight.tone || 'muted'}`}>{insight.text}</div>
                </div>
              ))}
            </div>
          ) : null}

          {hasVariantUi ? (
            <div className="card pp-panel mb-4">
              <div className="card-header pb-0">
                <h6 className="mb-1">Variant performance</h6>
                <p className="text-xs text-muted mb-0">
                  Best seller, most profitable, highest margin, and high-return variants are highlighted.
                </p>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        {[
                          ['variantName', 'Variant'],
                          ['sku', 'SKU'],
                          ['unitsSold', 'Units'],
                          ['ordersCount', 'Orders'],
                          ['grossRevenue', 'Revenue'],
                          ['COGS', 'COGS'],
                          ['profit', 'Profit'],
                          ['profitMargin', 'Margin'],
                          ['returnedUnits', 'Returns'],
                          ['returnRate', 'Return %'],
                        ].map(([key, label]) => (
                          <th
                            key={key}
                            className="text-xs text-uppercase cursor-pointer"
                            onClick={() => toggleSort(variantSort, setVariantSort, key)}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center text-muted text-sm py-4">
                            No variant sales in this period.
                          </td>
                        </tr>
                      ) : (
                        variantRows.map((row) => (
                          <tr key={row.variantId} className={row.highlight ? `pp-highlight-${row.highlight}` : ''}>
                            <td className="text-sm">
                              {row.variantName}
                              {row.highlights?.length ? (
                                <div className="text-xs text-muted">{row.highlights.join(' · ')}</div>
                              ) : null}
                            </td>
                            <td className="text-sm">{row.sku || '—'}</td>
                            <td className="text-sm">{row.unitsSold}</td>
                            <td className="text-sm">{row.ordersCount}</td>
                            <td className="text-sm">{formatMoney(row.grossRevenue)}</td>
                            <td className="text-sm">{formatMoney(row.COGS)}</td>
                            <td className="text-sm">{formatMoney(row.profit)}</td>
                            <td className="text-sm">{formatPct(row.profitMargin)}</td>
                            <td className="text-sm">{row.returnedUnits}</td>
                            <td className="text-sm">{formatPct(row.returnRate)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {warehouseRows.length > 0 ? (
            <div className="card pp-panel mb-4">
              <div className="card-header pb-0 d-flex align-items-center gap-2">
                <NavIcon icon={FaWarehouse} size={14} />
                <h6 className="mb-0">Warehouse performance</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        {[
                          ['warehouseName', 'Warehouse'],
                          ['unitsSold', 'Units'],
                          ['orders', 'Orders'],
                          ['revenue', 'Revenue'],
                          ['COGS', 'COGS'],
                          ['profit', 'Profit'],
                          ['margin', 'Margin'],
                        ].map(([key, label]) => (
                          <th
                            key={key}
                            className="text-xs text-uppercase cursor-pointer"
                            onClick={() => toggleSort(warehouseSort, setWarehouseSort, key)}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {warehouseRows.map((row) => (
                        <tr key={row.warehouseId}>
                          <td className="text-sm">{row.warehouseName}</td>
                          <td className="text-sm">{row.unitsSold}</td>
                          <td className="text-sm">{row.orders}</td>
                          <td className="text-sm">{formatMoney(row.revenue)}</td>
                          <td className="text-sm">{formatMoney(row.COGS)}</td>
                          <td className="text-sm">{formatMoney(row.profit)}</td>
                          <td className="text-sm">{formatPct(row.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card pp-panel mb-0">
            <div className="card-header pb-0">
              <h6 className="mb-1">Sales history</h6>
              <p className="text-xs text-muted mb-0">Paginated from the database. Click an order to open it.</p>
            </div>
            <ListDataTable
              loading={salesStatus === 'loading'}
              error={salesError}
              errorPrefix="Could not load sales history"
              onRetry={() =>
                dispatch(
                  loadProductPulseSales({
                    ...filterParams,
                    page: salesPagination.page,
                    limit: salesPagination.limit,
                  })
                )
              }
              pagination={salesPagination}
              onPageChange={(page) => dispatch(setSalesPage(page))}
              onLimitChange={(limit) => dispatch(setSalesLimit(limit))}
              selectId="product-pulse-sales-page-size"
            >
              <table className="table align-items-center mb-0">
                <thead>
                  <tr>
                    {[
                      'Date',
                      'Order',
                      'Customer',
                      'Variant',
                      'Warehouse',
                      'Qty',
                      'Selling price',
                      'Cost',
                      'Revenue',
                      'Profit',
                      'Margin',
                      'Status',
                    ].map((label) => (
                      <th key={label} className="text-xs text-uppercase">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center text-muted text-sm py-4">
                        No sales in the selected period.
                      </td>
                    </tr>
                  ) : (
                    sales.map((row, idx) => {
                      const routeId = invoicePathForSale(row);
                      return (
                        <tr key={row.orderId || row.lineId || idx}>
                          <td className="text-xs">{formatDisplayDate(row.date)}</td>
                          <td className="text-sm">
                            {routeId ? (
                              <Link
                                to={posInvoiceRoutePath(routeId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="fw-semibold text-primary text-decoration-underline"
                              >
                                {row.orderNumber || row.orderId}
                              </Link>
                            ) : (
                              row.orderNumber || '—'
                            )}
                          </td>
                          <td className="text-sm">{row.customer}</td>
                          <td className="text-sm">{row.variant}</td>
                          <td className="text-sm">{row.warehouse}</td>
                          <td className="text-sm">{row.quantity}</td>
                          <td className="text-sm">{formatMoney(row.unitSellingPrice)}</td>
                          <td className="text-sm">
                            {row.missingHistoricalCost ? (
                              <span className="text-warning">Missing</span>
                            ) : (
                              formatMoney(row.unitCost)
                            )}
                          </td>
                          <td className="text-sm">{formatMoney(row.revenue)}</td>
                          <td className="text-sm">{formatMoney(row.profit)}</td>
                          <td className="text-sm">{formatPct(row.margin)}</td>
                          <td className="text-xs text-uppercase">{row.status}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ListDataTable>
          </div>
        </>
      ) : null}
    </div>
  );
}
