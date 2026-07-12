import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useGrossMarginTrend } from '../../hooks/useGrossMarginTrend.js';

export default function PosGrossMarginTrendCard() {
  const canvasRef = useRef(null);
  const { loading, weeks, summary, period, error } = useGrossMarginTrend({ weeks: 6 });
  const hasData = weeks.some((w) => w.subtotal > 0 || w.profit !== 0);
  const avgMargin = summary?.avgMarginPct ?? 0;
  const totalProfit = summary?.totalProfit ?? 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;

      const ctx = canvas.getContext('2d');
      const profitGradient = ctx.createLinearGradient(0, 0, 0, 260);
      profitGradient.addColorStop(0, 'rgba(45, 206, 137, 0.35)');
      profitGradient.addColorStop(1, 'rgba(45, 206, 137, 0.02)');

      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: weeks.map((w) => w.label),
          weekMeta: weeks,
          datasets: [
            {
              label: 'Gross profit',
              data: weeks.map((w) => w.profit),
              borderColor: '#2dce89',
              backgroundColor: profitGradient,
              borderWidth: 3,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: '#2dce89',
              fill: true,
              yAxisID: 'y',
            },
            {
              label: 'Margin %',
              data: weeks.map((w) => w.marginPct),
              borderColor: '#5e72e4',
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [6, 4],
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: '#5e72e4',
              fill: false,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { size: 11 }, usePointStyle: true },
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = weeks[idx];
                  if (!row) return items[0]?.label ?? '';
                  return `${row.from} → ${row.to}`;
                },
                label: (ctx) => {
                  if (ctx.dataset.yAxisID === 'y1') {
                    return `Margin: ${(ctx.parsed.y ?? 0).toFixed(1)}%`;
                  }
                  return `Profit: ${formatCurrency(ctx.parsed.y ?? 0)}`;
                },
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = weeks[idx];
                  if (!row) return [];
                  return [
                    `Sales: ${formatCurrency(row.subtotal)}`,
                    `COGS est.: ${formatCurrency(row.cogs)}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 0 },
            },
            y: {
              position: 'left',
              grace: '10%',
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 10 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
            y1: {
              position: 'right',
              grace: '10%',
              grid: { drawOnChartArea: false },
              ticks: {
                font: { size: 10 },
                callback: (v) => `${Number(v).toFixed(0)}%`,
              },
            },
          },
        },
      });
    },
    [loading, error, weeks, hasData]
  );

  const periodLabel = period?.label || 'Last 6 weeks';

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Gross profit / margin trend</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(totalProfit)} profit · {avgMargin.toFixed(1)}% avg margin ·{' '}
              {periodLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            Loading…
          </div>
        ) : error ? null : hasData ? (
          <>
            <div className="chart" style={{ minHeight: 260 }}>
              <canvas ref={canvasRef} className="chart-canvas" height="260" />
            </div>
            <div className="row g-2 text-center mt-1">
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Sales</p>
                <p className="text-sm font-weight-bold mb-0">
                  {formatCurrency(summary?.totalSubtotal ?? 0)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Gross profit</p>
                <p className="text-sm font-weight-bold text-success mb-0">
                  {formatCurrency(totalProfit)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Avg margin</p>
                <p className="text-sm font-weight-bold text-primary mb-0">
                  {avgMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            No profit data for this period
          </div>
        )}
      </div>
    </div>
  );
}
