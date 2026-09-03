import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaBasketShopping,
  FaChartLine,
  FaCircleExclamation,
  FaCreditCard,
  FaFilter,
  FaRotateLeft,
  FaRotateRight,
  FaUser,
} from 'react-icons/fa6';
import {
  clearOrderPulse,
  loadOrderPulse,
  loadOrderPulseOrders,
  loadOrderPulseTrend,
  setOrdersLimit,
  setOrdersPage,
} from '../../features/orderPulse/orderPulseSlice.js';
import {
  fetchPaymentMethodsForOrderPulse,
  fetchWarehousesForOrderPulse,
  invoicePathForOrder,
  searchProductsForPulse,
} from '../../features/orderPulse/orderPulseAPI.js';
import {
  DATE_PRESETS,
  DEFAULT_DATE_PRESET,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  SALES_CHANNEL_VALUES,
  formatStatusLabel,
  resolveDateRange,
  roundPct,
  sortDimensionRows,
} from '../../features/orderPulse/orderPulseEngine.js';
import { formatMoney } from '../../utils/formatMoney.js';
import { CURRENCY_CODE } from '../../config/env.js';
import { posInvoiceRoutePath } from '../../config/appBase.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
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

function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${roundPct(value)}%`;
}

function formatCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${CURRENCY_CODE} ${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${CURRENCY_CODE} ${(n / 1_000).toFixed(1)}K`;
  return formatMoney(n, { fractionDigits: 0 });
}

function formatCount(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-PK');
}

function Delta({ value }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-muted">n/a</span>;
  }
  const up = value > 0;
  const down = value < 0;
  return (
    <span className={`op-kpi__delta ${up ? 'text-success' : down ? 'text-danger' : 'text-muted'}`}>
      {up ? <NavIcon icon={FaArrowTrendUp} size={11} /> : null}
      {down ? <NavIcon icon={FaArrowTrendDown} size={11} /> : null} {up ? '+' : ''}
      {roundPct(value)}%
    </span>
  );
}

function SkeletonBlock({ height = 88 }) {
  return <div className="op-skel w-100" style={{ height }} />;
}

