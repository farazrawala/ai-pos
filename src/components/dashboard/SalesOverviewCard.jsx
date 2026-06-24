import { useEffect, useRef } from 'react';
import { FaArrowUp } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useSalesDayWise } from '../../hooks/useSalesDayWise.js';

/** @param {string} date YYYY-MM-DD */
function dayLabelFromDate(date) {
  const parts = String(date || '').split('-');
  const day = parseInt(parts[2] ?? '', 10);
  return Number.isFinite(day) ? String(day) : '';
}

/** @param {{ date: string }[]} days */
function monthLabelFromDays(days) {
  if (!days?.length || !days[0]?.date) return 'Current month';
  const d = new Date(`${days[0].date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Current month';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** @param {{ from?: string } | null} period @param {{ date: string }[]} days */
function periodLabelFromApi(period, days) {
  if (period?.from) {
    const from = new Date(period.from);
    if (!Number.isNaN(from.getTime())) {
      return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }
  return monthLabelFromDays(days);
}

function buildChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
          label: (ctx) => `Sales: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: {
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
        grid: {
          drawBorder: false,
          display: false,
          drawOnChartArea: false,
          drawTicks: false,
          borderDash: [5, 5],
        },
        ticks: {
          display: true,
          color: '#67748e',
          padding: 20,
          maxTicksLimit: 10,
          font: { size: 11, family: 'Open Sans', style: 'normal', lineHeight: 2 },
        },
      },
    },
  };
}

export default function SalesOverviewCard() {
  const canvasRef = useRef(null);
  const { loading, days, summary, period, error } = useSalesDayWise();

  useEffect(() => {
    if (loading || error || !days.length) return undefined;

    let cancelled = false;
    let chartInstance = null;
    let retryTimer = null;

    const renderChart = () => {
      if (cancelled) return;
      const Chart = window.Chart;
      const canvas = canvasRef.current;
      if (!Chart || !canvas) {
        retryTimer = window.setTimeout(renderChart, 200);
        return;
      }

      const existing = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
      if (existing) existing.destroy();

      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 230, 0, 50);
      gradient.addColorStop(1, 'rgba(94, 114, 228, 0.2)');
      gradient.addColorStop(0.2, 'rgba(94, 114, 228, 0.0)');
      gradient.addColorStop(0, 'rgba(94, 114, 228, 0)');

      const labels = days.map((d) => dayLabelFromDate(d.date));
      const values = days.map((d) => d.totalAmount);

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          dayDates: days.map((d) => d.date),
          datasets: [
            {
              label: 'Sales',
              tension: 0.4,
              pointRadius: 0,
              borderColor: '#5e72e4',
              backgroundColor: gradient,
              borderWidth: 3,
              fill: true,
              data: values,
              maxBarThickness: 6,
            },
          ],
        },
        options: buildChartOptions(),
      });
    };

    renderChart();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      chartInstance?.destroy();
      const canvas = canvasRef.current;
      if (canvas && typeof window.Chart?.getChart === 'function') {
        window.Chart.getChart(canvas)?.destroy();
      }
    };
  }, [loading, error, days]);

  const monthLabel = periodLabelFromApi(period, days);
  const totalAmount = summary?.totalAmount ?? 0;
  const orderCount = summary?.orderCount ?? 0;

  return (
    <div className="card z-index-2 h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Sales overview</h6>
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
                · {orderCount} order{orderCount === 1 ? '' : 's'} · {monthLabel}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="card-body p-3">
        <div className="chart">
          <canvas ref={canvasRef} className="chart-canvas" height="300" />
        </div>
      </div>
    </div>
  );
}
