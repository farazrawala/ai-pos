import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useAccountsReceivableSummary } from '../../hooks/useAccountsReceivableSummary.js';
import { periodLabelFromPeakApi } from './chartHelpers.js';

export default function PosAccountsReceivableSummaryCard() {
  const canvasRef = useRef(null);
  const { loading, summary, period, error } = useAccountsReceivableSummary({
    period: 'current_month',
  });

  const outstanding = summary?.totalOutstanding ?? summary?.totalReceivable ?? 0;
  const collected = summary?.totalCollected ?? 0;
  const chartTotal = outstanding + collected;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (chartTotal <= 0) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Outstanding', 'Collected'],
          datasets: [
            {
              data: [outstanding, collected],
              backgroundColor: ['#fb6340', '#2dce89'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.parsed ?? 0);
                  const pct = chartTotal > 0 ? Math.round((value / chartTotal) * 100) : 0;
                  return `${ctx.label}: ${formatCurrency(value)} (${pct}%)`;
                },
              },
            },
          },
          cutout: '62%',
        },
      });
    },
    [loading, error, outstanding, collected, chartTotal]
  );

  const periodLabel = periodLabelFromPeakApi(period);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Accounts receivable</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              Outstanding {formatCurrency(outstanding)} · {periodLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div className="text-center text-secondary text-sm py-5">Loading…</div>
        ) : error ? null : chartTotal > 0 ? (
          <div className="chart" style={{ minHeight: 240 }}>
            <canvas ref={canvasRef} className="chart-canvas" height="240" />
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-weight-bold text-dark mb-1">{formatCurrency(outstanding)}</p>
            <p className="text-sm text-secondary mb-0">No receivable activity this period</p>
          </div>
        )}
        {!loading && !error && summary ? (
          <div className="row g-2 text-center mt-1">
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Outstanding</p>
              <p className="text-sm font-weight-bold mb-0">{formatCurrency(outstanding)}</p>
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Collected</p>
              <p className="text-sm font-weight-bold mb-0">{formatCurrency(collected)}</p>
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Orders</p>
              <p className="text-sm font-weight-bold mb-0">{summary.orderCount ?? 0}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