function KpiCard({ label, value, hint, delta, icon: Icon, gradient }) {
  return (
    <div className="card op-kpi h-100 mb-0">
      <div className="card-body p-3 d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="op-kpi__label mb-1">{label}</div>
          <div className="op-kpi__value">{value}</div>
          {hint ? <div className="text-xs text-muted mt-1">{hint}</div> : null}
          {delta != null ? <div className="mt-1">{delta}</div> : null}
        </div>
        {Icon ? (
          <div className={`op-kpi__icon ${gradient || 'bg-gradient-primary'}`}>
            <NavIcon icon={Icon} size={14} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyPanel({ message }) {
  return (
    <div className="op-empty d-flex flex-column align-items-center justify-content-center text-center text-muted">
      <NavIcon icon={FaChartLine} size={28} className="mb-2 opacity-6" />
      <div className="text-sm">{message}</div>
    </div>
  );
}

function TrendChart({ points, metric, loading }) {
  const canvasRef = useRef(null);
  const rows = Array.isArray(points) ? points : [];
  const valueOf = (row) => {
    if (metric === 'orders') return Number(row.orders || 0);
    if (metric === 'units') return Number(row.unitsSold || 0);
    if (metric === 'profit') return Number(row.profit || 0);
    return Number(row.netRevenue || row.grossRevenue || 0);
  };
  const hasData = rows.some((row) => valueOf(row) !== 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;
      const ctx = canvas.getContext('2d');
      const color =
        metric === 'profit' ? '#2dce89' : metric === 'orders' ? '#5e72e4' : metric === 'units' ? '#fb6340' : '#11cdef';
      const gradient = ctx.createLinearGradient(0, 0, 0, 260);
      gradient.addColorStop(0, `${color}55`);
      gradient.addColorStop(1, `${color}05`);
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: rows.map((row) => row.label || row.date),
          datasets: [
            {
              label:
                metric === 'orders'
                  ? 'Orders'
                  : metric === 'units'
                    ? 'Units'
                    : metric === 'profit'
                      ? 'Profit'
                      : 'Revenue',
              data: rows.map(valueOf),
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
                title: (items) => {
                  const row = rows[items[0]?.dataIndex] || {};
                  return row.label || row.date || '';
                },
                label: () => '',
                afterBody: (items) => {
                  const row = rows[items[0]?.dataIndex] || {};
                  const margin = row.profitMargin != null ? `${roundPct(row.profitMargin)}%` : '—';
                  return [
                    `Orders: ${formatCount(row.orders)}`,
                    `Units: ${formatCount(row.unitsSold)}`,
                    `Revenue: ${formatMoney(row.netRevenue || row.grossRevenue)}`,
                    `Profit: ${formatMoney(row.profit)}`,
                    `Margin: ${margin}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#8392ab', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              grid: { display: false },
            },
            y: {
              ticks: {
                color: '#8392ab',
                callback: (v) =>
                  metric === 'orders' || metric === 'units' ? v : formatMoney(v, { fractionDigits: 0 }),
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
  if (!hasData) return <EmptyPanel message="No orders found for the selected period." />;
  return (
    <div className="op-chart">
      <canvas ref={canvasRef} aria-label="Order trend" />
    </div>
  );
}

function StatusDonut({ rows, loading }) {
  const canvasRef = useRef(null);
  const list = Array.isArray(rows) ? rows : [];
  const hasData = list.some((row) => Number(row.count || 0) > 0);
  const palette = ['#5e72e4', '#11cdef', '#2dce89', '#fb6340', '#f5365c', '#ffd600', '#8392ab', '#8965e0'];

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: list.map((row) => row.label || formatStatusLabel(row.status)),
          datasets: [
            {
              data: list.map((row) => Number(row.count || 0)),
              backgroundColor: list.map((_, i) => palette[i % palette.length]),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
          },
          cutout: '62%',
        },
      });
    },
    [list, hasData]
  );

  if (loading) return <SkeletonBlock height={240} />;
  if (!hasData) return <EmptyPanel message="No order status data for this period." />;
  return (
    <div className="op-chart op-chart--sm">
      <canvas ref={canvasRef} aria-label="Order status distribution" />
    </div>
  );
}

function ProfitBars({ metrics, view, loading }) {
  const canvasRef = useRef(null);
  const revenue = Number(metrics?.netRevenue || 0);
  const cogs = Number(metrics?.totalCOGS || 0);
  const profit = Number(metrics?.grossProfit || 0);
  const margin = metrics?.profitMargin;
  const hasData = revenue !== 0 || cogs !== 0 || profit !== 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;
      const labels = view === 'margin' ? ['Margin %'] : ['Revenue', 'COGS', 'Gross profit'];
      const data =
        view === 'margin'
          ? [Number(margin) || 0]
          : view === 'profit'
            ? [0, 0, profit]
            : [revenue, cogs, profit];
      const colors =
        view === 'margin' ? ['#2dce89'] : ['#11cdef', '#8392ab', profit >= 0 ? '#2dce89' : '#f5365c'];
      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderRadius: 8, barPercentage: 0.55 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8392ab' } },
            y: {
              ticks: {
                color: '#8392ab',
                callback: (v) => (view === 'margin' ? `${v}%` : formatMoney(v, { fractionDigits: 0 })),
              },
              grid: { color: 'rgba(0,0,0,0.04)' },
            },
          },
        },
      });
    },
    [revenue, cogs, profit, margin, view, hasData]
  );

  if (loading) return <SkeletonBlock height={240} />;
  if (!hasData) return <EmptyPanel message="No revenue in the selected period." />;
  return (
    <div className="op-chart op-chart--sm">
      <canvas ref={canvasRef} aria-label="Revenue versus profit" />
    </div>
  );
}

export default function OrderPulseView() {
  useRequireModuleAccess('order-pulse');
  const dispatch = useDispatch();
  const {
    overview,
    trend,
    status,
    products,
    customers,
    payments,
    returns,
    orders,
    ordersPagination,
    loadStatus,
    trendStatus,
    ordersStatus,
    error,
    ordersError,
  } = useSelector((s) => s.orderPulse);

  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [orderType, setOrderType] = useState('');
  const [productId, setProductId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [warehouseOptions, setWarehouseOptions] = useState([{ value: '', label: 'All warehouses' }]);
  const [paymentOptions, setPaymentOptions] = useState([{ value: '', label: 'All methods' }]);
  const [granularity, setGranularity] = useState('daily');
  const [chartMetric, setChartMetric] = useState('orders');
  const [profitView, setProfitView] = useState('revenue');
  const [productSort, setProductSort] = useState({ key: 'revenue', dir: 'desc' });
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const searchTimer = useRef(null);
  const skipNextOrdersFetch = useRef(false);

  const range = useMemo(
    () => resolveDateRange(preset, { startDate: customStart, endDate: customEnd }),
    [preset, customStart, customEnd]
  );

  const filterParams = useMemo(
    () => ({
      warehouseId,
      orderStatus,
      paymentStatus,
      paymentMethodId,
      orderType,
      productId,
      preset: range.preset,
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    [
      warehouseId,
      orderStatus,
      paymentStatus,
      paymentMethodId,
      orderType,
      productId,
      range.preset,
      range.startDate,
      range.endDate,
    ]
  );

  useEffect(() => {
    fetchWarehousesForOrderPulse().then((rows) => {
      setWarehouseOptions([
        { value: '', label: 'All warehouses' },
        ...rows.map((w) => ({
          value: String(w._id || w.id || ''),
          label: String(w.name || w.warehouse_name || 'Warehouse'),
        })),
      ]);
    });
    fetchPaymentMethodsForOrderPulse().then((rows) => {
      setPaymentOptions([{ value: '', label: 'All methods' }, ...rows]);
    });
    return () => dispatch(clearOrderPulse());
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
        setProductOptions(await searchProductsForPulse(productQuery));
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(orderSearch), 350);
    return () => window.clearTimeout(timer);
  }, [orderSearch]);

  const load = useCallback(() => {
    skipNextOrdersFetch.current = true;
    dispatch(
      loadOrderPulse({
        ...filterParams,
        granularity,
        page: 1,
        limit: ordersPagination.limit,
      })
    );
  }, [dispatch, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (skipNextOrdersFetch.current) {
      skipNextOrdersFetch.current = false;
      return;
    }
    if (loadStatus !== 'succeeded') return;
    dispatch(
      loadOrderPulseOrders({
        ...filterParams,
        search: debouncedSearch,
        page: ordersPagination.page,
        limit: ordersPagination.limit,
      })
    );
  }, [dispatch, filterParams, debouncedSearch, ordersPagination.page, ordersPagination.limit, loadStatus]);

  const metrics = overview?.metrics;
  const loading = loadStatus === 'loading';
  const insights = overview?.insights || [];
  const statusRows = status?.rows || [];
  const productRows = sortDimensionRows(products?.rows || [], productSort.key, productSort.dir);
  const customerRows = customers?.rows || [];
  const paymentRows = payments?.rows || [];
  const channelRows = payments?.channels || [];
  const noOrders = !loading && (metrics?.totalOrders || 0) === 0;

  const handleGranularity = (next) => {
    setGranularity(next);
    dispatch(loadOrderPulseTrend({ ...filterParams, granularity: next }));
  };

  const handleExport = async (kind) => {
    const columns = [
      { key: 'orderNumber', label: 'Order #' },
      { key: 'date', label: 'Date', value: (row) => formatDisplayDate(row.date) },
      { key: 'customer', label: 'Customer' },
      { key: 'items', label: 'Items' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'paymentMethod', label: 'Payment method' },
      { key: 'paymentStatus', label: 'Payment status' },
      { key: 'orderStatus', label: 'Order status' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'COGS', label: 'COGS' },
      { key: 'profit', label: 'Profit' },
      { key: 'margin', label: 'Margin' },
    ];
    const filename = `order-pulse-${range.startDate}-to-${range.endDate}`;
    setExporting(true);
    try {
      if (kind === 'csv') exportRowsToCsv({ columns, rows: orders, filename });
      else if (kind === 'excel') exportRowsToExcel({ columns, rows: orders, filename });
      else await exportRowsToPdf({ columns, rows: orders, filename, title: 'OrderPulse' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 order-pulse-page">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h4 className="mb-1">Order Pulse</h4>
          <p className="text-sm text-muted mb-0">
            {range.startDate} → {range.endDate}
            {overview?.previousRange
              ? ` · vs ${overview.previousRange.startDate} → ${overview.previousRange.endDate}`
              : ''}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mb-0"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <NavIcon icon={FaFilter} size={12} className="me-1" />
            Filters
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm mb-0" onClick={load} disabled={loading}>
            <NavIcon icon={FaRotateRight} size={12} className={`me-1 ${loading ? 'spin-icon' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="card op-panel op-filters mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-preset">
                  Date range
                </label>
                <select
                  id="op-preset"
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
                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="form-label text-xs text-uppercase" htmlFor="op-start">
                      From
                    </label>
                    <input
                      id="op-start"
                      type="date"
                      className="form-control form-control-sm"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="form-label text-xs text-uppercase" htmlFor="op-end">
                      To
                    </label>
                    <input
                      id="op-end"
                      type="date"
                      className="form-control form-control-sm"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-warehouse">
                  Warehouse
                </label>
                <select
                  id="op-warehouse"
                  className="form-select form-select-sm"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouseOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-status">
                  Order status
                </label>
                <select
                  id="op-status"
                  className="form-select form-select-sm"
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {ORDER_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-pay-status">
                  Payment status
                </label>
                <select
                  id="op-pay-status"
                  className="form-select form-select-sm"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="">All</option>
                  {PAYMENT_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-pay-method">
                  Payment method
                </label>
                <select
                  id="op-pay-method"
                  className="form-select form-select-sm"
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                >
                  {paymentOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label className="form-label text-xs text-uppercase" htmlFor="op-channel">
                  Sales channel
                </label>
                <select
                  id="op-channel"
                  className="form-select form-select-sm"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                >
                  <option value="">All channels</option>
                  {SALES_CHANNEL_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label text-xs text-uppercase">Product</label>
                <SearchableSelect
                  options={[{ value: '', label: 'All products' }, ...productOptions]}
                  value={productId}
                  placeholder="Search product…"
                  loading={productsLoading}
                  filterLocally={false}
                  onQueryChange={setProductQuery}
                  selectedLabel={productOptions.find((o) => o.value === productId)?.label || ''}
                  onChange={(next) => setProductId(next)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>
            <NavIcon icon={FaCircleExclamation} size={14} className="me-2" />
            {error}
          </span>
          <button type="button" className="btn btn-sm btn-white mb-0" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="row g-3 mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="col-6 col-md-4 col-xl-3">
              <SkeletonBlock height={96} />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          {noOrders ? (
            <div className="alert alert-secondary" role="status">
              No orders found for the selected period.
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Total orders"
                value={formatCount(metrics?.totalOrders)}
                delta={<Delta value={metrics?.trend?.ordersChangePercent} />}
                icon={FaBasketShopping}
                gradient="bg-gradient-primary"
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Delivered" value={formatCount(metrics?.deliveredOrders)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Pending" value={formatCount(metrics?.pendingOrders)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Cancelled" value={formatCount(metrics?.cancelledOrders)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Returned" value={formatCount(metrics?.returnedOrders)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Revenue"
                value={formatCompact(metrics?.netRevenue)}
                delta={<Delta value={metrics?.trend?.revenueChangePercent} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Gross profit"
                value={formatCompact(metrics?.grossProfit)}
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
              <KpiCard
                label="Avg order value"
                value={formatCompact(metrics?.averageOrderValue)}
                delta={<Delta value={metrics?.trend?.aovChangePercent} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard label="Items sold" value={formatCount(metrics?.itemsSold || metrics?.unitsSold)} />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Return rate"
                value={formatPct(metrics?.returnRate)}
                delta={<Delta value={metrics?.trend?.returnRateChange} />}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <KpiCard
                label="Cancel rate"
                value={formatPct(metrics?.cancellationRate)}
                delta={<Delta value={metrics?.trend?.cancellationRateChange} />}
              />
            </div>
          </div>

          {insights.length ? (
            <div className="row g-3 mb-4">
              {insights.map((insight) => (
                <div key={insight.id} className="col-12 col-md-6 col-xl-4">
                  <div className={`op-insight op-insight--${insight.tone || 'info'}`}>{insight.text}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-12 col-xl-8">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <h6 className="mb-0">Order trend</h6>
                  <div className="d-flex flex-wrap gap-2">
                    <div className="btn-group op-metric-tabs" role="group">
                      {['daily', 'weekly', 'monthly'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={`btn btn-sm mb-0 ${granularity === g ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => handleGranularity(g)}
                        >
                          {formatStatusLabel(g)}
                        </button>
                      ))}
                    </div>
                    <div className="btn-group op-metric-tabs" role="group">
                      {['orders', 'units', 'revenue', 'profit'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`btn btn-sm mb-0 ${chartMetric === m ? 'btn-dark' : 'btn-outline-dark'}`}
                          onClick={() => setChartMetric(m)}
                        >
                          {formatStatusLabel(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <TrendChart points={trend?.points} metric={chartMetric} loading={trendStatus === 'loading'} />
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-4">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Revenue / profit</h6>
                  <div className="btn-group op-metric-tabs" role="group">
                    {['revenue', 'profit', 'margin'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`btn btn-sm mb-0 ${profitView === v ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setProfitView(v)}
                      >
                        {formatStatusLabel(v)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-body">
                  <ProfitBars metrics={metrics} view={profitView} loading={loading} />
                  <ul className="op-breakdown mt-3">
                    <li>
                      <span>Gross revenue</span>
                      <span>{formatMoney(metrics?.grossRevenue)}</span>
                    </li>
                    <li>
                      <span>Discounts</span>
                      <span className="text-danger">− {formatMoney(metrics?.discount)}</span>
                    </li>
                    <li>
                      <span>Refunds</span>
                      <span className="text-danger">− {formatMoney(metrics?.refundAmount)}</span>
                    </li>
                    <li>
                      <span>Net revenue</span>
                      <span>{formatMoney(metrics?.netRevenue)}</span>
                    </li>
                    <li>
                      <span>COGS</span>
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
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-xl-5">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0">
                  <h6 className="mb-0">Order status</h6>
                </div>
                <div className="card-body">
                  <StatusDonut rows={statusRows} loading={loading} />
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-7">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex align-items-center gap-2">
                  <NavIcon icon={FaRotateLeft} size={14} />
                  <h6 className="mb-0">Returns / cancellations</h6>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-6 col-md-3">
                      <div className="text-xs text-uppercase text-muted">Returned orders</div>
                      <div className="fw-bold">{formatCount(metrics?.returnedOrders)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-xs text-uppercase text-muted">Returned units</div>
                      <div className="fw-bold">{formatCount(returns?.returnedUnits || metrics?.returnedUnits)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-xs text-uppercase text-muted">Returned revenue</div>
                      <div className="fw-bold">{formatMoney(returns?.refundAmount || metrics?.refundAmount)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-xs text-uppercase text-muted">Cancelled</div>
                      <div className="fw-bold">{formatCount(metrics?.cancelledOrders)}</div>
                    </div>
                  </div>
                  {(returns?.highReturnProducts || []).length ? (
                    <div className="table-responsive mt-3">
                      <table className="table align-items-center mb-0">
                        <thead>
                          <tr>
                            <th className="text-xs text-uppercase">High-return products</th>
                            <th className="text-xs text-uppercase">Units</th>
                            <th className="text-xs text-uppercase">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returns.highReturnProducts.slice(0, 5).map((row) => (
                            <tr key={row.productId}>
                              <td className="text-sm">{row.productName}</td>
                              <td className="text-sm">{formatCount(row.returnedUnits)}</td>
                              <td className="text-sm">{formatMoney(row.returnedRevenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-3 mb-0">
                      Cancellation reasons are not stored on orders, so a reason breakdown is not shown.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card op-panel mb-4">
            <div className="card-header pb-0 d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Top products</h6>
              <div className="btn-group op-metric-tabs" role="group">
                {[
                  ['revenue', 'Revenue'],
                  ['unitsSold', 'Units'],
                  ['profit', 'Profit'],
                  ['margin', 'Margin'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm mb-0 ${productSort.key === key ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setProductSort({ key, dir: 'desc' })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      {['Product', 'Units', 'Orders', 'Revenue', 'COGS', 'Profit', 'Margin'].map((label) => (
                        <th key={label} className="text-xs text-uppercase">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted text-sm py-4">
                          No product sales in the selected period.
                        </td>
                      </tr>
                    ) : (
                      productRows.map((row) => (
                        <tr key={row.productId}>
                          <td className="text-sm">{row.productName}</td>
                          <td className="text-sm">{formatCount(row.unitsSold)}</td>
                          <td className="text-sm">{formatCount(row.ordersCount)}</td>
                          <td className="text-sm">{formatMoney(row.revenue)}</td>
                          <td className="text-sm">{formatMoney(row.COGS)}</td>
                          <td className="text-sm">{formatMoney(row.profit)}</td>
                          <td className="text-sm">{formatPct(row.margin)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex align-items-center gap-2">
                  <NavIcon icon={FaUser} size={14} />
                  <h6 className="mb-0">Top customers</h6>
                </div>
                <div className="card-body p-0">
                  {customers?.truncated ? (
                    <div className="text-xs text-muted px-3 pt-2">
                      Sampled from recent orders. Dedicated OrderPulse APIs provide complete rankings.
                    </div>
                  ) : null}
                  <div className="table-responsive">
                    <table className="table align-items-center mb-0">
                      <thead>
                        <tr>
                          {['Customer', 'Orders', 'Units', 'Revenue', 'Profit', 'AOV'].map((label) => (
                            <th key={label} className="text-xs text-uppercase">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {customerRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted text-sm py-4">
                              No customer orders in the selected period.
                            </td>
                          </tr>
                        ) : (
                          customerRows.map((row) => (
                            <tr key={row.customerId || row.customerName}>
                              <td className="text-sm">{row.customerName}</td>
                              <td className="text-sm">{formatCount(row.orders)}</td>
                              <td className="text-sm">{formatCount(row.units)}</td>
                              <td className="text-sm">{formatMoney(row.revenue)}</td>
                              <td className="text-sm">{formatMoney(row.profit)}</td>
                              <td className="text-sm">{formatMoney(row.averageOrderValue)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-xl-7">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0 d-flex align-items-center gap-2">
                  <NavIcon icon={FaCreditCard} size={14} />
                  <h6 className="mb-0">Payment performance</h6>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table align-items-center mb-0">
                      <thead>
                        <tr>
                          {['Method', 'Orders', 'Revenue', 'AOV'].map((label) => (
                            <th key={label} className="text-xs text-uppercase">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paymentRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-muted text-sm py-4">
                              No payment data in the selected period.
                            </td>
                          </tr>
                        ) : (
                          paymentRows.map((row) => (
                            <tr key={row.paymentMethodId || row.paymentMethodName}>
                              <td className="text-sm">{row.paymentMethodName}</td>
                              <td className="text-sm">{formatCount(row.orders)}</td>
                              <td className="text-sm">{formatMoney(row.revenue)}</td>
                              <td className="text-sm">{formatMoney(row.averageOrderValue)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-5">
              <div className="card op-panel h-100 mb-0">
                <div className="card-header pb-0">
                  <h6 className="mb-0">Sales channels</h6>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table align-items-center mb-0">
                      <thead>
                        <tr>
                          {['Channel', 'Orders', 'Revenue', 'Profit'].map((label) => (
                            <th key={label} className="text-xs text-uppercase">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {channelRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-muted text-sm py-4">
                              No channel data in the selected period.
                            </td>
                          </tr>
                        ) : (
                          channelRows.map((row) => (
                            <tr key={row.channel}>
                              <td className="text-sm">{row.label || formatStatusLabel(row.channel)}</td>
                              <td className="text-sm">{formatCount(row.orders)}</td>
                              <td className="text-sm">{formatMoney(row.revenue)}</td>
                              <td className="text-sm">{formatMoney(row.profit)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card op-panel mb-0">
            <div className="card-header pb-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h6 className="mb-1">Order history</h6>
                <p className="text-xs text-muted mb-0">Paginated. Click an order to open the existing invoice.</p>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  style={{ minWidth: 180 }}
                  placeholder="Search orders…"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm mb-0"
                  disabled={exporting || !orders.length}
                  onClick={() => handleExport('csv')}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm mb-0"
                  disabled={exporting || !orders.length}
                  onClick={() => handleExport('excel')}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm mb-0"
                  disabled={exporting || !orders.length}
                  onClick={() => handleExport('pdf')}
                >
                  PDF
                </button>
              </div>
            </div>
            <ListDataTable
              loading={ordersStatus === 'loading'}
              error={ordersError}
              errorPrefix="Could not load orders"
              onRetry={() =>
                dispatch(
                  loadOrderPulseOrders({
                    ...filterParams,
                    page: ordersPagination.page,
                    limit: ordersPagination.limit,
                  })
                )
              }
              pagination={ordersPagination}
              onPageChange={(page) => dispatch(setOrdersPage(page))}
              onLimitChange={(limit) => dispatch(setOrdersLimit(limit))}
              selectId="order-pulse-orders-page-size"
            >
              <table className="table align-items-center mb-0">
                <thead>
                  <tr>
                    {[
                      'Order #',
                      'Date',
                      'Customer',
                      'Items',
                      'Warehouse',
                      'Payment',
                      'Pay status',
                      'Status',
                      'Revenue',
                      'COGS',
                      'Profit',
                      'Margin',
                    ].map((label) => (
                      <th key={label} className="text-xs text-uppercase">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center text-muted text-sm py-4">
                        No orders found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    orders.map((row, idx) => {
                      const routeId = invoicePathForOrder(row);
                      return (
                        <tr key={row.orderId || row.orderNumber || idx}>
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
                          <td className="text-xs">{formatDisplayDate(row.date)}</td>
                          <td className="text-sm">{row.customer}</td>
                          <td className="text-sm">{row.items}</td>
                          <td className="text-sm">{row.warehouse}</td>
                          <td className="text-sm">{row.paymentMethod}</td>
                          <td className={`text-xs text-uppercase op-status-${row.paymentStatus}`}>
                            {formatStatusLabel(row.paymentStatus)}
                          </td>
                          <td className={`text-xs text-uppercase op-status-${row.orderStatus}`}>
                            {formatStatusLabel(row.orderStatus)}
                          </td>
                          <td className="text-sm">{formatMoney(row.revenue)}</td>
                          <td className="text-sm">
                            {row.missingHistoricalCost ? (
                              <span className="text-warning">Incomplete</span>
                            ) : (
                              formatMoney(row.COGS)
                            )}
                          </td>
                          <td className="text-sm">{formatMoney(row.profit)}</td>
                          <td className="text-sm">{formatPct(row.margin)}</td>
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
