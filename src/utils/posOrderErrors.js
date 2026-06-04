const isPopulatedRef = (ref) => ref && typeof ref === 'object' && !Array.isArray(ref);

const productNameFromRef = (ref) => {
  if (!isPopulatedRef(ref)) return '';
  return String(ref.product_name ?? ref.name ?? ref.product_slug ?? ref.sku ?? '').trim();
};

const productIdFromRef = (ref) => {
  if (!isPopulatedRef(ref)) return '';
  return String(ref._id ?? ref.id ?? '').trim();
};

/**
 * Pull product id/name from common API error payload shapes.
 * @param {unknown} json
 */
export function extractStockErrorProduct(json) {
  if (!json || typeof json !== 'object') {
    return { productId: '', productName: '' };
  }

  const blocks = [json, json.data, json.error, json.details].filter(
    (block) => block && typeof block === 'object' && !Array.isArray(block)
  );

  for (const block of blocks) {
    let productName = String(block.product_name ?? block.productName ?? block.name ?? '').trim();
    let productId = block.product_id ?? block.productId ?? block.product;

    if (isPopulatedRef(productId)) {
      productName = productName || productNameFromRef(productId);
      productId = productIdFromRef(productId);
    } else if (productId != null && typeof productId !== 'object') {
      productId = String(productId).trim();
    } else {
      productId = '';
    }

    if (isPopulatedRef(block.product)) {
      productName = productName || productNameFromRef(block.product);
      productId = productId || productIdFromRef(block.product);
    }

    if (productName || productId) {
      return { productId, productName };
    }
  }

  return { productId: '', productName: '' };
}

/**
 * @param {string} message
 * @param {unknown} [json]
 */
export function createOrderSaveError(message, json) {
  const { productId, productName } = extractStockErrorProduct(json);
  const err = new Error(String(message || 'Could not save order'));
  err.productId = productId;
  err.productName = productName;
  err.apiPayload = json && typeof json === 'object' ? json : null;
  return err;
}

const INSUFFICIENT_STOCK_RE =
  /insufficient product stock:\s*need\s*(\d+)\s*,\s*available\s*(\d+)/i;

/**
 * Include product name in insufficient-stock messages when known.
 * @param {string} message
 * @param {{ cartLines?: Array<{ productId?: string; name?: string }>; productId?: string; productName?: string }} [context]
 */
export function formatPosOrderErrorMessage(message, context = {}) {
  const raw = String(message || '').trim() || 'Could not save order';
  const cartLines = Array.isArray(context.cartLines) ? context.cartLines : [];

  let productName = String(context.productName ?? '').trim();
  const productId = String(context.productId ?? '').trim();

  if (!productName && productId) {
    const line = cartLines.find((l) => String(l?.productId ?? '') === productId);
    productName = String(line?.name ?? '').trim();
  }

  if (!productName && cartLines.length === 1) {
    productName = String(cartLines[0]?.name ?? '').trim();
  }

  if (!productName || raw.toLowerCase().includes(productName.toLowerCase())) {
    return raw;
  }

  const stockMatch = raw.match(INSUFFICIENT_STOCK_RE);
  if (stockMatch) {
    return `Insufficient product stock for "${productName}": need ${stockMatch[1]}, available ${stockMatch[2]}`;
  }

  if (/insufficient product stock/i.test(raw)) {
    return `${raw} — ${productName}`;
  }

  return raw;
}
