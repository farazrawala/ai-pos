import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { FaBoxOpen, FaChartLine, FaXmark } from 'react-icons/fa6';
import { fetchTopSellingProductsRequest } from '../../features/orders/ordersAPI.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { withBase } from '../../config/appBase.js';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import NavIcon from '../NavIcon.jsx';
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
    }
  }, [open]);

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

  const handlePeriodChange = (value) => {
    setSelectedPeriod(value);
    if (value === 'custom' && (!customFrom || !customTo)) {
      const seeded = defaultCustomRange();
      setCustomFrom(seeded.from);
      setCustomTo(seeded.to);
    }
  };

  if (!open) return null;

  const sortLabel = activeSortBy === 'revenue' ? 'By revenue' : 'By quantity';
  const selectedPeriodLabel =
    selectedPeriod === 'custom'
      ? formatCustomRangeLabel(customFrom, customTo)
      : PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.label || '1 month';
  const maxDate = todayYmd();

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
                {loading ? (
                  <span className="tsp-modal__summary-chip tsp-modal__summary-chip--live">Updating…</span>
                ) : error ? null : (
                  <>
                    <span className="tsp-modal__summary-chip tsp-modal__summary-chip--count">
                      {total.toLocaleString()} product{total === 1 ? '' : 's'}
                    </span>
                    <span className="tsp-modal__summary-chip">{sortLabel}</span>
                    <span className="tsp-modal__summary-chip">{selectedPeriodLabel}</span>
                  </>
                )}
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
              ) : (
                <div className="table-responsive tsp-modal__table-wrap">
                  <table className="table align-items-center mb-0 tsp-modal__table">
                    <thead>
                      <tr>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7" style={{ width: 52 }}>
                          #
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                          Product
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7 text-end">
                          Sold
                        </th>
                        <th className="text-xxs text-uppercase font-weight-bolder opacity-7 text-end">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((row, index) => {
                        const imageUrl = row.image ? resolveCategoryMediaUrl(row.image) : '';
                        const isTopThree = index < 3;

                        return (
                          <tr
                            key={row.productId || `${row.code}-${index}`}
                            className={isTopThree ? 'tsp-modal__row--top' : undefined}
                          >
                            <td>
                              <span className={rankClass(index)}>{index + 1}</span>
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
