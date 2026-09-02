import { createPushOrderProcessRequest } from '../features/process/processAPI.js';
import { integrationIdFromRecord } from '../routes/integration/integrationForm.js';

const pickOrderIntegrationId = (row) => {
  const integration = row?.integration_id ?? row?.integrationId;
  if (typeof integration === 'string' || typeof integration === 'number') {
    const id = String(integration).trim();
    return id || '';
  }
  if (integration && typeof integration === 'object' && !Array.isArray(integration)) {
    return String(integrationIdFromRecord(integration) || '').trim();
  }
  return '';
};

const pickIntegrationOrderId = (row) => {
  const raw = row?.integration_order_id ?? row?.integrationOrderId ?? '';
  const value = String(raw ?? '').trim();
  if (!value || value === '—') return '';
  return value;
};

/** True when the order is linked to a store integration (Shopify, WooCommerce, etc.). */
export const orderHasStoreIntegration = (row) => {
  if (!row || typeof row !== 'object') return false;
  const integrationId = pickOrderIntegrationId(row);
  if (!integrationId) return false;

  const orderType = String(row?.order_type ?? row?.orderType ?? '')
    .trim()
    .toLowerCase();
  if (orderType === 'shop' || orderType === 'offline' || orderType === 'pos') {
    return false;
  }

  const integrationOrderId = pickIntegrationOrderId(row);
  if (integrationOrderId) return true;

  const integration = row?.integration_id ?? row?.integrationId;
  if (integration && typeof integration === 'object' && !Array.isArray(integration)) {
    return true;
  }

  return false;
};

/**
 * Queue POS → store push so website/Shopify status follows the local order status change.
 * Returns `{ queued: true }` or `{ queued: false, reason }`.
 */
export async function queueOrderPushToStore(orderRow, orderId, options = {}) {
  const id = String(orderId || '').trim();
  if (!id) return { queued: false, reason: 'missing_order_id' };
  if (!orderHasStoreIntegration(orderRow)) {
    return { queued: false, reason: 'not_store_order' };
  }

  const integrationId = pickOrderIntegrationId(orderRow);
  if (!integrationId) return { queued: false, reason: 'missing_integration_id' };

  const orderStatus = String(options?.orderStatus ?? options?.order_status ?? '').trim();
  await createPushOrderProcessRequest(integrationId, id, {
    order_status: orderStatus || undefined,
  });
  return { queued: true, integrationId };
}
