import { useRef } from 'react';
import { useChartJs } from '../../hooks/useChartJs.js';
import { usePeakSalesHours } from '../../hooks/usePeakSalesHours.js';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { periodLabelFromPeakApi, shortHourLabel } from './chartHelpers.js';

export default function PosPeakHoursCard() {
  const canvasRef = useRef(null);
  const { loading, hours, summary, period, peakBy, error } = usePeakSalesHours({
    period: 'last_30_days',
    peakBy: 'order_count',
  });

  const chartValues = hours.map((row) =>
    peakBy === 'total_amount' ? row.totalAmount : row.orderCount
  );
  const peakValue = chartValues.reduce((max, v) => Math.max(max, v), 0);
  const peakHour = summary?.peakHour;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!hours.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: hours.map((row) => shortHourLabel(row)),
          hourMeta: hours.map((row) => row.hourLabel || shortHourLabel(row)),
          datasets: [
            {
              label: peakBy === 'total_amount' ? 'Sales' : 'Orders',
              data: chartValues,
              backgroundColor: hours.map((row) =>
                row.hour === peakHour ? 'rgba(45, 206, 137, 1)' : 'rgba(45, 206, 137, 0.45)'
              ),
              borderRadius: 6,
              maxBarThickness: 14,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 12, right: 12, bottom: 4, left: 4 },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const meta = items[0]?.chart?.data?.hourMeta?.[idx];
                  return meta || items[0]?.label || '';
                },
                label: (ctx) => {
                  const row = hours[ctx.dataIndex];
                  if (!row) return '';
                  if (peakBy === 'total_amount') {
                    return `Sales: ${formatCurrency(row.totalAmount)}`;
                  }
                  return `${row.orderCount} order${row.orderCount === 1 ? '' : 's'}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 9 },
                maxRotation: 45,
                minRotation: 45,
                autoSkip: true,
                maxTicksLimit: 12,
              },
            },
            y: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: peakValue > 0 ? peakValue * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 11 },
                callback:
                  peakBy === 'total_amount'
                    ? (v) => formatCurrency(Number(v))
                    : undefined,
              },
            },
          },
        },
      });
    },
    [loading, error, hours, peakBy, peakHour]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const peakLabel = summary?.peakHourLabel || (peakHour != null ? shortHourLabel({ hour: peakHour }) : '');

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Peak sales hours</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {peakLabel ? (
                <>
                  Peak at <span className="font-weight-bold text-dark">{peakLabel}</span>
                  {summary?.peakOrderCount != null ? (
                    <>
                      {' '}
                      · {summary.peakOrderCount} order{summary.peakOrderCount === 1 ? '' : 's'}
                    </>
                  ) : null}
                  {' · '}
                </>
              ) : null}
              {periodLabel}
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
