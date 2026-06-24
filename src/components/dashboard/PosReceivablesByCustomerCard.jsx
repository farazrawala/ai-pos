import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useReceivablesSummary } from '../../hooks/useReceivablesSummary.js';
import { periodLabelFromPeakApi, truncateChartLabel } from './chartHelpers.js';

export default function PosReceivablesByCustomerCard() {
  const canvasRef = useRef(null);
  const { loading, parties, summary, period, error } = useReceivablesSummary({ limit: 10 });
  const topBalance = parties.reduce((max, row) => Math.max(max, row.balance), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!parties.length) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: parties.map((row) => truncateChartLabel(row.name)),
          partyMeta: parties,
          datasets: [
            {
              label: 'Receivable',
              data: parties.map((row) => row.balance),
              backgroundColor: 'rgba(45, 206, 137, 0.85)',
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
                  return items[0]?.chart?.data?.partyMeta?.[idx]?.name ?? items[0]?.label ?? '';
                },
                label: (ctx) => {
                  const idx = ctx.dataIndex;
                  const row = ctx.chart?.data?.partyMeta?.[idx];
                  const lines = [formatCurrency(Number(ctx.parsed.x ?? 0))];
                  if (row?.transactionCount) {
                    lines.push(
                      `${row.transactionCount} transaction${row.transactionCount === 1 ? '' : 's'}`
                    );
                  }
                  return lines;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topBalance > 0 ? topBalance * 1.1 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: { font: { size: 11 }, callback: (v) => formatCurrency(Number(v)) },
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 }, padding: 8 } },
          },
        },
      });
    },
    [loading, error, parties]
  );

  const totalOutstanding =
    summary?.totalOutstanding ?? parties.reduce((s, r) => s + r.balance, 0);
  const customerCount = summary?.customerCount ?? parties.length;
  const subtitleParts = [
    `Top ${parties.length}`,
    formatCurrency(totalOutstanding),
    `${customerCount} customer${customerCount === 1 ? '' : 's'}`,
  ];
  if (period) subtitleParts.push(periodLabelFromPeakApi(period));

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Top receivables</h6>
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
