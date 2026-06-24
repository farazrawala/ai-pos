import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { usePurchaseSummary } from '../../hooks/usePurchaseSummary.js';
import { periodLabelFromPeakApi, truncateChartLabel } from './chartHelpers.js';

export default function PosTopVendorsCard() {
  const canvasRef = useRef(null);
  const { loading, topVendors, summary, period, error } = usePurchaseSummary({
    period: 'current_month',
    limit: 10,
  });
  const topAmount = topVendors.reduce((max, row) => Math.max(max, row.totalAmount), 0);
  const totalPurchases = summary?.totalPurchases ?? topVendors.reduce((s, r) => s + r.totalAmount, 0);
  const periodLabel = periodLabelFromPeakApi(period);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!topVendors.length) return null;
      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: topVendors.map((row) => truncateChartLabel(row.name)),
          vendorMeta: topVendors,
          datasets: [
            {
              label: 'Purchases',
              data: topVendors.map((row) => row.totalAmount),
              backgroundColor: 'rgba(94, 114, 228, 0.85)',
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
                  return items[0]?.chart?.data?.vendorMeta?.[idx]?.name ?? items[0]?.label ?? '';
                },
                label: (ctx) => formatCurrency(Number(ctx.parsed.x ?? 0)),
                afterLabel: (ctx) => {
                  const row = topVendors[ctx.dataIndex];
                  if (!row?.purchaseOrderCount) return '';
                  return `${row.purchaseOrderCount} PO${row.purchaseOrderCount === 1 ? '' : 's'}`;
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
    [loading, error, topVendors]
  );

  const subtitleParts = [
    `Top ${topVendors.length}`,
    formatCurrency(totalPurchases),
    summary?.purchaseOrderCount
      ? `${summary.purchaseOrderCount} PO${summary.purchaseOrderCount === 1 ? '' : 's'}`
      : null,
    periodLabel,
  ].filter(Boolean);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Top vendors</h6>
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
