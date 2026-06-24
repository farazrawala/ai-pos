import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useReceivablesAging } from '../../hooks/useReceivablesAging.js';
import { periodLabelFromPeakApi } from './chartHelpers.js';

const AGING_COLORS = ['#2dce89', '#11cdef', '#fb6340', '#8392ab', '#5e72e4'];

export default function PosReceivablesAgingCard() {
  const canvasRef = useRef(null);
  const { loading, buckets, summary, period, error } = useReceivablesAging({
    period: 'current_month',
  });
  const topAmount = buckets.reduce((max, row) => Math.max(max, row.amount), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!buckets.length) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: buckets.map((row) => row.label),
          bucketMeta: buckets,
          datasets: [
            {
              label: 'Amount',
              data: buckets.map((row) => row.amount),
              backgroundColor: buckets.map((_, i) => AGING_COLORS[i % AGING_COLORS.length]),
              borderRadius: 6,
              maxBarThickness: 36,
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
                  const row = buckets[ctx.dataIndex];
                  return row?.count ? `${row.count} account${row.count === 1 ? '' : 's'}` : '';
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } },
            y: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topAmount > 0 ? topAmount * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: { font: { size: 11 }, callback: (v) => formatCurrency(Number(v)) },
            },
          },
        },
      });
    },
    [loading, error, buckets]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const total = summary?.totalAmount ?? buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Receivables aging</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(total)} outstanding · {periodLabel}
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
