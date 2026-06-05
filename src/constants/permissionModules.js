/** Module keys for user permission grid (add/edit user, API payload). */
export const PERMISSION_MODULE_KEYS = [
  'pos',
  'orders',
  'purchase-orders',
  'purchase-order-returns',
  'sales-returns',
  'products',
  'categories',
  'warehouse',
  'warehouse-inventory',
  'stock',
  'adjustments',

  'barcode-print',
  'attributes',
  'users',

  'amount-transfers',
  'branch',

  'accounts',
  'balance-sheet',
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
  '/purchase-orders': 'purchase-orders',
  '/purchase-order-returns': 'purchase-order-returns',
  '/sales-returns': 'sales-returns',
  '/products': 'products',
  '/categories': 'categories',
  '/warehouse': 'warehouse',
  '/warehouse-inventory': 'warehouse-inventory',
  '/stock': 'stock',
  '/adjustments': 'adjustments',
  '/barcode-print': 'barcode-print',
  '/attributes': 'attributes',
  '/users': 'users',
  '/amount-transfers': 'amount-transfers',
  '/branch': 'branch',
  '/accounts': 'accounts',
  '/balance-sheet': 'balance-sheet',
  '/income-statement': 'income-statement',
  '/ledger': 'ledger',
  '/payments': 'payments',
  '/payment-receipts': 'payment-receipts',
  '/expenses': 'expenses',
  '/transactions': 'transactions',
  '/logs': 'logs',
  '/company-cache': null,
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
