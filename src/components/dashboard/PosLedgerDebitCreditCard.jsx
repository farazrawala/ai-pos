import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useLedgerDebitCredit } from '../../hooks/useLedgerDebitCredit.js';
import { dayLabelFromDate, periodLabelFromPeakApi } from './chartHelpers.js';

export default function PosLedgerDebitCreditCard() {
  const canvasRef = useRef(null);
  const { loading, days, summary, period, error } = useLedgerDebitCredit();
  const totalDebit = summary?.totalDebit ?? 0;
  const totalCredit = summary?.totalCredit ?? 0;
  const net = summary?.net ?? totalCredit - totalDebit;
  const hasDaily = days.length > 0;
  const hasTotals = totalDebit > 0 || totalCredit > 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (hasDaily) {
        return new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: days.map((d) => dayLabelFromDate(d.date) || d.date),
            dayDates: days.map((d) => d.date),
            datasets: [
              {
                label: 'Debit',
                data: days.map((d) => d.debit),
                backgroundColor: 'rgba(245, 54, 92, 0.85)',
                borderRadius: 4,
                maxBarThickness: 14,
              },
              {
                label: 'Credit',
                data: days.map((d) => d.credit),
                backgroundColor: 'rgba(45, 206, 137, 0.85)',
                borderRadius: 4,
                maxBarThickness: 14,
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
                labels: { boxWidth: 10, font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    const idx = items[0]?.dataIndex;
                    const day = days[idx]?.date;
                    if (!day) return items[0]?.label ?? '';
                    const d = new Date(`${day}T12:00:00`);
                    return Number.isNaN(d.getTime())
                      ? day
                      : d.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        });
                  },
                  label: (ctx) =>
                    `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                },
              },
            },
            scales: {
              x: {
                stacked: false,
                grid: { display: false },
                ticks: { font: { size: 9 }, maxTicksLimit: 12 },
              },
              y: {
                beginAtZero: true,
                grace: '8%',
                grid: { borderDash: [4, 4] },
                ticks: {
                  font: { size: 10 },
                  callback: (v) => formatCurrency(Number(v)),
                },
              },
            },
          },
        });
      }

      if (!hasTotals) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Debit', 'Credit'],
          datasets: [
            {
              label: 'Amount',
              data: [totalDebit, totalCredit],
              backgroundColor: ['#f5365c', '#2dce89'],
              borderRadius: 8,
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
    [loading, error, days, hasDaily, hasTotals, totalDebit, totalCredit]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const txCount = summary?.transactionCount ?? 0;

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Ledger debit / credit</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {[
                `Net ${formatCurrency(net)}`,
                txCount ? `${txCount} entries` : null,
                periodLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
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
        ) : error ? null : hasDaily || hasTotals ? (
          <>
            <div className="chart" style={{ minHeight: 240 }}>
              <canvas ref={canvasRef} className="chart-canvas" height="240" />
            </div>
            <div className="row g-2 text-center mt-1">
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Debit</p>
                <p className="text-sm font-weight-bold text-danger mb-0">
                  {formatCurrency(totalDebit)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Credit</p>
                <p className="text-sm font-weight-bold text-success mb-0">
                  {formatCurrency(totalCredit)}
                </p>
              </div>
              <div className="col-4">
                <p className="text-xxs text-uppercase text-secondary mb-0">Net</p>
                <p
                  className={`text-sm font-weight-bold mb-0 ${
                    net >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatCurrency(net)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 260 }}
          >
            No ledger activity this month
          </div>
        )}
      </div>
    </div>
  );
}
