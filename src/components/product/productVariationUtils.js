export const parseVariationAttrs = (name) => {
  const match = String(name || '').match(/\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};

export const productIdFromRecord = (item) => item?._id || item?.id || item?.product_id || '';

const parentProductIdFromRecord = (item) => {
  const raw = item?.parent_product_id ?? item?.parentProductId;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return String(raw._id ?? raw.id ?? '').trim();
  }
  return String(raw).trim();
};

const isSingleProductType = (item) => {
  const type = String(item?.product_type ?? item?.productType ?? 'Single').trim();
  return type.toLowerCase() === 'single';
};

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
