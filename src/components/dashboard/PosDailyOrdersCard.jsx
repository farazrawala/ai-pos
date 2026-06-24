import { useRef } from 'react';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useSalesDayWise } from '../../hooks/useSalesDayWise.js';
import { dayLabelFromDate, periodLabelFromApi } from './chartHelpers.js';

export default function PosDailyOrdersCard() {
  const canvasRef = useRef(null);
  const { loading, days, summary, period, error } = useSalesDayWise();
  const peakOrders = days.reduce((max, row) => Math.max(max, row.orderCount), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!days.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: days.map((d) => dayLabelFromDate(d.date)),
          dayDates: days.map((d) => d.date),
          datasets: [
            {
              label: 'Orders',
              data: days.map((d) => d.orderCount),
              backgroundColor: 'rgba(17, 205, 239, 0.85)',
              borderRadius: 4,
              maxBarThickness: 14,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 12, right: 16, bottom: 8, left: 8 },
          },
          datasets: {
            bar: {
              categoryPercentage: 0.7,
              barPercentage: 0.8,
            },
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
                label: (ctx) => `${ctx.parsed.y ?? 0} order${ctx.parsed.y === 1 ? '' : 's'}`,
              },
            },
          },
          scales: {
            x: {
              offset: true,
              grid: { display: false },
              ticks: { font: { size: 10 }, maxTicksLimit: 12 },
            },
            y: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: peakOrders + 2,
              grid: { borderDash: [4, 4] },
              ticks: { font: { size: 11 }, padding: 8 },
            },
          },
        },
      });
    },
    [loading, error, days]
  );

  const monthLabel = periodLabelFromApi(period, days);
  const orderCount = summary?.orderCount ?? 0;

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Daily orders</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {orderCount} order{orderCount === 1 ? '' : 's'} · {monthLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        <div className="chart" style={{ minHeight: 260 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="260" />
        </div>
      </div>
    </div>
  );
}
