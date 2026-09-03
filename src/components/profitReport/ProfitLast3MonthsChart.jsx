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
        Number(row.profit) < 0 ? 'rgba(245, 54, 92, 0.75)' : 'rgba(45, 206, 137, 0.72)'
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
              borderColor: barColors.map((c) => c.replace(/0\.\d+/, '1')),
              borderWidth: 0,
              borderRadius: 4,
              maxBarThickness: 48,
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
              backgroundColor: '#fff',
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 3.5,
              pointHoverRadius: 5,
              pointBackgroundColor: '#5e72e4',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
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
              labels: {
                boxWidth: 8,
                boxHeight: 8,
                font: { size: 11 },
                usePointStyle: true,
                padding: 16,
                color: '#67748e',
              },
            },
            tooltip: {
              backgroundColor: '#344767',
              titleFont: { size: 12, weight: '600' },
              bodyFont: { size: 11 },
              padding: 10,
              cornerRadius: 6,
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = rows[idx];
                  if (!row) return items[0]?.label ?? '';
                  return row.label;
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
              ticks: { font: { size: 11 }, color: '#67748e', maxRotation: 0 },
              border: { display: false },
            },
            y: {
              position: 'left',
              grace: '10%',
              grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
              border: { display: false },
              ticks: {
                font: { size: 10 },
                color: '#8392ab',
                maxTicksLimit: 5,
                callback: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return '';
                  const abs = Math.abs(n);
                  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                  return String(Math.round(n));
                },
              },
            },
            y1: {
              position: 'right',
              grace: '10%',
              grid: { drawOnChartArea: false },
              border: { display: false },
              ticks: {
                font: { size: 10 },
                color: '#8392ab',
                maxTicksLimit: 5,
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
    <div className="card profit-report-panel h-100 mb-0">
      <div className="card-body p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <p className="profit-report-kpi__label mb-0">Trend</p>
            <h6 className="mb-0 text-sm text-dark">Last 3 months</h6>
          </div>
          <div className="profit-report-chart-total text-end">
            <p className="text-xxs text-uppercase text-muted mb-0">3-month total</p>
            <p className="text-sm font-weight-bold text-dark mb-0">
              {loading && !rows.length ? '…' : formatCurrencyAccounting(totalProfit)}
            </p>
          </div>
        </div>

        {loading && !rows.length ? (
          <div
            className="d-flex align-items-center justify-content-center text-muted text-sm"
            style={{ minHeight: 260 }}
          >
            Loading chart…
          </div>
        ) : hasData ? (
          <div className="profit-report-month-chart">
            <canvas ref={canvasRef} height="260" />
          </div>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-muted text-sm"
            style={{ minHeight: 260 }}
          >
            No profit data for the last 3 months
          </div>
        )}
      </div>
    </div>
  );
}
