import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SectionCard } from './SectionCard.jsx';
import { BalanceSheetSummaryBar } from './BalanceSheetSummaryBar.jsx';
import { formatCurrency as formatCurrencyFn } from './formatCurrency.js';

const MOCK_BALANCE_SHEET = {
  assets: {
    current: [
      { label: 'Cash', amount: 45_000 },
      { label: 'Accounts Receivable', amount: 28_000 },
      { label: 'Inventory', amount: 62_000 },
    ],
    nonCurrent: [
      { label: 'Property', amount: 180_000 },
      { label: 'Equipment', amount: 95_000 },
    ],
  },
  liabilities: {
    current: [
      { label: 'Accounts Payable', amount: 22_000 },
      { label: 'Short-term Debt', amount: 15_000 },
    ],
    longTerm: [{ label: 'Long-term notes payable', amount: 120_000 }],
  },
  equity: [
    { label: "Owner's Equity", amount: 150_000 },
    { label: 'Retained Earnings', amount: 103_000 },
  ],
};

function sumLines(lines) {
  return lines.reduce((acc, row) => acc + row.amount, 0);
}

function TotalHighlight({ label, amount, formatCurrency, variant }) {
  const alertClass =
    variant === 'success'
      ? 'alert-success'
      : variant === 'danger'
        ? 'alert-danger'
        : 'alert-info';

  return (
    <div className={`alert ${alertClass} py-3 mb-3 shadow-sm`} role="status">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="font-weight-bold mb-0">{label}</span>
        <span className="font-weight-bolder mb-0 h5">{formatCurrency(amount)}</span>
      </div>
    </div>
  );
}

/**
 * Balance sheet aligned with Argon dashboard: Bootstrap cards, typography, and accents.
 */
export default function BalanceSheetView() {
  const fmt = (n) => formatCurrencyFn(n, 'USD');

  const {
    totalCurrentAssets,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    totalLiabilities,
    totalEquity,
    liabilitiesPlusEquity,
    difference,
    balanced,
  } = useMemo(() => {
    const data = MOCK_BALANCE_SHEET;
    const totalCurrentAssets = sumLines(data.assets.current);
    const totalNonCurrentAssets = sumLines(data.assets.nonCurrent);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    const totalCurrentLiabilities = sumLines(data.liabilities.current);
    const totalLongTermLiabilities = sumLines(data.liabilities.longTerm);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalEquity = sumLines(data.equity);
    const liabilitiesPlusEquity = totalLiabilities + totalEquity;
    const difference = totalAssets - liabilitiesPlusEquity;
    const balanced = Math.abs(difference) < 0.005;

    return {
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalLongTermLiabilities,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      difference,
      balanced,
    };
  }, []);

  const asOf = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date());

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-8">
                  <h5 className="mb-0">Balance Sheet</h5>
                  <p className="text-sm text-muted mb-0">As of {asOf}</p>
                </div>
                <div className="col-md-4 text-md-end mt-2 mt-md-0">
                  <span className="badge bg-gradient-primary">Financial position</span>
                </div>
              </div>
            </div>

            <div className="card-body pt-3">
              <div className="row g-4">
                <motion.div
                  className="col-lg-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-xs text-uppercase font-weight-bold text-muted mb-3">Assets</p>
                  <SectionCard
                    title="Current Assets"
                    tone="assets"
                    items={MOCK_BALANCE_SHEET.assets.current}
                    subtotal={totalCurrentAssets}
                    formatCurrency={fmt}
                  />
                  <SectionCard
                    title="Non-Current Assets"
                    tone="assets"
                    items={MOCK_BALANCE_SHEET.assets.nonCurrent}
                    subtotal={totalNonCurrentAssets}
                    formatCurrency={fmt}
                  />
                  <TotalHighlight label="Total Assets" amount={totalAssets} formatCurrency={fmt} variant="success" />
                </motion.div>

                <motion.div
                  className="col-lg-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                >
                  <p className="text-xs text-uppercase font-weight-bold text-muted mb-3">
                    Liabilities &amp; Equity
                  </p>
                  <SectionCard
                    title="Current Liabilities"
                    tone="liabilities"
                    items={MOCK_BALANCE_SHEET.liabilities.current}
                    subtotal={totalCurrentLiabilities}
                    formatCurrency={fmt}
                  />
                  <SectionCard
                    title="Long-term Liabilities"
                    tone="liabilities"
                    items={MOCK_BALANCE_SHEET.liabilities.longTerm}
                    subtotal={totalLongTermLiabilities}
                    formatCurrency={fmt}
                  />
                  <TotalHighlight
                    label="Total Liabilities"
                    amount={totalLiabilities}
                    formatCurrency={fmt}
                    variant="danger"
                  />
                  <SectionCard
                    title="Equity"
                    tone="equity"
                    items={MOCK_BALANCE_SHEET.equity}
                    subtotal={totalEquity}
                    formatCurrency={fmt}
                  />
                  <TotalHighlight label="Total Equity" amount={totalEquity} formatCurrency={fmt} variant="info" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={`alert ${balanced ? 'alert-success' : 'alert-warning'} mt-2 mb-0`}
                role="status"
              >
                <p className="font-weight-bold mb-2">
                  {balanced ? (
                    <>
                      <i className="ni ni-check-bold me-1" aria-hidden="true" />
                      Accounting equation holds
                    </>
                  ) : (
                    <>
                      <i className="ni ni-fat-remove me-1" aria-hidden="true" />
                      Check figures — totals do not balance
                    </>
                  )}
                </p>
                <p className="text-sm mb-0 font-weight-bold">
                  Assets = Liabilities + Equity &nbsp;→&nbsp; {fmt(totalAssets)} = {fmt(liabilitiesPlusEquity)}
                </p>
              </motion.div>

              <BalanceSheetSummaryBar
                totalAssets={totalAssets}
                liabilitiesPlusEquity={liabilitiesPlusEquity}
                difference={difference}
                formatCurrency={fmt}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
