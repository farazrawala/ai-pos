/** POS `order_status` → `order_website_status` when status is changed in OMS/POS. */
export const POS_TO_WEBSITE_STATUS = {
  pending: 'pending',
  draft: 'pending',
  placed: 'confirmed',
  confirmed: 'confirmed',
  processing: 'processing',
  active: 'processing',
  packed: 'shipped',
  in_transit: 'shipped',
  delivered: 'delivered',
  completed: 'completed',
  cancelled: 'voided',
  failed: 'failed',
  on_hold: 'on-hold',
  return: 'refunded',
  return_received: 'refunded',
  duplicate: 'voided',
  products_skipped: 'on-hold',
};

export function normalizePosOrderStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

export function mapPosOrderStatusToWebsiteStatus(posStatus) {
  const key = normalizePosOrderStatus(posStatus);
  return POS_TO_WEBSITE_STATUS[key] || '';
}
