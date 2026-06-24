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

  const closingBalance = summary?.closingBalance ?? 0;
  const newCharges = summary?.newCharges ?? 0;
  const collections = summary?.collections ?? 0;
  const activityTotal = newCharges + collections;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (activityTotal <= 0) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['New charges', 'Collections'],
          datasets: [
            {
              data: [newCharges, collections],
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
                  const pct = activityTotal > 0 ? Math.round((value / activityTotal) * 100) : 0;
                  return `${ctx.label}: ${formatCurrency(value)} (${pct}%)`;
                },
              },
            },
          },
          cutout: '62%',
        },
      });
    },
    [loading, error, newCharges, collections, activityTotal]
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
              Closing {formatCurrency(closingBalance)} · {periodLabel}
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div className="text-center text-secondary text-sm py-5">Loading…</div>
        ) : error ? null : activityTotal > 0 ? (
          <div className="chart" style={{ minHeight: 240 }}>
            <canvas ref={canvasRef} className="chart-canvas" height="240" />
          </div>
        ) : (
          <div
            className="d-flex flex-column justify-content-center text-center py-4"
            style={{ minHeight: 240 }}
          >
            <p className="text-sm font-weight-bold text-dark mb-1">{formatCurrency(closingBalance)}</p>
            <p className="text-sm text-secondary mb-0">No charge or collection activity this period</p>
          </div>
        )}
        {!loading && !error && summary ? (
          <div className="row g-2 text-center mt-1">
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Opening</p>
              <p className="text-sm font-weight-bold mb-0">{formatCurrency(summary.openingBalance)}</p>
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Net change</p>
              <p className="text-sm font-weight-bold mb-0">{formatCurrency(summary.netChange)}</p>
            </div>
            <div className="col-4">
              <p className="text-xxs text-uppercase text-secondary mb-0">Transactions</p>
              <p className="text-sm font-weight-bold mb-0">{summary.transactionCount.toLocaleString()}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
