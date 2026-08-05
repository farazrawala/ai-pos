import { useMemo, useRef } from 'react';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';

/**
 * Bar + margin line chart for the last 3 calendar months of order profit.
 */
export default function ProfitLast3MonthsChart({ months = [], loading = false }) {
  const canvasRef = useRef(null);
  const rows = useMemo(() => (Array.isArray(months) ? months : []), [months]);
  const hasData = rows.some((row) => Number(row?.profit) !== 0 || Number(row?.subtotal) > 0);
  const totalProfit = rows.reduce((sum, row) => sum + (Number(row?.profit) || 0), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hasData) return null;

      const ctx = canvas.getContext('2d');
      const barColors = rows.map((row) =>
        Number(row.profit) < 0 ? 'rgba(245, 54, 92, 0.85)' : 'rgba(45, 206, 137, 0.85)'
      );

      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map((row) => row.label),
          datasets: [
            {
              type: 'bar',
              label: 'Profit',
              data: rows.map((row) => Number(row.profit) || 0),
              backgroundColor: barColors,
              borderColor: barColors.map((c) => c.replace('0.85', '1')),
              borderWidth: 1,
              borderRadius: 6,
              maxBarThickness: 56,
              yAxisID: 'y',
              order: 2,
            },
            {
              type: 'line',
              label: 'Margin %',
              data: rows.map((row) =>
                row.marginPct != null && Number.isFinite(row.marginPct) ? row.marginPct : null
              ),
              borderColor: '#5e72e4',
              backgroundColor: '#5e72e4',
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#5e72e4',
              fill: false,
              yAxisID: 'y1',
              order: 1,
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
                  const row = rows[idx];
                  if (!row) return items[0]?.label ?? '';
                  return `${row.label} (${row.startDate} → ${row.endDate})`;
                },
                label: (ctx) => {
                  if (ctx.dataset.yAxisID === 'y1') {
                    const v = ctx.parsed.y;
                    return v == null ? 'Margin: —' : `Margin: ${Number(v).toFixed(1)}%`;
                  }
                  return `Profit: ${formatCurrencyAccounting(ctx.parsed.y ?? 0)}`;
                },
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = rows[idx];
                  if (!row) return [];
                  return [
                    `Sales: ${formatCurrencyAccounting(row.subtotal ?? 0)}`,
                    `Lines: ${row.lineCount ?? 0}`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, maxRotation: 0 },
            },
            y: {
              position: 'left',
              grace: '12%',
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 10 },
                callback: (v) => formatCurrencyAccounting(Number(v)),
              },
            },
            y1: {
              position: 'right',
              grace: '12%',
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
    [rows, hasData]
  );

  return (
    <div className="card h-100 border-0 shadow-none bg-white">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <p className="text-xs text-muted mb-1">Last 3 months</p>
            <h6 className="mb-0 text-sm fw-semibold">Monthly profit trend</h6>
          </div>
          <div className="text-end">
            <p className="text-xxs text-muted mb-0 text-uppercase">3-mo total</p>
            <p className="text-sm fw-bold mb-0">
              {loading && !rows.length ? '…' : formatCurrencyAccounting(totalProfit)}
            </p>
          </div>
        </div>

        {loading && !rows.length ? (
          <div
            className="d-flex align-items-center justify-content-center text-muted text-sm"
            style={{ minHeight: 220 }}
          >
            Loading chart…
          </div>
        ) : hasData ? (
          <div className="profit-report-month-chart" style={{ minHeight: 220, height: 220 }}>
            <canvas ref={canvasRef} height="220" />
          </div>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-muted text-sm"
            style={{ minHeight: 220 }}
          >
            No profit data for the last 3 months
          </div>
        )}
      </div>
    </div>
  );
}
