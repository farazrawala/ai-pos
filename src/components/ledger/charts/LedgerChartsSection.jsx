import { useEffect } from 'react';
import {
  getMonthlySeriesMock,
  getBalanceTrendMock,
  getCategoryBreakdownMock,
  getWeeklyActivityMock,
} from '../mock/ledgerTransactions.mock.js';

/**
 * Analytics charts — Chart.js (global), matches Dashboard usage.
 * @param {{ labels: string[], debit: number[], credit: number[] } | null} [props.monthlyDebitCredit] — when set, drives "Monthly debit vs credit"; otherwise mock.
 */
export default function LedgerChartsSection({ monthlyDebitCredit = null }) {
  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart) return undefined;

    const charts = [];

    const destroyIfAny = (canvas) => {
      if (!canvas) return;
      const existing = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
      if (existing) existing.destroy();
    };

    const barEl = document.getElementById('ledger-chart-monthly-dc');
    destroyIfAny(barEl);
    if (barEl) {
      const { labels, debit, credit } =
        monthlyDebitCredit && Array.isArray(monthlyDebitCredit.labels)
          ? monthlyDebitCredit
          : getMonthlySeriesMock();
      charts.push(
        new Chart(barEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Debit',
                data: debit,
                backgroundColor: 'rgba(245, 54, 92, 0.75)',
                borderRadius: 4,
                maxBarThickness: 22,
              },
              {
                label: 'Credit',
                data: credit,
                backgroundColor: 'rgba(45, 206, 137, 0.75)',
                borderRadius: 4,
                maxBarThickness: 22,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: {
                grid: { borderDash: [4, 4] },
                ticks: {
                  font: { size: 11 },
                  callback: (v) => Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
                },
              },
            },
          },
        })
      );
    }

    const lineEl = document.getElementById('ledger-chart-balance-trend');
    destroyIfAny(lineEl);
    if (lineEl) {
      const { labels, balance } = getBalanceTrendMock();
      const ctx = lineEl.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 260);
      grad.addColorStop(0, 'rgba(94, 114, 228, 0.35)');
      grad.addColorStop(1, 'rgba(94, 114, 228, 0)');
      charts.push(
        new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Running balance',
                data: balance,
                borderColor: '#5e72e4',
                backgroundColor: grad,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: {
                grid: { borderDash: [4, 4] },
                ticks: {
                  font: { size: 11 },
                  callback: (v) => Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }),
                },
              },
            },
          },
        })
      );
    }

    const donutEl = document.getElementById('ledger-chart-category');
    destroyIfAny(donutEl);
    if (donutEl) {
      const breakdown = getCategoryBreakdownMock();
      charts.push(
        new Chart(donutEl.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: breakdown.map((d) => d.label),
            datasets: [
              {
                data: breakdown.map((d) => d.value),
                backgroundColor: ['#5e72e4', '#2dce89', '#fb6340', '#11cdef'],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
            },
            cutout: '62%',
          },
        })
      );
    }

    const weekEl = document.getElementById('ledger-chart-weekly');
    destroyIfAny(weekEl);
    if (weekEl) {
      const { labels, values } = getWeeklyActivityMock();
      charts.push(
        new Chart(weekEl.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Transactions',
                data: values,
                backgroundColor: 'rgba(17, 205, 239, 0.75)',
                borderRadius: 6,
                maxBarThickness: 16,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: {
                beginAtZero: true,
                grid: { borderDash: [4, 4] },
                ticks: { stepSize: 1, font: { size: 11 } },
              },
            },
          },
        })
      );
    }

    return () => {
      charts.forEach((c) => {
        try {
          c.destroy();
        } catch {
          /* ignore */
        }
      });
    };
  }, [monthlyDebitCredit]);

  return (
    <div className="row mb-2">
      <div className="col-lg-6 mb-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Monthly debit vs credit</h6>
            <p className="text-xs text-muted mb-0">
              {monthlyDebitCredit ? 'Totals by calendar month (filtered lines)' : 'Comparison by month (mock)'}
            </p>
          </div>
          <div className="card-body pt-2">
            <div className="chart-wrap">
              <canvas id="ledger-chart-monthly-dc" />
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-6 mb-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Running balance trend</h6>
            <p className="text-xs text-muted mb-0">Cumulative trajectory (mock)</p>
          </div>
          <div className="card-body pt-2">
            <div className="chart-wrap">
              <canvas id="ledger-chart-balance-trend" />
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-6 mb-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Category breakdown</h6>
            <p className="text-xs text-muted mb-0">Share of volume (mock)</p>
          </div>
          <div className="card-body pt-2">
            <div className="chart-wrap chart-wrap-sm">
              <canvas id="ledger-chart-category" />
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-6 mb-4">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header pb-0 bg-transparent">
            <h6 className="mb-0">Weekly activity</h6>
            <p className="text-xs text-muted mb-0">Transaction count — last 7 days (mock)</p>
          </div>
          <div className="card-body pt-2">
            <div className="chart-wrap chart-wrap-sm">
              <canvas id="ledger-chart-weekly" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
