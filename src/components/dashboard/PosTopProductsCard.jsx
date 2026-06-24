import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { POS_TOP_PRODUCTS_MOCK } from './posDashboardMock.js';

export default function PosTopProductsCard() {
  const canvasRef = useRef(null);
  const topQty = POS_TOP_PRODUCTS_MOCK.reduce((max, row) => Math.max(max, row.qty), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) =>
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: POS_TOP_PRODUCTS_MOCK.map((row) => row.name),
          datasets: [
            {
              label: 'Qty sold',
              data: POS_TOP_PRODUCTS_MOCK.map((row) => row.qty),
              backgroundColor: 'rgba(94, 114, 228, 0.8)',
              borderRadius: 4,
              maxBarThickness: 28,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => {
                  const row = POS_TOP_PRODUCTS_MOCK[ctx.dataIndex];
                  return row ? `Revenue: ${formatCurrency(row.amount)}` : '';
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: topQty + 40,
              grid: { borderDash: [4, 4] },
              ticks: { font: { size: 11 } },
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
            },
          },
        },
      }),
    []
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Top selling products</h6>
        <p className="text-sm mb-0 text-secondary">Sample POS items by quantity sold</p>
      </div>
      <div className="card-body p-3">
        <div className="chart" style={{ minHeight: 260 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="260" />
        </div>
      </div>
    </div>
  );
}
