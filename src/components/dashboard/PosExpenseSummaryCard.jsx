import { formatCurrency } from '../balanceSheet/formatCurrency.js';
import { useExpenseSummary } from '../../hooks/useExpenseSummary.js';
import { periodLabelFromPeakApi } from './chartHelpers.js';

export default function PosExpenseSummaryCard() {
  const { loading, summary, period, error } = useExpenseSummary({ period: 'current_month' });
  const total = summary?.totalAmount ?? 0;
  const count = summary?.expenseCount ?? 0;
  const average = summary?.averageExpense ?? 0;
  const periodLabel = periodLabelFromPeakApi(period);

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent">
        <h6 className="text-capitalize">Expenses summary</h6>
        <p className="text-sm mb-0">
          {loading ? (
            <span className="text-secondary">Loading…</span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-secondary">{periodLabel}</span>
          )}
        </p>
      </div>
      <div className="card-body p-3 pt-2">
        {loading ? (
          <div className="text-center text-secondary text-sm py-5">Loading…</div>
        ) : error ? null : (
          <div
            className="d-flex flex-column justify-content-center h-100 py-4 px-2"
            style={{ minHeight: 260 }}
          >
            <div className="text-center mb-4">
              <h2 className="font-weight-bold text-dark mb-1">{formatCurrency(total)}</h2>
              <p className="text-sm text-secondary mb-0">total expenses</p>
            </div>
            <div className="row g-3 text-center">
              <div className="col-6">
                <p className="text-xs text-uppercase text-secondary font-weight-bold mb-1">
                  Expense count
                </p>
                <p className="text-sm font-weight-bold mb-0">{count.toLocaleString()}</p>
              </div>
              <div className="col-6">
                <p className="text-xs text-uppercase text-secondary font-weight-bold mb-1">
                  Average
                </p>
                <p className="text-sm font-weight-bold mb-0">{formatCurrency(average)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
