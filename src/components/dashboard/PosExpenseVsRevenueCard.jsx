import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useExpenseVsRevenue } from '../../hooks/useExpenseVsRevenue.js';
import { dayLabelFromDate, periodLabelFromPeakApi } from './chartHelpers.js';

export default function PosExpenseVsRevenueCard() {
  const canvasRef = useRef(null);
  const { loading, days, summary, period, error } = useExpenseVsRevenue({
    period: 'current_month',
  });
  const hasDaily = days.length > 0;
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const netProfit = summary?.netProfit ?? summary?.net ?? totalRevenue - totalExpense;
  const orderCount = summary?.orderCount ?? 0;
  const expenseCount = summary?.expenseCount ?? 0;
  const expenseRatioPercent = summary?.expenseRatioPercent ?? 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (hasDaily) {
        return new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: days.map((d) => dayLabelFromDate(d.date)),
            dayDates: days.map((d) => d.date),
            datasets: [
              {
                label: 'Revenue',
                data: days.map((d) => d.revenue),
                borderColor: '#2dce89',
                backgroundColor: 'rgba(45, 206, 137, 0.1)',
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 0,
                fill: false,
              },
              {
                label: 'Expenses',
                data: days.map((d) => d.expense),
                borderColor: '#f5365c',
                backgroundColor: 'rgba(245, 54, 92, 0.1)',
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 0,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    const idx = items[0]?.dataIndex;
                    const day = items[0]?.chart?.data?.dayDates?.[idx];
                    if (!day) return items[0]?.label ?? '';
                    const d = new Date(`${day}T12:00:00`);
                    return Number.isNaN(d.getTime())
                      ? day
                      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  },
                  label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                },
              },
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
              y: {
                grace: '8%',
                grid: { borderDash: [4, 4] },
                ticks: { font: { size: 11 }, callback: (v) => formatCurrency(Number(v)) },
              },
            },
          },
        });
      }

      if (totalRevenue <= 0 && totalExpense <= 0) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Revenue', 'Expenses'],
          datasets: [
            {
              label: 'Amount',
              data: [totalRevenue, totalExpense],
              backgroundColor: ['#2dce89', '#f5365c'],
              borderRadius: 6,
              maxBarThickness: 56,
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
                  if (ctx.dataIndex === 0 && orderCount) {
                    return `${orderCount} order${orderCount === 1 ? '' : 's'}`;
                  }
                  if (ctx.dataIndex === 1 && expenseCount) {
                    return `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`;
                  }
                  return '';
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grace: '8%',
              grid: { borderDash: [4, 4] },
              ticks: { callback: (v) => formatCurrency(Number(v)) },
            },
          },
        },
      });
    },
    [loading, error, days, hasDaily, totalRevenue, totalExpense, orderCount, expenseCount]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const ratioLabel =
    expenseRatioPercent > 0 ? `${expenseRatioPercent.toFixed(2)}% expense ratio` : null;

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Expense vs revenue</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {[
                `${formatCurrency(netProfit)} net`,
                ratioLabel,
                periodLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        <div className="chart" style={{ minHeight: 260 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="260" />
        </div>
        {!loading && !error ? (
          <div className="row g-2 text-center mt-1">
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Revenue</p>
              <p className="text-sm font-weight-bold text-success mb-0">{formatCurrency(totalRevenue)}</p>
              {orderCount ? (
                <p className="text-xxs text-secondary mb-0">
                  {orderCount} order{orderCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Expenses</p>
              <p className="text-sm font-weight-bold text-danger mb-0">{formatCurrency(totalExpense)}</p>
              {expenseCount ? (
                <p className="text-xxs text-secondary mb-0">
                  {expenseCount} expense{expenseCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Net profit</p>
              <p className="text-sm font-weight-bold mb-0">{formatCurrency(netProfit)}</p>
              {ratioLabel ? <p className="text-xxs text-secondary mb-0">{ratioLabel}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
