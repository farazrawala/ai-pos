import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useTopSellingProducts } from '../../hooks/useTopSellingProducts.js';
import { periodLabelFromPeakApi, truncateChartLabel } from './chartHelpers.js';

export default function PosTopProductsCard() {
  const canvasRef = useRef(null);
  const { loading, products, period, sortBy, error } = useTopSellingProducts({
    period: 'last_30_days',
    sortBy: 'qty',
    limit: 5,
  });

  const chartValues = products.map((row) =>
    sortBy === 'revenue' ? row.totalRevenue : row.totalQty
  );
  const topValue = chartValues.reduce((max, v) => Math.max(max, v), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!products.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: products.map((row) => truncateChartLabel(row.name)),
          productMeta: products,
          datasets: [
            {
              label: sortBy === 'revenue' ? 'Revenue' : 'Qty sold',
              data: chartValues,
              backgroundColor: 'rgba(94, 114, 228, 0.8)',
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
                  const row = items[0]?.chart?.data?.productMeta?.[idx];
                  return row?.name ?? items[0]?.label ?? '';
                },
                label: (ctx) => {
                  const row = products[ctx.dataIndex];
                  if (!row) return '';
                  if (sortBy === 'revenue') {
                    return `Revenue: ${formatCurrency(row.totalRevenue)}`;
                  }
                  return `${row.totalQty} sold`;
                },
                afterLabel: (ctx) => {
                  const row = products[ctx.dataIndex];
                  if (!row) return '';
                  const lines = [];
                  if (sortBy !== 'revenue') {
                    lines.push(`Revenue: ${formatCurrency(row.totalRevenue)}`);
                  } else {
                    lines.push(`Qty: ${row.totalQty}`);
                  }
                  if (row.totalProfit > 0) {
                    lines.push(`Profit: ${formatCurrency(row.totalProfit)}`);
                  }
                  if (row.code) lines.push(`Code: ${row.code}`);
                  return lines;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topValue > 0 ? topValue * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 11 },
                callback:
                  sortBy === 'revenue' ? (v) => formatCurrency(Number(v)) : undefined,
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
    [loading, error, products, sortBy]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const sortLabel = sortBy === 'revenue' ? 'by revenue' : 'by quantity';

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Top selling products</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              Top {products.length} {sortLabel} · {periodLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        <div className="chart" style={{ minHeight: 280 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="260" />
        </div>
      </div>
    </div>
  );
}
