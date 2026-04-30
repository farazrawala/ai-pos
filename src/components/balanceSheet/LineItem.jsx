/**
 * @param {{ label: string; amount: number; formatCurrency: (n: number) => string }} props
 */
export function LineItem({ label, amount, formatCurrency }) {
  return (
    <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
      <span className="text-sm text-muted mb-0">{label}</span>
      <span className="text-sm font-weight-bold mb-0 text-end ps-3">{formatCurrency(amount)}</span>
    </div>
  );
}
