/** Module keys for user permission grid (add/edit user, API payload). */
export const PERMISSION_MODULE_KEYS = [
  'pos',
  'orders',
  'oms',
  'purchase-orders',
  'purchase-order-returns',
  'sales-returns',
  'products',
  'categories',
  'brands',
  'integration',
  'big-commerce',
  'courier-integration',
  'process',
  'warehouse',
  'warehouse-inventory',
  'stock',
  'stock-recounts',
  'low-stock-alerts',
  'adjustments',

  'company',
  'barcode-print',
  'printer-settings',
  'attributes',
  'users',

  'amount-transfers',
  'branch',

  'accounts',
  'balance-sheet',
  'advance-balance-sheet',
  'profit-vs-gl-gap',
  'profit-report',
  'product-pulse',
  'order-pulse',
  'income-statement',
  'ledger',
  'payments',
  'payment-receipts',

  'expenses',
  'transactions',
  'whatsapp-messages',
  'logs',
  'support',
  'tasks',
];

export const PERMISSION_ACTIONS = ['view', 'add', 'edit', 'delete'];

/** Map sidebar routes to login `permissions` module keys (`null` = always visible when logged in). */
export const ROUTE_PERMISSION_MODULE = {
  '/': null,
  '/pos': 'pos',
  '/orders': 'orders',
  '/oms': 'oms',
  '/purchase-orders': 'purchase-orders',
  '/purchase-order-returns': 'purchase-order-returns',
  '/sales-returns': 'sales-returns',
  '/products': 'products',
  '/products/duplicate-barcodes': 'products',
  '/categories': 'categories',
  '/brands': 'brands',
  '/integration': 'integration',
  '/big-commerce': 'big-commerce',
  '/big-commerce/requests': 'big-commerce',
  '/courier-integration': 'courier-integration',
  '/processes': 'process',
  '/warehouse': 'warehouse',
  '/warehouse-inventory': 'warehouse-inventory',
  '/stock': 'stock',
  '/stock-recounts': 'stock-recounts',
  '/low-stock-alerts': 'low-stock-alerts',
  '/adjustments': 'adjustments',
  '/company': null,
  '/barcode-print': 'barcode-print',
  '/product-print': 'products',
  '/printer-settings': 'printer-settings',
  '/printer-settings/a4-layout': 'printer-settings',
  '/attributes': 'attributes',
  '/users': 'users',
  '/amount-transfers': 'amount-transfers',
  '/branch': 'branch',
  '/accounts': 'accounts',
  '/balance-sheet': 'balance-sheet',
  '/advance-balance-sheet': 'advance-balance-sheet',
  '/profit-vs-gl-gap': 'profit-vs-gl-gap',
  '/profit-report': 'profit-report',
  '/product-pulse': 'product-pulse',
  '/order-pulse': 'order-pulse',
  '/income-statement': 'income-statement',
  '/ledger': 'ledger',
  '/payments': 'payments',
  '/payment-receipts': 'payment-receipts',
  '/expenses': 'expenses',
  '/transactions': 'transactions',
  '/whatsapp-messages': 'whatsapp-messages',
  '/whatsapp-chat': 'whatsapp-messages',
  '/support': 'support',
  '/support/new': 'support',
  '/admin/support': 'support',
  '/tasks/boards': 'tasks',
  '/tasks/my-tasks': 'tasks',
  '/tasks/assigned': 'tasks',
  '/tasks/created': 'tasks',
  '/tasks/completed': 'tasks',
  '/logs': 'logs',
  '/company-cache': null,
  '/company-queues': null,
};

export function getPermissionModuleForPath(pathname = '') {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (ROUTE_PERMISSION_MODULE[path] !== undefined) {
    return ROUTE_PERMISSION_MODULE[path];
  }
  // /support/:id and /admin/support/:id
  if (/^\/support\/[^/]+$/.test(path) || /^\/admin\/support(\/[^/]+)?$/.test(path)) {
    return 'support';
  }
  if (/^\/tasks(\/|$)/.test(path)) {
    return 'tasks';
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const base = `/${segments[0]}`;
  return ROUTE_PERMISSION_MODULE[base] ?? null;
}
