import './orderStatusBadge.css';

export function normalizeOrderStatusKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const STATUS_CLASS_ALIASES = {
  canceled: 'cancelled',
  checkout_draft: 'draft',
  auto_draft: 'draft',
  paypending: 'pay_pending',
  onhold: 'on_hold',
  returnreceived: 'return_received',
  rto_received: 'rto_received',
  nostock: 'no_stock',
  outfordelivery: 'out_for_delivery',
  redispatch: 're_dispatch',
  customerquery: 'customer_query',
};

const KNOWN_STATUS_CLASSES = new Set([
  'active',
  'placed',
  'confirmed',
  'duplicate',
  'packed',
  'delivered',
  'draft',
  'pending',
  'on_hold',
  'cancelled',
  'failed',
  'processing',
  'return',
  'return_received',
  'pay_pending',
  'no_stock',
  'split',
  'combined',
  'claim',
  're_dispatch',
  'dispatched',
  'out_for_delivery',
  'stuck_5_days',
  'issues',
  'returned',
  'rto_received',
  'customer_query',
  'deleted',
  'completed',
  'shipped',
  'posted',
  'void',
  'refunded',
  'trash',
]);

/**
 * Unique badge class per order status. Unknown values fall back to slate.
 */
export function orderStatusBadgeClass(status) {
  let key = normalizeOrderStatusKey(status);
  if (!key) return 'oms-st oms-st-unknown';
  key = STATUS_CLASS_ALIASES[key] || key;
  if (!KNOWN_STATUS_CLASSES.has(key)) return 'oms-st oms-st-unknown';
  return `oms-st oms-st-${key}`;
}
