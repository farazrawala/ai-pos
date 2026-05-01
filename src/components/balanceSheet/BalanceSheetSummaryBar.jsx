/**
 * Footer totals band — general-ledger style (no marketing icons).
 * Expect parent `.bs-gl` for scoped layout; still works standalone.
 */
export function BalanceSheetSummaryBar({
  totalAssets,
  liabilitiesPlusEquity,
  difference,
  formatCurrency,
}) {
  const cells = [
    { label: 'Total assets', value: totalAssets },
    { label: 'Total liabilities + equity', value: liabilitiesPlusEquity },
    {
      label: 'Difference',
      value: difference,
      warn: Math.abs(difference) >= 0.01,
    },
  ];

  return (
    <div className="bs-gl-summary">
      {cells.map((cell) => (
        <div key={cell.label} className="bs-gl-summary-cell">
          <div className="lbl">{cell.label}</div>
          <div
            className="val"
            style={cell.warn ? { color: '#b45309' } : undefined}
          >
            {formatCurrency(cell.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
