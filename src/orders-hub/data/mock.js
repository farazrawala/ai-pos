export const heroStats = [
  { id: 'sales', label: "Today's Sales", value: 186400, prefix: 'PKR ', change: '+18.4%' },
  { id: 'orders', label: 'Orders', value: 24, change: '24 new' },
  { id: 'profit', label: 'Profit', value: 2840, prefix: 'PKR ', change: '+9.2%' },
  { id: 'expenses', label: 'Expenses', value: 12400, prefix: 'PKR ' },
  { id: 'stock', label: 'Low Stock', value: 8, change: 'Alert' },
];

export const floatingCards = [
  { id: 'sales', label: "Today's Sales", value: '+18.4%', tone: 'up' },
  { id: 'orders', label: 'New Orders', value: '24', tone: 'info' },
  { id: 'profit', label: 'Profit', value: 'PKR 2,840', tone: 'up' },
  { id: 'stock', label: 'Low Stock Items', value: '8', tone: 'warn' },
];

export const salesTrend = [
  { label: 'Mon', sales: 92000, profit: 21400 },
  { label: 'Tue', sales: 108000, profit: 24800 },
  { label: 'Wed', sales: 98000, profit: 22100 },
  { label: 'Thu', sales: 126000, profit: 30100 },
  { label: 'Fri', sales: 154000, profit: 36200 },
  { label: 'Sat', sales: 186400, profit: 42100 },
  { label: 'Sun', sales: 74000, profit: 16800 },
];

export const monthlyProfit = [
  { month: 'January', revenue: 2100000, cogs: 1260000, expenses: 310000, profit: 530000 },
  { month: 'February', revenue: 1980000, cogs: 1180000, expenses: 295000, profit: 505000 },
  { month: 'March', revenue: 2340000, cogs: 1370000, expenses: 320000, profit: 650000 },
  { month: 'April', revenue: 2210000, cogs: 1290000, expenses: 305000, profit: 615000 },
  { month: 'May', revenue: 2560000, cogs: 1460000, expenses: 298000, profit: 802000 },
  { month: 'June', revenue: 2720000, cogs: 1510000, expenses: 274000, profit: 936000 },
];

export const recentTransactions = [
  { id: 'INV-1842', party: 'Ayesha Traders', amount: 18400, method: 'Cash', time: '2 min ago' },
  { id: 'INV-1841', party: 'Walk-in', amount: 2650, method: 'Card', time: '11 min ago' },
  { id: 'INV-1840', party: 'Hassan Electronics', amount: 42800, method: 'Credit', time: '28 min ago' },
  { id: 'INV-1839', party: 'Noor Fashion', amount: 9100, method: 'JazzCash', time: '41 min ago' },
];

export const topProducts = [
  { name: 'Wireless Earbuds Pro', sold: 42, amount: 126000 },
  { name: 'Cotton Polo Shirt', sold: 31, amount: 46500 },
  { name: 'USB-C Fast Charger', sold: 28, amount: 33600 },
  { name: 'Kitchen Mixer 3L', sold: 12, amount: 72000 },
];

export const ledgerRows = [
  { date: '18 Aug', description: 'Invoice INV-1842', debit: 18400, credit: 0, balance: 142800 },
  { date: '18 Aug', description: 'Payment received', debit: 0, credit: 10000, balance: 124400 },
  { date: '17 Aug', description: 'Invoice INV-1798', debit: 22600, credit: 0, balance: 134400 },
  { date: '16 Aug', description: 'Return CN-214', debit: 0, credit: 1800, balance: 111800 },
  { date: '16 Aug', description: 'Opening balance', debit: 0, credit: 0, balance: 113600 },
];

export const ledgerTabs = ['Customers', 'Suppliers', 'Cash', 'Expenses', 'Sales'];

