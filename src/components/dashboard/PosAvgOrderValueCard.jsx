import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useAverageOrderValue } from '../../hooks/useAverageOrderValue.js';
import { dayLabelFromDate, periodLabelFromPeakApi } from './chartHelpers.js';

function AovSummaryPanel({ summary }) {
  const overallAvg = summary?.averageOrderValue ?? 0;
  const totalAmount = summary?.totalAmount ?? 0;
  const orderCount = summary?.orderCount ?? 0;

  return (
    <div
      className="d-flex flex-column justify-content-center h-100 py-4 px-3"
      style={{ minHeight: 260 }}
    >
      <div className="text-center mb-4">
        <h2 className="font-weight-bold text-dark mb-1">{formatCurrency(overallAvg)}</h2>
        <p className="text-sm text-secondary mb-0">average per order</p>
      </div>
      <div className="row g-3 text-center">
        <div className="col-6">
          <p className="text-xs text-uppercase text-secondary font-weight-bold mb-1">Total sales</p>
          <p className="text-sm font-weight-bold mb-0">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="col-6">
          <p className="text-xs text-uppercase text-secondary font-weight-bold mb-1">Orders</p>
          <p className="text-sm font-weight-bold mb-0">{orderCount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export default function PosAvgOrderValueCard() {
  const canvasRef = useRef(null);
  const { loading, days, summary, period, error } = useAverageOrderValue({
    period: 'current_month',
  });
  const hasDailyTrend = days.length > 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasDailyTrend) return null;

      const avgValues = days.map((d) => d.averageOrderValue ?? 0);
      const peakAvg = avgValues.reduce((max, v) => Math.max(max, v), 0);
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 230, 0, 50);
      gradient.addColorStop(1, 'rgba(251, 99, 64, 0.2)');
      gradient.addColorStop(0.2, 'rgba(251, 99, 64, 0.0)');
      gradient.addColorStop(0, 'rgba(251, 99, 64, 0)');

      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: days.map((d) => dayLabelFromDate(d.date)),
          dayDates: days.map((d) => d.date),
          datasets: [
            {
              label: 'Avg order value',
              tension: 0.4,
              pointRadius: 0,
              borderColor: '#fb6340',
              backgroundColor: gradient,
              borderWidth: 3,
              fill: true,
              data: avgValues,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 16, right: 16, bottom: 8, left: 8 },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const day = items[0]?.chart?.data?.dayDates?.[idx];
                  if (!day) return items[0]?.label ?? '';
                  const d = new Date(`${day}T12:00:00`);
                  return Number.isNaN(d.getTime())
                    ? day
                    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                },
                label: (ctx) => `Avg: ${formatCurrency(ctx.parsed.y ?? 0)}`,
              },
            },
          },
          interaction: { intersect: false, mode: 'index' },
          scales: {
            y: {
              grace: '8%',
              suggestedMax: peakAvg > 0 ? peakAvg * 1.08 : undefined,
              grid: { borderDash: [4, 4], drawTicks: false },
              ticks: {
                padding: 10,
                font: { size: 11 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
            x: {
              offset: true,
              grid: { display: false },
              ticks: { font: { size: 10 }, maxTicksLimit: 12, padding: 12 },
            },
          },
        },
      });
    },
    [loading, error, days, hasDailyTrend]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const overallAvg = summary?.averageOrderValue ?? 0;

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Average order value</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : hasDailyTrend ? (
            <>
              <span className="font-weight-bold">{formatCurrency(overallAvg)}</span>
              <span className="text-secondary"> per order · {periodLabel}</span>
            </>
          ) : (
            <span className="text-secondary">{periodLabel}</span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div className="d-flex align-items-center justify-content-center text-secondary text-sm" style={{ minHeight: 260 }}>
            Loading…
          </div>
        ) : error ? null : hasDailyTrend ? (
          <div className="chart" style={{ minHeight: 260 }}>
            <canvas ref={canvasRef} className="chart-canvas" height="260" />
          </div>
        ) : (
          <AovSummaryPanel summary={summary} />
        )}
      </div>
    </div>
  );
}
