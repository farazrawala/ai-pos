import { useRef } from 'react';
import { formatCurrency, formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useChartJs } from '../../hooks/useChartJs.js';
import { usePurchaseSummary } from '../../hooks/usePurchaseSummary.js';
import { dayLabelFromDate, periodLabelFromPeakApi } from './chartHelpers.js';

export default function PosPurchasesSummaryCard() {
  const canvasRef = useRef(null);
  const { loading, summary, period, error } = usePurchaseSummary({ period: 'current_month' });

  const vs = summary?.purchasesVsSales;
  const netPurchases = vs?.netPurchases ?? summary?.netPurchases ?? 0;
  const sales = vs?.sales ?? summary?.totalSales ?? 0;
  const purchasesPercent = vs?.purchasesPercentOfSales ?? 0;
  const purchaseOrderCount = summary?.purchaseOrderCount ?? 0;
  const totalPurchaseReturns = summary?.totalPurchaseReturns ?? 0;
  const averagePoValue = summary?.averagePurchaseOrderValue ?? 0;

  useChartJs(
    canvasRef,
    (Chart, canvas) => {
      if (netPurchases <= 0 && sales <= 0) return null;

      return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Net purchases', 'Sales'],
          datasets: [
            {
              label: 'Amount',
              data: [netPurchases, sales],
              backgroundColor: ['#5e72e4', '#2dce89'],
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
                  if (ctx.dataIndex === 0 && purchaseOrderCount) {
                    return `${purchaseOrderCount} PO${purchaseOrderCount === 1 ? '' : 's'}`;
                  }
                  if (ctx.dataIndex === 1 && summary?.orderCount) {
                    return `${summary.orderCount} order${summary.orderCount === 1 ? '' : 's'}`;
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
    [loading, error, netPurchases, sales, purchaseOrderCount, summary?.orderCount]
  );

  const periodLabel = periodLabelFromPeakApi(period);
  const subtitleParts = [
    `${formatCurrency(netPurchases)} net purchases`,
    purchasesPercent > 0 ? `${purchasesPercent.toFixed(2)}% of sales` : null,
    periodLabel,
  ].filter(Boolean);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Purchases vs sales</h6>
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
        {loading ? (
          <div className="text-center text-secondary text-sm py-5">Loading…</div>
        ) : error ? null : (
          <>
            <div className="chart" style={{ minHeight: 240 }}>
              <canvas ref={canvasRef} className="chart-canvas" height="240" />
            </div>
            {summary ? (
              <div className="row g-2 text-center mt-1">
                <div className="col-4">
                  <p className="text-xxs text-uppercase text-secondary mb-0">PO count</p>
                  <p className="text-sm font-weight-bold mb-0">{purchaseOrderCount.toLocaleString()}</p>
                </div>
                <div className="col-4">
                  <p className="text-xxs text-uppercase text-secondary mb-0">Returns</p>
                  <p className="text-sm font-weight-bold mb-0">{formatCurrency(totalPurchaseReturns)}</p>
                </div>
                <div className="col-4">
                  <p className="text-xxs text-uppercase text-secondary mb-0">Avg PO</p>
                  <p className="text-sm font-weight-bold mb-0">
                    {formatCurrencyAccounting(averagePoValue)}
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
