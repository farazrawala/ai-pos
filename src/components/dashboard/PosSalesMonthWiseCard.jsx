import { useRef } from 'react';
import { FaArrowUp } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useSalesMonthWise } from '../../hooks/useSalesMonthWise.js';
import { monthLabelFromKey, periodLabelFromMonthWiseApi } from './chartHelpers.js';

export default function PosSalesMonthWiseCard() {
  const canvasRef = useRef(null);
  const { loading, months, summary, period, error } = useSalesMonthWise({
    period: 'current_year',
  });
  const spanYears = new Set(
    months.map((m) => String(m.month || '').split('-')[0]).filter(Boolean)
  ).size > 1;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!months.length) return null;

      const labels = months.map((m) =>
        monthLabelFromKey(m.month, { includeYear: spanYears })
      );
      const values = months.map((m) => m.totalAmount);

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          monthKeys: months.map((m) => m.month),
          monthsMeta: months,
          datasets: [
            {
              label: 'Sales',
              data: values,
              backgroundColor: 'rgba(45, 206, 137, 0.85)',
              borderRadius: 4,
              maxBarThickness: 28,
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
                  const key = items[0]?.chart?.data?.monthKeys?.[idx];
                  if (!key) return items[0]?.label ?? '';
                  return monthLabelFromKey(key, { includeYear: true });
                },
                label: (ctx) => `Sales: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = months[idx];
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
                maxTicksLimit: 12,
                font: { size: 11, family: 'Open Sans', style: 'normal', lineHeight: 2 },
              },
            },
          },
        },
      });
    },
    [loading, error, months, spanYears]
  );

  const periodLabel = periodLabelFromMonthWiseApi(period);
  const totalAmount = summary?.totalAmount ?? 0;
  const orderCount = summary?.orderCount ?? 0;

  return (
    <div className="card z-index-2 h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Sales by month</h6>
        <p className="text-sm mb-0">
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
        ) : !months.length ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 300 }}
          >
            No month-wise sales yet
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
