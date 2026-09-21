import { useRef, useState } from 'react';
import { FaArrowUp } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { SALES_TREND_GRAINS, useSalesTrend } from '../../hooks/useSalesTrend.js';
import { periodLabelFromMonthWiseApi, periodLabelFromPeakApi } from './chartHelpers.js';

const GRAIN_EMPTY = {
  day: 'No day-wise sales yet',
  week: 'No week-wise sales yet',
  month: 'No month-wise sales yet',
};

const GRAIN_TITLES = {
  day: 'Sales by day',
  week: 'Sales by week',
  month: 'Sales by month',
};

export default function PosSalesMonthWiseCard() {
  const canvasRef = useRef(null);
  const [grain, setGrain] = useState('month');
  const { loading, points, summary, period, error } = useSalesTrend(grain);
  const periodLabel =
    grain === 'month' ? periodLabelFromMonthWiseApi(period) : periodLabelFromPeakApi(period);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!points.length) return null;

      const labels = points.map((row) => row.label);
      const values = points.map((row) => row.totalAmount);
      const maxTicks = grain === 'day' ? 10 : 12;
      const maxBarThickness = grain === 'day' ? 16 : grain === 'week' ? 22 : 28;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          pointKeys: points.map((row) => row.key),
          pointsMeta: points,
          datasets: [
            {
              label: 'Sales',
              data: values,
              backgroundColor: 'rgba(45, 206, 137, 0.85)',
              borderRadius: 4,
              maxBarThickness,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 16, right: 16, bottom: 8, left: 8 },
          },
          datasets: {
            bar: {
              categoryPercentage: 0.7,
              barPercentage: 0.85,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = points[idx];
                  return row?.title || items[0]?.label || '';
                },
                label: (ctx) => `Sales: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = points[idx];
                  if (!row) return [];
                  return [
                    `Orders: ${row.orderCount ?? 0}`,
                    `Avg order: ${formatCurrency(row.averageOrderValue ?? 0)}`,
                  ];
                },
              },
            },
          },
          interaction: { intersect: false, mode: 'index' },
          scales: {
            y: {
              beginAtZero: true,
              grace: '8%',
              grid: {
                drawBorder: false,
                display: true,
                drawOnChartArea: true,
                drawTicks: false,
                borderDash: [5, 5],
              },
              ticks: {
                display: true,
                padding: 10,
                color: '#67748e',
                font: { size: 11, family: 'Open Sans', style: 'normal', lineHeight: 2 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
            x: {
              offset: true,
              grid: {
                drawBorder: false,
                display: false,
                drawOnChartArea: false,
                drawTicks: false,
              },
              ticks: {
                display: true,
                color: '#67748e',
                padding: 12,
                maxTicksLimit: maxTicks,
                font: { size: 11, family: 'Open Sans', style: 'normal', lineHeight: 2 },
              },
            },
          },
        },
      });
    },
    [loading, error, points, grain]
  );

  const totalAmount = summary?.totalAmount ?? 0;
  const orderCount = summary?.orderCount ?? 0;

  return (
    <div className="card z-index-2 h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <h6 className="text-capitalize mb-0">{GRAIN_TITLES[grain] || 'Sales by month'}</h6>
            <p className="text-sm mb-0 mt-1">
              {loading ? (
                <span className="text-secondary">Loading…</span>
              ) : error ? (
                <span className="text-danger">{error}</span>
              ) : (
                <>
                  <NavIcon icon={FaArrowUp} className="text-success me-1" size={14} />
                  <span className="font-weight-bold">{formatCurrency(totalAmount)}</span>
                  <span className="text-secondary">
                    {' '}
                    · {orderCount} order{orderCount === 1 ? '' : 's'} · {periodLabel}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="btn-group btn-group-sm flex-shrink-0" role="group" aria-label="Sales period">
            {SALES_TREND_GRAINS.map((opt) => {
              const active = grain === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn mb-0 ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setGrain(opt.value)}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 300 }}
          >
            Loading…
          </div>
        ) : error ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 300 }}
          >
            No data
          </div>
        ) : !points.length ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 300 }}
          >
            {GRAIN_EMPTY[grain] || GRAIN_EMPTY.month}
          </div>
        ) : (
          <div className="chart" style={{ minHeight: 300 }}>
            <canvas ref={canvasRef} className="chart-canvas" height="300" />
          </div>
        )}
      </div>
    </div>
  );
}
