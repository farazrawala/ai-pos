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
 * Extract Shopify store handle from admin.shopify.com or *.myshopify.com URLs.
 * e.g. admin.shopify.com/store/my-shop/... → my-shop
 *      my-shop.myshopify.com → my-shop
 */
export const extractShopifyStoreHandle = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'admin.shopify.com') {
      const match = parsed.pathname.match(/^\/store\/([^/]+)/i);
      return match?.[1]?.toLowerCase() || '';
    }

    const myshopifyMatch = host.match(/^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/i);
    if (myshopifyMatch?.[1]) return myshopifyMatch[1].toLowerCase();
  } catch {
    // fall through
  }

  const adminMatch = value.match(/admin\.shopify\.com\/store\/([^/?#]+)/i);
  if (adminMatch?.[1]) return adminMatch[1].toLowerCase();

  const myshopifyMatch = value.match(/([a-z0-9][a-z0-9-]*)\.myshopify\.com/i);
  if (myshopifyMatch?.[1]) return myshopifyMatch[1].toLowerCase();

  return '';
};

/**
 * Parse product / variant ids from a store URL.
 * Shopify variants become productId:variantId (matches sync_product refference_id).
 */
export const extractExternalIdsFromUrl = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return { productId: '', variantId: '', referenceId: '' };
  }

  if (/^\d+:\d+$/.test(value)) {
    const [productId, variantId] = value.split(':');
    return { productId, variantId, referenceId: value };
  }

  if (/^\d+$/.test(value)) {
    return { productId: value, variantId: '', referenceId: value };
  }

  let productId = '';
  let variantId = '';

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);

    const postId = parsed.searchParams.get('post');
    if (postId && /^\d+$/.test(postId)) {
      productId = postId;
    }

    const idParam = parsed.searchParams.get('id');
    if (!productId && idParam && /^\d+$/.test(idParam)) {
      productId = idParam;
    }

    const shopifyVariantMatch = parsed.pathname.match(/\/products\/(\d+)\/variants\/(\d+)/i);
    if (shopifyVariantMatch) {
      productId = shopifyVariantMatch[1];
      variantId = shopifyVariantMatch[2];
    } else {
      const shopifyProductMatch = parsed.pathname.match(/\/products\/(\d+)/i);
      if (shopifyProductMatch?.[1]) {
        productId = shopifyProductMatch[1];
      } else {
        const productIdMatch = parsed.pathname.match(/\/product(?:s)?\/(?:edit\/)?(\d+)/i);
        if (productIdMatch?.[1]) productId = productIdMatch[1];
      }

      const variantQuery = parsed.searchParams.get('variant');
      if (variantQuery && /^\d+$/.test(variantQuery)) {
        variantId = variantQuery;
      }
    }
  } catch {
    // fall through to regex
  }

  if (!productId) {
    const postMatch = value.match(/[?&]post=(\d+)/i);
    if (postMatch?.[1]) productId = postMatch[1];
  }

  if (!productId || !variantId) {
    const pathVariantMatch = value.match(/\/products\/(\d+)\/variants\/(\d+)/i);
    if (pathVariantMatch) {
      productId = productId || pathVariantMatch[1];
      variantId = variantId || pathVariantMatch[2];
    }
  }

  if (!productId) {
    const productsMatch = value.match(/\/products\/(\d+)/i);
    if (productsMatch?.[1]) productId = productsMatch[1];
  }

  if (!variantId) {
    const variantQueryMatch = value.match(/[?&]variant=(\d+)/i);
    if (variantQueryMatch?.[1]) variantId = variantQueryMatch[1];
  }

  const referenceId =
    productId && variantId ? `${productId}:${variantId}` : productId || '';

  return { productId, variantId, referenceId };
};

/**
 * Extract an external product / reference id from a store admin / product URL.
 * Supports WordPress (?post=231), Shopify product, and Shopify variant URLs.
 */
export const extractExternalProductIdFromUrl = (rawUrl) =>
  extractExternalIdsFromUrl(rawUrl).referenceId;

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

/**
 * Find the best matching integration for a pasted store URL by domain/path.
 * Prefers the longest path match (e.g. /testing2 over /testing1 on same host).
 * Also matches Shopify admin.shopify.com ↔ *.myshopify.com by store handle.
 */
export const matchIntegrationFromUrl = (rawUrl, integrations = []) => {
  const pasted = normalizeStoreUrl(rawUrl);
  if (!pasted || !Array.isArray(integrations) || integrations.length === 0) {
    return null;
  }

  const pastedShopifyHandle = extractShopifyStoreHandle(rawUrl);

  let best = null;
  let bestScore = -1;

  for (const integration of integrations) {
    const storeUrl = integration?.url || integration?.store_url || '';
    const normalized = normalizeStoreUrl(storeUrl);
    if (!normalized && !storeUrl) continue;

    let score = -1;

    if (normalized) {
      const matches =
        pasted === normalized ||
        pasted.startsWith(`${normalized}/`) ||
        pasted.startsWith(normalized) ||
        normalized.startsWith(pasted);

      if (matches) score = normalized.length;
    }

    if (score < 0 && pastedShopifyHandle) {
      const integrationHandle = extractShopifyStoreHandle(storeUrl);
      if (integrationHandle && integrationHandle === pastedShopifyHandle) {
        score = 1000 + integrationHandle.length;
      }
    }

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
 * Parse a pasted store product URL into integration + external reference id.
 */
export const parseStoreProductLink = (rawUrl, integrations = []) => {
  const url = String(rawUrl || '').trim();
  const ids = extractExternalIdsFromUrl(url);
  const matched = matchIntegrationFromUrl(url, integrations);

  return {
    url,
    productId: ids.productId,
    variantId: ids.variantId,
    externalProductId: ids.referenceId,
    integration: matched?.integration || null,
    integrationId: matched?.integrationId || '',
  };
};
