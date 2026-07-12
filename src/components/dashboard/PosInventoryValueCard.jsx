import { useRef } from 'react';
import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { useInventoryValue } from '../../hooks/useInventoryValue.js';
import { truncateChartLabel } from './chartHelpers.js';

const INVENTORY_COLORS = [
  '#5e72e4',
  '#11cdef',
  '#2dce89',
  '#fb6340',
  '#f5365c',
  '#8392ab',
  '#172b4d',
  '#ffd600',
];

export default function PosInventoryValueCard() {
  const canvasRef = useRef(null);
  const { loading, products, summary, error } = useInventoryValue({ limit: 8 });
  const grandTotal = summary?.grandTotal ?? 0;
  const productCount = summary?.productCount ?? 0;
  const topAmount = products.reduce((max, row) => Math.max(max, row.amount), 0);

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (!products.length) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: products.map((row) => truncateChartLabel(row.name, 18)),
          productMeta: products,
          datasets: [
            {
              label: 'Inventory value',
              data: products.map((row) => row.amount),
              backgroundColor: products.map(
                (_, i) => INVENTORY_COLORS[i % INVENTORY_COLORS.length]
              ),
              borderRadius: 5,
              maxBarThickness: 18,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 4, right: 12, bottom: 4, left: 4 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  return products[idx]?.name ?? items[0]?.label ?? '';
                },
                label: (ctx) => formatCurrency(Number(ctx.parsed.x ?? 0)),
                afterLabel: (ctx) => {
                  if (!grandTotal) return '';
                  const pct = ((Number(ctx.parsed.x ?? 0) / grandTotal) * 100).toFixed(1);
                  return `${pct}% of inventory`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '8%',
              suggestedMax: topAmount > 0 ? topAmount * 1.12 : undefined,
              grid: { borderDash: [4, 4] },
              ticks: {
                font: { size: 10 },
                callback: (v) => formatCurrency(Number(v)),
              },
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 10 }, padding: 6 },
            },
          },
        },
      });
    },
    [loading, error, products, grandTotal]
  );

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Inventory value (COGA)</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">
              {formatCurrency(grandTotal)} total · {productCount} product
              {productCount === 1 ? '' : 's'} · at cost
            </span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 280 }}
          >
            Loading…
          </div>
        ) : error ? null : products.length ? (
          <>
            <div className="chart" style={{ minHeight: 280 }}>
              <canvas ref={canvasRef} className="chart-canvas" height="280" />
            </div>
            {summary?.otherTotal > 0 ? (
              <p className="text-xxs text-secondary text-center mb-0 mt-1">
                Top {products.length} shown · {formatCurrency(summary.otherTotal)} in other
                SKUs
              </p>
            ) : null}
          </>
        ) : (
          <div
            className="d-flex align-items-center justify-content-center text-secondary text-sm"
            style={{ minHeight: 280 }}
          >
            No inventory valuation data
          </div>
        )}
      </div>
    </div>
  );
}
