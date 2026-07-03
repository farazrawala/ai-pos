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

export const productIdFromRecord = (item) => item?._id || item?.id || item?.product_id || '';

/** Existing child product id for update payloads (omit temp `var_*` ids). */
export const variationProductIdFromRecord = (variation) => {
  const raw =
    variation?.childProductId ?? variation?._id ?? variation?.id ?? variation?.product_id;
  if (raw == null || raw === '') return '';
  const id = String(raw).trim();
  if (!id || id.startsWith('var_')) return '';
  return id;
};

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
