import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useCogsVsSales } from '../../hooks/useCogsVsSales.js';
import { periodLabelFromPeakApi } from './chartHelpers.js';

const BAR_COLORS = ['#2dce89', '#fb6340', '#5e72e4'];

export default function PosCogsVsSalesCard() {
  const canvasRef = useRef(null);
  const { loading, summary, period, error } = useCogsVsSales();
  const sales = summary?.sales ?? 0;
  const cogs = summary?.costOfGoodsSold ?? 0;
  const grossProfit = summary?.grossProfit ?? 0;
  const marginPct = summary?.marginPct ?? 0;
  const hasData = sales > 0 || cogs > 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Sales', 'COGS', 'Gross profit'],
          datasets: [
            {
              label: 'Amount',
              data: [sales, cogs, grossProfit],
              backgroundColor: BAR_COLORS,
              borderRadius: 8,
              maxBarThickness: 52,
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
                label: (ctx) => formatCurrency(Number(ctx.parsed.y ?? 0)),
                afterLabel: (ctx) => {
                  if (!sales) return '';
                  const pct = ((Number(ctx.parsed.y ?? 0) / sales) * 100).toFixed(1);
                  return `${pct}% of sales`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
              beginAtZero: true,
              grace: '10%',
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 10 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
          },
        },
      });
    },
    [loading, error, sales, cogs, grossProfit, hasData]
  );

  const periodLabel = periodLabelFromPeakApi(period);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">COGS vs sales</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {marginPct.toFixed(1)}% gross margin · {periodLabel}
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
            <div className="chart" style={{ minHeight: 240 }}>
              <canvas ref={canvasRef} className="chart-canvas" height="240" />
            </div>
            <div className="row g-2 text-center mt-1">
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Sales</p>
                <p className="text-sm font-weight-bold text-success mb-0">
                  {formatCurrency(sales)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">COGS</p>
                <p className="text-sm font-weight-bold text-warning mb-0">
                  {formatCurrency(cogs)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Gross profit</p>
                <p className="text-sm font-weight-bold text-primary mb-0">
                  {formatCurrency(grossProfit)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            No sales / COGS data this month
          </div>
        )}
      </div>
    </div>
  );
}
