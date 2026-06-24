import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import {
  POS_CATEGORY_COLORS,
  POS_SALES_BY_CATEGORY_MOCK,
} from './posDashboardMock.js';

export default function PosSalesByCategoryCard() {
  const canvasRef = useRef(null);
  const total = POS_SALES_BY_CATEGORY_MOCK.reduce((sum, row) => sum + row.amount, 0);
  const topAmount = POS_SALES_BY_CATEGORY_MOCK.reduce(
    (max, row) => Math.max(max, row.amount),
    0
  );

  useChartJs(
    canvasRef,
    (Chart, canvas) =>
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: POS_SALES_BY_CATEGORY_MOCK.map((row) => row.name),
          datasets: [
            {
              label: 'Sales',
              data: POS_SALES_BY_CATEGORY_MOCK.map((row) => row.amount),
              backgroundColor: POS_CATEGORY_COLORS,
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
                label: (ctx) => {
                  const value = Number(ctx.parsed.x ?? 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${formatCurrency(value)} (${pct}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: topAmount * 1.1,
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
      }),
    []
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Sales by category</h6>
        <p className="text-sm mb-0 text-secondary">
          Sample POS revenue split · {formatCurrency(total)} this month
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
