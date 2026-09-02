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
];

function getDateRangeForPeriod(periodKey) {
  const to = moment().format('YYYY-MM-DD');
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

function rankClass(index) {
  if (index === 0) return 'tsp-modal__rank tsp-modal__rank--1';
  if (index === 1) return 'tsp-modal__rank tsp-modal__rank--2';
  if (index === 2) return 'tsp-modal__rank tsp-modal__rank--3';
  return 'tsp-modal__rank';
}

export default function TopSellingProductsModal({ open, onClose, sortBy = 'qty' }) {
  const [selectedPeriod, setSelectedPeriod] = useState('1m');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [activeSortBy, setActiveSortBy] = useState(sortBy);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProducts([]);

    const { from, to } = getDateRangeForPeriod(selectedPeriod);

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
  }, [open, selectedPeriod, sortBy]);

  useEffect(() => {
    if (!open) setSelectedPeriod('1m');
  }, [open]);

  if (!open) return null;

  const sortLabel = activeSortBy === 'revenue' ? 'By revenue' : 'By quantity';
  const selectedPeriodLabel =
    PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.label || '1 month';

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
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
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
              <div className="tsp-modal__toolbar-group">
                <label className="tsp-modal__toolbar-label" htmlFor="trendingProductsPeriod">
                  Period
                </label>
                <select
                  id="trendingProductsPeriod"
                  className="form-select form-select-sm tsp-modal__period-select"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  disabled={loading}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {!loading && !error ? (
                <div className="tsp-modal__summary">
                  <span className="tsp-modal__summary-chip">
                    {total.toLocaleString()} product{total === 1 ? '' : 's'}
                  </span>
                  <span className="tsp-modal__summary-chip">{sortLabel}</span>
                  <span className="tsp-modal__summary-chip">{selectedPeriodLabel}</span>
                </div>
              ) : null}
            </div>

            <div className="modal-body coh-modal__body pt-3">
              {loading ? (
                <div className="coh-modal__state text-center text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading trending products…
                </div>
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
                              <div className="tsp-modal__metric">{row.totalQty.toLocaleString()}</div>
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
