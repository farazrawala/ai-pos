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
  'process',
  'warehouse',
  'warehouse-inventory',
  'stock',
  'adjustments',

  'company',
  'barcode-print',
  'attributes',
  'users',

  'amount-transfers',
  'branch',

  'accounts',
  'balance-sheet',
  'advance-balance-sheet',
  'profit-vs-gl-gap',
  'income-statement',
  'ledger',
  'payments',
  'payment-receipts',

  'expenses',
  'transactions',
  'logs',
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
  '/categories': 'categories',
  '/brands': 'brands',
  '/integration': 'integration',
  '/processes': 'process',
  '/warehouse': 'warehouse',
  '/warehouse-inventory': 'warehouse-inventory',
  '/stock': 'stock',
  '/adjustments': 'adjustments',
  '/company': null,
  '/barcode-print': 'barcode-print',
  '/product-print': 'products',
  '/attributes': 'attributes',
  '/users': 'users',
  '/amount-transfers': 'amount-transfers',
  '/branch': 'branch',
  '/accounts': 'accounts',
  '/balance-sheet': 'balance-sheet',
  '/advance-balance-sheet': 'advance-balance-sheet',
  '/profit-vs-gl-gap': 'profit-vs-gl-gap',
  '/income-statement': 'income-statement',
  '/ledger': 'ledger',
  '/payments': 'payments',
  '/payment-receipts': 'payment-receipts',
  '/expenses': 'expenses',
  '/transactions': 'transactions',
  '/logs': 'logs',
  '/company-cache': null,
  '/company-queues': null,
};

export function getPermissionModuleForPath(pathname = '') {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (ROUTE_PERMISSION_MODULE[path] !== undefined) {
    return ROUTE_PERMISSION_MODULE[path];
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const base = `/${segments[0]}`;
  return ROUTE_PERMISSION_MODULE[base] ?? null;
}
