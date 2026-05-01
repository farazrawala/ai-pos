import { motion } from 'framer-motion';

/**
 * @param {{
 *   totalAssets: number;
 *   liabilitiesPlusEquity: number;
 *   difference: number;
 *   formatCurrency: (n: number) => string;
 * }} props
 */
export function BalanceSheetSummaryBar({
  totalAssets,
  liabilitiesPlusEquity,
  difference,
  formatCurrency,
}) {
  const cells = [
    {
      label: 'Total Assets',
      value: totalAssets,
      border: 'border-success',
      icon: 'ni ni-money-coins',
      iconBg: 'bg-gradient-success',
    },
    {
      label: 'Total Liabilities + Equity',
      value: liabilitiesPlusEquity,
      border: 'border-primary',
      icon: 'ni ni-chart-bar-32',
      iconBg: 'bg-gradient-primary',
    },
    {
      label: 'Difference',
      value: difference,
      border: Math.abs(difference) < 0.01 ? 'border-success' : 'border-warning',
      icon: Math.abs(difference) < 0.01 ? 'ni ni-check-bold' : 'ni ni-fat-remove',
      iconBg: Math.abs(difference) < 0.01 ? 'bg-gradient-success' : 'bg-gradient-warning',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="row mt-4 g-3"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="col-md-4">
          <div className={`card h-100 mb-0 shadow-sm border-start border-3 ${cell.border}`}>
            <div className="card-body p-3">
              <div className="row">
                <div className="col-8">
                  <p className="text-xs text-uppercase font-weight-bold text-muted mb-1">
                    {cell.label}
                  </p>
                  <h5 className="font-weight-bolder mb-0">{formatCurrency(cell.value)}</h5>
                </div>
                <div className="col-4 text-end d-flex align-items-center justify-content-end">
                  <div
                    className={`icon icon-shape ${cell.iconBg} shadow text-center rounded-circle`}
                    style={{ width: '2.5rem', height: '2.5rem', lineHeight: '2.5rem' }}
                  >
                    <i
                      className={`${cell.icon} text-lg text-white opacity-10`}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
