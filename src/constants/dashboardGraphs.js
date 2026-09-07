/**
 * Dashboard chart keys stored on user.show_graphs_on_dashboard.
 * Keep in sync with Node-js-CRUD-Generator/models/user.js DASHBOARD_GRAPH_OPTIONS.
 */
export const DASHBOARD_GRAPH_OPTIONS = [
  { key: 'todays_money', label: "Today's Money" },
  { key: 'todays_users', label: "Today's Users" },
  { key: 'total_customers', label: 'Total Customers' },
  { key: 'sales', label: 'Sales' },
  { key: 'sales_overview', label: 'Sales Overview' },
  { key: 'purchases_vs_sales', label: 'Purchases vs Sales' },
  { key: 'sales_by_month', label: 'Sales by Month' },
  { key: 'gross_profit_margin_trend', label: 'Gross profit / margin trend' },
  { key: 'cogs_vs_sales', label: 'COGS vs sales' },
  { key: 'inventory_value', label: 'Inventory Value (by location)' },
  { key: 'discount_total', label: 'Discount (total)' },
  { key: 'ledger_debit_credit', label: 'Ledger Debit / Credit' },
  { key: 'top_selling_products', label: 'Top Selling Products' },
  { key: 'peak_sales_hours', label: 'Peak Sales Hours' },
  { key: 'top_vendors', label: 'Top Vendors' },
  { key: 'daily_orders', label: 'Daily Orders' },
  { key: 'avg_order_value', label: 'Average Order Value' },
  { key: 'expense_summary', label: 'Expense Summary' },
  { key: 'accounts_receivable_summary', label: 'Accounts Receivable' },
  { key: 'receivables_by_customer', label: 'Receivables by Customer' },
  { key: 'receivables_aging', label: 'Receivables Aging' },
  { key: 'sales_by_category', label: 'Sales by Category' },
  { key: 'expenses_by_account', label: 'Expenses by Account' },
  { key: 'expense_vs_revenue', label: 'Expense vs Revenue' },
  { key: 'low_stock_alerts', label: 'Low Stock Alerts' },
];

export const DASHBOARD_GRAPH_KEYS = DASHBOARD_GRAPH_OPTIONS.map((item) => item.key);

export const DASHBOARD_STAT_KEYS = ['todays_money', 'todays_users', 'total_customers', 'sales'];

const ALLOWED_GRAPH_KEYS = new Set(DASHBOARD_GRAPH_KEYS);

export function normalizeShowGraphsOnDashboard(input) {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const out = [];
  for (const item of list) {
    const key = String(item || '').trim();
    if (!ALLOWED_GRAPH_KEYS.has(key) || out.includes(key)) continue;
    out.push(key);
  }
  return out;
}

export function pickShowGraphsOnDashboard(user) {
  if (!user || typeof user !== 'object') return [];
  return normalizeShowGraphsOnDashboard(
    user.show_graphs_on_dashboard ?? user.show_grahs_on_dashboard ?? user.show_graphs
  );
}
