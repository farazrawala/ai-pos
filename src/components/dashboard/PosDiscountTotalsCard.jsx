import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useDiscountTotals } from '../../hooks/useDiscountTotals.js';

const DISCOUNT_COLORS = ['#f5365c', '#2dce89'];

export default function PosDiscountTotalsCard() {
  const canvasRef = useRef(null);
  const { loading, discounts, summary, error } = useDiscountTotals();
  const salesDiscount = summary?.salesDiscount ?? 0;
  const purchaseDiscount = summary?.purchaseDiscount ?? 0;
  const total = summary?.total ?? salesDiscount + purchaseDiscount;
  const hasData = salesDiscount > 0 || purchaseDiscount > 0 || discounts.some((d) => d.amount > 0);

  const chartRows =
    discounts.length > 0
      ? discounts.filter((d) => d.amount > 0)
      : [
          { name: 'Sales discount', amount: salesDiscount },
          { name: 'Purchase discount', amount: purchaseDiscount },
        ].filter((d) => d.amount > 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData || !chartRows.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: chartRows.map((row) => row.name),
          datasets: [
            {
              data: chartRows.map((row) => row.amount),
              backgroundColor: chartRows.map(
                (_, i) => DISCOUNT_COLORS[i % DISCOUNT_COLORS.length]
              ),
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { size: 11 }, padding: 14 },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.parsed ?? 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return `${formatCurrency(value)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    },
    [loading, error, chartRows, hasData, total]
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Discount totals</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(total)} combined · sales & purchase discounts
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            Loading…
          </div>
        ) : error ? null : hasData ? (
          <>
            <div className="position-relative" style={{ minHeight: 220 }}>
              <div className="chart" style={{ minHeight: 220 }}>
                <canvas ref={canvasRef} className="chart-canvas" height="220" />
              </div>
              <div
                className="position-absolute top-50 start-50 translate-middle text-center"
                style={{ pointerEvents: 'none' }}
              >
                <p className="text-xxs text-uppercase text-secondary mb-0">Total</p>
                <p className="text-sm font-weight-bold mb-0">{formatCurrency(total)}</p>
              </div>
            </div>
            <div className="row g-2 text-center mt-2">
              <div className="col-6">
                <p className="text-xxs text-uppercase text-secondary mb-0">Sales discount</p>
                <p className="text-sm font-weight-bold text-danger mb-0">
                  {formatCurrency(salesDiscount)}
                </p>
              </div>
              <div className="col-6">
                <p className="text-xxs text-uppercase text-secondary mb-0">Purchase discount</p>
                <p className="text-sm font-weight-bold text-success mb-0">
                  {formatCurrency(purchaseDiscount)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            No discount totals yet
          </div>
        )}
      </div>
    </div>
  );
}
