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
    limit: 10,
  });

  const totalRevenue =
    summary?.totalRevenue ?? categories.reduce((sum, row) => sum + row.totalRevenue, 0);
  const topRevenue = categories.reduce((max, row) => Math.max(max, row.totalRevenue), 0);

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
              label: 'Revenue',
              data: categories.map((row) => row.totalRevenue),
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
                  const pct = totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0;
                  return `${formatCurrency(value)} (${pct}%)`;
                },
                afterLabel: (ctx) => {
                  const row = categories[ctx.dataIndex];
                  if (!row) return '';
                  const lines = [];
                  if (row.totalQty > 0) {
                    lines.push(`Qty: ${row.totalQty.toLocaleString()}`);
                  }
                  if (row.lineCount > 0) {
                    lines.push(`${row.lineCount} line${row.lineCount === 1 ? '' : 's'}`);
                  }
                  return lines;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topRevenue > 0 ? topRevenue * 1.1 : undefined,
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
  const categoryCount = summary?.categoryCount ?? categories.length;

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Income Distribution</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(totalRevenue)} revenue · {categoryCount} categor
              {categoryCount === 1 ? 'y' : 'ies'} · {periodLabel}
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
