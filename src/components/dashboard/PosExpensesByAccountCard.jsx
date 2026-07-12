import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useExpensesByAccount } from '../../hooks/useExpensesByAccount.js';
import { periodLabelFromPeakApi, truncateChartLabel } from './chartHelpers.js';
import { POS_CATEGORY_COLORS } from './posDashboardMock.js';

export default function PosExpensesByAccountCard() {
  const canvasRef = useRef(null);
  const { loading, accounts, summary, period, error } = useExpensesByAccount({
    period: 'last_30_days',
    limit: 10,
  });
  const topAmount = accounts.reduce((max, row) => Math.max(max, row.totalAmount), 0);
  const totalAmount = summary?.totalAmount ?? accounts.reduce((s, r) => s + r.totalAmount, 0);
  const expenseCount = summary?.expenseCount ?? 0;
  const accountCount = summary?.accountCount ?? accounts.length;
  const periodLabel = periodLabelFromPeakApi(period);
  const subtitleParts = [
    `Top ${accounts.length}`,
    formatCurrency(totalAmount),
    expenseCount ? `${expenseCount} expense${expenseCount === 1 ? '' : 's'}` : null,
    accountCount ? `${accountCount} account${accountCount === 1 ? '' : 's'}` : null,
    periodLabel,
  ].filter(Boolean);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!accounts.length) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: accounts.map((row) => truncateChartLabel(row.name)),
          accountMeta: accounts,
          datasets: [
            {
              label: 'Expense',
              data: accounts.map((row) => row.totalAmount),
              backgroundColor: accounts.map(
                (_, i) => POS_CATEGORY_COLORS[i % POS_CATEGORY_COLORS.length]
              ),
              borderRadius: 4,
              maxBarThickness: 20,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 8, right: 16, bottom: 8, left: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const row = items[0]?.chart?.data?.accountMeta?.[idx];
                  if (!row) return items[0]?.label ?? '';
                  return row.accountNumber ? `${row.accountNumber} · ${row.name}` : row.name;
                },
                label: (ctx) => formatCurrency(Number(ctx.parsed.x ?? 0)),
                afterLabel: (ctx) => {
                  const row = accounts[ctx.dataIndex];
                  if (!row?.expenseCount) return '';
                  return `${row.expenseCount} expense${row.expenseCount === 1 ? '' : 's'}`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topAmount > 0 ? topAmount * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: { font: { size: 11 }, callback: (v) => formatCurrency(Number(v)) },
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 }, padding: 8 } },
          },
        },
      });
    },
    [loading, error, accounts]
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Expense Distribution</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">{subtitleParts.join(' · ')}</span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        <div className="chart" style={{ minHeight: 280 }}>
          <canvas ref={canvasRef} className="chart-canvas" height="280" />
        </div>
      </div>
    </div>
  );
}
