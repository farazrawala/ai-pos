/** Generate a valid EAN-13 barcode (12 random digits + check digit). */
export const generateBarcode = () => {
  let base = '';
  for (let i = 0; i < 12; i += 1) {
    base += Math.floor(Math.random() * 10);
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
};

export const parseVariationAttrs = (name) => {
  const match = String(name || '').match(/\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};

export const productIdFromRecord = (item) => sellablePosProductId(item);

/** Scalar Mongo/API id for POS cart + order_save (never parent_product_id). */
export function sellablePosProductId(item) {
  if (!item || typeof item !== 'object') return '';

  const unwrap = (raw) => {
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const nested = raw._id ?? raw.id ?? raw.$oid ?? raw.oid;
      if (nested != null && typeof nested !== 'object') {
        const s = String(nested).trim();
        return s && s !== '[object Object]' ? s : '';
      }
      return '';
    }
    const s = String(raw).trim();
    return s && s !== '[object Object]' ? s : '';
  };

  return unwrap(item._id) || unwrap(item.id) || unwrap(item.product_id);
}

/** Existing child product id for update payloads (omit temp `var_*` ids). */
export const variationProductIdFromRecord = (variation) => {
  const id = sellablePosProductId({
    _id: variation?.childProductId ?? variation?._id,
    id: variation?.id,
    product_id: variation?.product_id,
  });
  if (!id || id.startsWith('var_')) return '';
  return id;
};

const parentProductIdFromRecord = (item) => {
  const raw = item?.parent_product_id ?? item?.parentProductId;
  if (raw == null || raw === '') return '';
  const parentId =
    typeof raw === 'object' && !Array.isArray(raw)
      ? String(raw._id ?? raw.id ?? '').trim()
      : String(raw).trim();
  if (!parentId) return '';

  // Self-parent (parent_product_id === _id) is not a real parent — treat as root.
  const selfId = sellablePosProductId(item);
  if (selfId && parentId === selfId) return '';

  return parentId;
};

export { parentProductIdFromRecord };

const isSingleProductType = (item) => {
  const type = String(item?.product_type ?? item?.productType ?? 'Single').trim();
  return type.toLowerCase() === 'single';
};

/** True when status is not sellable for POS / order_save. */
export function isProductInactive(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.isActive === false || item.is_active === false) return true;
  const status = item.status ?? item.product_status;
  if (status === 0 || status === '0') return true;
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'inactive' || s === 'disabled' || s === 'deleted';
}

/** True for Variable parent SKUs (not sellable as a POS line — use a child variation). */
export function isVariableParentProduct(item) {
  if (!item || typeof item !== 'object') return false;
  const type = String(item.product_type ?? item.productType ?? '').trim().toLowerCase();
  if (type === 'variable') return true;

  const kids = item.childproducts ?? item.child_products ?? item.variations;
  if (Array.isArray(kids) && kids.length > 0 && type !== 'single') return true;

  return false;
}

/** Edit route id — single variants open their variable parent when linked. */
export const productEditIdFromRecord = (item) => {
  const productId = String(productIdFromRecord(item) || '').trim();
  if (!productId) return '';

  const parentId = parentProductIdFromRecord(item);
  if (isSingleProductType(item) && parentId && parentId !== productId) {
    return parentId;
  }

  return productId;
};
