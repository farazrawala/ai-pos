import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useSalesByCategory } from '../../hooks/useSalesByCategory.js';
import { periodLabelFromPeakApi, truncateChartLabel } from './chartHelpers.js';
import { POS_CATEGORY_COLORS } from './posDashboardMock.js';

export default function PosSalesByCategoryCard() {
  const canvasRef = useRef(null);
  const { loading, categories, summary, period, error } = useSalesByCategory({
    period: 'last_30_days',
    limit: 20,
  });

  const total =
    summary?.totalAmount ?? categories.reduce((sum, row) => sum + row.totalAmount, 0);
  const topAmount = categories.reduce((max, row) => Math.max(max, row.totalAmount), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!categories.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: categories.map((row) => truncateChartLabel(row.name)),
          categoryMeta: categories,
          datasets: [
            {
              label: 'Sales',
              data: categories.map((row) => row.totalAmount),
              backgroundColor: categories.map(
                (_, i) => POS_CATEGORY_COLORS[i % POS_CATEGORY_COLORS.length]
              ),
              borderRadius: 4,
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 8, right: 16, bottom: 8, left: 8 },
          },
          datasets: {
            bar: {
              categoryPercentage: 0.65,
              barPercentage: 0.75,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = items[0]?.chart?.data?.categoryMeta?.[idx];
                  return row?.name ?? items[0]?.label ?? '';
                },
                label: (ctx) => {
                  const value = Number(ctx.parsed.x ?? 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${formatCurrency(value)} (${pct}%)`;
                },
                afterLabel: (ctx) => {
                  const row = categories[ctx.dataIndex];
                  if (!row?.orderCount) return '';
                  return `${row.orderCount} order${row.orderCount === 1 ? '' : 's'}`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topAmount > 0 ? topAmount * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 11 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 11 }, padding: 10 },
            },
          },
        },
      });
    },
    [loading, error, categories]
  );

  const periodLabel = periodLabelFromPeakApi(period);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Sales by category</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(total)} total · {periodLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        <div className="chart" style={{ minHeight: 280 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="280" />
        </div>
      </div>
    </div>
  );
}
