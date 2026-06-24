import { useRef } from 'react';
import { useChartJs } from '../../hooks/useChartJs.js';
import { POS_PEAK_HOURS_MOCK } from './posDashboardMock.js';

export default function PosPeakHoursCard() {
  const canvasRef = useRef(null);
  const peakOrders = POS_PEAK_HOURS_MOCK.reduce((max, row) => Math.max(max, row.orders), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) =>
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: POS_PEAK_HOURS_MOCK.map((row) => row.hour),
          datasets: [
            {
              label: 'Orders',
              data: POS_PEAK_HOURS_MOCK.map((row) => row.orders),
              backgroundColor: 'rgba(45, 206, 137, 0.8)',
              borderRadius: 6,
              maxBarThickness: 18,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 },
            },
            y: {
              beginAtZero: true,
              suggestedMax: peakOrders + 4,
              grid: { borderDash: [4, 4] },
              ticks: { stepSize: 5, font: { size: 11 } },
            },
          },
        },
      }),
    []
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Peak sales hours</h6>
        <p className="text-sm mb-0 text-secondary">Sample POS orders by time of day</p>
      </div>
      <div className="card-body p-3">
        <div className="chart" style={{ minHeight: 260 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="260" />
        </div>
      </div>
    </div>
  );
}
