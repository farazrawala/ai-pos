/**
 * Normalize a store / admin URL for comparison (host + path, no trailing slash).
 */
export const normalizeStoreUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
};

/**
 * Extract an external product id from a store admin / product URL.
 * Supports WordPress/WooCommerce (?post=231) and Shopify (/admin/products/123).
 */
export const extractExternalProductIdFromUrl = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  if (/^\d+$/.test(value)) return value;

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);

    const postId = parsed.searchParams.get('post');
    if (postId && /^\d+$/.test(postId)) return postId;

    const idParam = parsed.searchParams.get('id');
    if (idParam && /^\d+$/.test(idParam)) return idParam;

    const shopifyMatch = parsed.pathname.match(/\/products\/(\d+)/i);
    if (shopifyMatch?.[1]) return shopifyMatch[1];

    const productIdMatch = parsed.pathname.match(/\/product(?:s)?\/(?:edit\/)?(\d+)/i);
    if (productIdMatch?.[1]) return productIdMatch[1];
  } catch {
    // fall through
  }

  const postMatch = value.match(/[?&]post=(\d+)/i);
  if (postMatch?.[1]) return postMatch[1];

  const productsMatch = value.match(/\/products\/(\d+)/i);
  if (productsMatch?.[1]) return productsMatch[1];

  return '';
};

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

/**
 * Find the best matching integration for a pasted store URL by domain/path.
 * Prefers the longest path match (e.g. /testing2 over /testing1 on same host).
 */
export const matchIntegrationFromUrl = (rawUrl, integrations = []) => {
  const pasted = normalizeStoreUrl(rawUrl);
  if (!pasted || !Array.isArray(integrations) || integrations.length === 0) {
    return null;
  }

  let best = null;
  let bestScore = -1;

  for (const integration of integrations) {
    const storeUrl = integration?.url || integration?.store_url || '';
    const normalized = normalizeStoreUrl(storeUrl);
    if (!normalized) continue;

    const matches =
      pasted === normalized ||
      pasted.startsWith(`${normalized}/`) ||
      pasted.startsWith(normalized) ||
      normalized.startsWith(pasted);

    if (!matches) continue;

    const score = normalized.length;
    if (score > bestScore) {
      bestScore = score;
      best = integration;
    }
  }

  return best
    ? {
        integration: best,
        integrationId: String(integrationIdFromRecord(best) || ''),
      }
    : null;
};

/**
 * Parse a pasted store product URL into integration + external product id.
 */
export const parseStoreProductLink = (rawUrl, integrations = []) => {
  const url = String(rawUrl || '').trim();
  const externalProductId = extractExternalProductIdFromUrl(url);
  const matched = matchIntegrationFromUrl(url, integrations);

  return {
    url,
    externalProductId,
    integration: matched?.integration || null,
    integrationId: matched?.integrationId || '',
  };
};
