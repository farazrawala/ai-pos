import SalesOverviewCard from './SalesOverviewCard.jsx';
import PosSalesMonthWiseCard from './PosSalesMonthWiseCard.jsx';
import PosPurchasesSummaryCard from './PosPurchasesSummaryCard.jsx';
import PosTopProductsCard from './PosTopProductsCard.jsx';
import PosPeakHoursCard from './PosPeakHoursCard.jsx';
import PosTopVendorsCard from './PosTopVendorsCard.jsx';
import PosDailyOrdersCard from './PosDailyOrdersCard.jsx';
import PosAvgOrderValueCard from './PosAvgOrderValueCard.jsx';
import PosSalesByCategoryCard from './PosSalesByCategoryCard.jsx';
import PosAccountsReceivableSummaryCard from './PosAccountsReceivableSummaryCard.jsx';
import PosReceivablesByCustomerCard from './PosReceivablesByCustomerCard.jsx';
import PosReceivablesAgingCard from './PosReceivablesAgingCard.jsx';
import PosExpenseSummaryCard from './PosExpenseSummaryCard.jsx';
import PosExpensesByAccountCard from './PosExpensesByAccountCard.jsx';
import PosExpenseVsRevenueCard from './PosExpenseVsRevenueCard.jsx';
import PosGrossMarginTrendCard from './PosGrossMarginTrendCard.jsx';
import PosCogsVsSalesCard from './PosCogsVsSalesCard.jsx';
import PosInventoryValueCard from './PosInventoryValueCard.jsx';
import PosDiscountTotalsCard from './PosDiscountTotalsCard.jsx';
import PosLedgerDebitCreditCard from './PosLedgerDebitCreditCard.jsx';
import DashboardChartErrorBoundary from './DashboardChartErrorBoundary.jsx';
import LowStockAlertsTable from './LowStockAlertsTable.jsx';
import { DASHBOARD_GRAPH_KEYS } from '../../constants/dashboardGraphs.js';
import { useDashboardGraphs } from '../../hooks/useDashboardGraphs.js';

function GraphSlot({ canShow, graphKey, className, title, children }) {
  if (!canShow(graphKey)) return null;
  return (
    <div className={className}>
      {title ? (
        <DashboardChartErrorBoundary title={title}>{children}</DashboardChartErrorBoundary>
      ) : (
        children
      )}
    </div>
  );
}

export default function PosDashboardGraphs() {
  const { canShow, hasAny } = useDashboardGraphs();
  const showProfitSection = hasAny([
    'gross_profit_margin_trend',
    'cogs_vs_sales',
    'inventory_value',
    'discount_total',
    'ledger_debit_credit',
  ]);

  if (!hasAny(DASHBOARD_GRAPH_KEYS)) {
    return (
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card mb-0">
            <div className="card-body py-4 text-center text-secondary">
              No dashboard cards or graphs are assigned to this account. Ask an admin to enable
              them under user permissions.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {hasAny(['sales_overview', 'purchases_vs_sales']) ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="sales_overview" className="col-lg-7">
            <SalesOverviewCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="purchases_vs_sales" className="col-lg-5">
            <PosPurchasesSummaryCard />
          </GraphSlot>
        </div>
      ) : null}

      {canShow('sales_by_month') ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="sales_by_month" className="col-12" title="Sales by month">
            <PosSalesMonthWiseCard />
          </GraphSlot>
        </div>
      ) : null}

      {showProfitSection ? (
        <>
          <div className="row mt-1 mb-2">
            <div className="col-12">
              <h5 className="mb-1">Profit, inventory &amp; ledger</h5>
              <p className="text-sm text-secondary mb-0">
                Gross margin, COGS vs sales, inventory value, discounts, and ledger debit/credit
              </p>
            </div>
          </div>
          {hasAny(['gross_profit_margin_trend', 'cogs_vs_sales']) ? (
            <div className="row g-4 mb-4">
              <GraphSlot
                canShow={canShow}
                graphKey="gross_profit_margin_trend"
                className="col-lg-7"
                title="Gross profit / margin trend"
              >
                <PosGrossMarginTrendCard />
              </GraphSlot>
              <GraphSlot
                canShow={canShow}
                graphKey="cogs_vs_sales"
                className="col-lg-5"
                title="COGS vs sales"
              >
                <PosCogsVsSalesCard />
              </GraphSlot>
            </div>
          ) : null}
          {hasAny(['inventory_value', 'discount_total', 'ledger_debit_credit']) ? (
            <div className="row g-4 mb-4">
              <GraphSlot
                canShow={canShow}
                graphKey="inventory_value"
                className="col-lg-4"
                title="Inventory value (COGA)"
              >
                <PosInventoryValueCard />
              </GraphSlot>
              <GraphSlot
                canShow={canShow}
                graphKey="discount_total"
                className="col-lg-4"
                title="Discount totals"
              >
                <PosDiscountTotalsCard />
              </GraphSlot>
              <GraphSlot
                canShow={canShow}
                graphKey="ledger_debit_credit"
                className="col-lg-4"
                title="Ledger debit / credit"
              >
                <PosLedgerDebitCreditCard />
              </GraphSlot>
            </div>
          ) : null}
        </>
      ) : null}

      {hasAny(['top_selling_products', 'peak_sales_hours', 'top_vendors']) ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="top_selling_products" className="col-lg-4">
            <PosTopProductsCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="peak_sales_hours" className="col-lg-4">
            <PosPeakHoursCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="top_vendors" className="col-lg-4">
            <PosTopVendorsCard />
          </GraphSlot>
        </div>
      ) : null}

      {hasAny(['daily_orders', 'avg_order_value', 'expense_summary']) ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="daily_orders" className="col-lg-4">
            <PosDailyOrdersCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="avg_order_value" className="col-lg-4">
            <PosAvgOrderValueCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="expense_summary" className="col-lg-4">
            <PosExpenseSummaryCard />
          </GraphSlot>
        </div>
      ) : null}

      {hasAny(['accounts_receivable_summary', 'receivables_by_customer', 'receivables_aging']) ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="accounts_receivable_summary" className="col-lg-4">
            <PosAccountsReceivableSummaryCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="receivables_by_customer" className="col-lg-4">
            <PosReceivablesByCustomerCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="receivables_aging" className="col-lg-4">
            <PosReceivablesAgingCard />
          </GraphSlot>
        </div>
      ) : null}

      {hasAny(['sales_by_category', 'expenses_by_account']) ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="sales_by_category" className="col-lg-6">
            <PosSalesByCategoryCard />
          </GraphSlot>
          <GraphSlot canShow={canShow} graphKey="expenses_by_account" className="col-lg-6">
            <PosExpensesByAccountCard />
          </GraphSlot>
        </div>
      ) : null}

      {canShow('expense_vs_revenue') ? (
        <div className="row g-4 mb-4">
          <GraphSlot canShow={canShow} graphKey="expense_vs_revenue" className="col-lg-6">
            <PosExpenseVsRevenueCard />
          </GraphSlot>
        </div>
      ) : null}

      {canShow('low_stock_alerts') ? (
        <div className="row g-4">
          <GraphSlot canShow={canShow} graphKey="low_stock_alerts" className="col-12">
            <LowStockAlertsTable />
          </GraphSlot>
        </div>
      ) : null}
    </>
  );
}