export const ledgerKpis = [
  { id: 'receivable', label: 'Total Receivable', value: 842600 },
  { id: 'payable', label: 'Total Payable', value: 318400 },
  { id: 'cash', label: 'Cash Balance', value: 126800 },
  { id: 'bank', label: 'Bank Balance', value: 954200 },
  { id: 'profit', label: 'Net Profit', value: 284000 },
];

export const dailyReport = [
  { label: 'Sales', value: 186400 },
  { label: 'Purchases', value: 54200 },
  { label: 'Expenses', value: 12400 },
  { label: 'Profit', value: 42100 },
  { label: 'Returns', value: 3200 },
  { label: 'Discounts', value: 1850 },
  { label: 'Cash', value: 98400 },
  { label: 'Credit', value: 88000 },
];

export const posCatalog = [
  { name: 'Earbuds Pro', price: 2999, sku: 'EL-104' },
  { name: 'Polo Shirt', price: 1499, sku: 'FS-221' },
  { name: 'USB-C Charger', price: 1199, sku: 'EL-088' },
  { name: 'Mixer 3L', price: 5999, sku: 'KT-019' },
  { name: 'Rice 5kg', price: 890, sku: 'GR-012' },
  { name: 'Olive Oil 1L', price: 1450, sku: 'GR-044' },
];

export const posCart = [
  { name: 'Earbuds Pro', qty: 1, price: 2999 },
  { name: 'USB-C Charger', qty: 2, price: 1199 },
];

export const storeProducts = [
  { name: 'Earbuds Pro', price: 2999, category: 'Electronics' },
  { name: 'Cotton Polo', price: 1499, category: 'Fashion' },
  { name: 'Fast Charger', price: 1199, category: 'Electronics' },
  { name: 'Mixer 3L', price: 5999, category: 'Home' },
];

export const storeCategories = ['All', 'Electronics', 'Fashion', 'Grocery', 'Home'];

export const recentOrders = [
  { id: 'OH-24018', customer: 'Ayesha Traders', total: 18400, status: 'Paid' },
  { id: 'OH-24017', customer: 'Walk-in', total: 2650, status: 'Paid' },
  { id: 'OH-24016', customer: 'Hassan Electronics', total: 42800, status: 'Credit' },
  { id: 'OH-24015', customer: 'Noor Fashion', total: 9100, status: 'Paid' },
];

export const lowStock = [
  { name: 'USB-C Fast Charger', warehouse: 'Main Store', qty: 4, reorder: 20 },
  { name: 'Rice 5kg', warehouse: 'Warehouse B', qty: 8, reorder: 40 },
  { name: 'Polo Shirt — Blue M', warehouse: 'Main Store', qty: 3, reorder: 12 },
];

export const recentPayments = [
  { party: 'Ayesha Traders', amount: 10000, type: 'Received' },
  { party: 'Al-Noor Supplies', amount: 45000, type: 'Paid' },
  { party: 'Hassan Electronics', amount: 15000, type: 'Received' },
];

export const dashboardNav = [
  'Dashboard',
  'POS',
  'Orders',
  'Products',
  'Inventory',
  'Customers',
  'Suppliers',
  'Ledger',
  'Invoices',
  'Expenses',
  'Reports',
  'Online Store',
  'Settings',
];

export const warehouses = [
  { name: 'Main Store', city: 'Karachi', sku: 1284, value: 4200000, fill: 78 },
  { name: 'Warehouse B', city: 'Lahore', sku: 642, value: 1880000, fill: 54 },
  { name: 'Outlet Gulberg', city: 'Lahore', sku: 318, value: 760000, fill: 41 },
];

export const profitInsights = [
  { title: 'Profit increased 14.8% this month', detail: 'June net profit is ahead of May on stronger weekend sales.' },
  { title: 'Top selling category: Electronics', detail: 'Earbuds and chargers contributed 38% of gross profit.' },
  { title: 'Operating expenses decreased 8.2%', detail: 'Utilities and logistics ran under last month’s budget.' },
];
