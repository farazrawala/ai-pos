import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import {
  POS_PAYMENT_METHODS_MOCK,
  POS_PAYMENT_METHOD_COLORS,
} from './posDashboardMock.js';

export default function PosPaymentMethodsCard() {
  const canvasRef = useRef(null);
  const total = POS_PAYMENT_METHODS_MOCK.reduce((sum, row) => sum + row.amount, 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) =>
      new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: POS_PAYMENT_METHODS_MOCK.map((row) => row.label),
          datasets: [
            {
              data: POS_PAYMENT_METHODS_MOCK.map((row) => row.amount),
              backgroundColor: POS_PAYMENT_METHOD_COLORS,
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.parsed ?? 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${ctx.label}: ${formatCurrency(value)} (${pct}%)`;
                },
              },
            },
          },
          cutout: '62%',
        },
      }),
    []
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Payment methods</h6>
        <p className="text-sm mb-0 text-secondary">
          Sample POS split · {formatCurrency(total)} this month
        </p>
      </div>
      <div className="card-body p-3">
        <div className="chart" style={{ minHeight: 280 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="280" />
        </div>
      </div>
    </div>
  );
}
