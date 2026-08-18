/**
 * Product import field schema, aliases, and auto-mapping.
 * Required flags follow Add Product form validation, optionally overlaid by GET /product/import-form.
 */

export const PRODUCT_IMPORT_UNITS = [
  'Piece',
  'Kg',
  'Ltr',
  'Box',
  'Meter',
  'Feet',
  'Yard',
  'Inch',
  'Centimeter',
  'Millimeter',
  'Others',
];

export const PRODUCT_IMPORT_TYPES = ['Single', 'Variable'];

/** Fields the uploaded file must never be allowed to set. */
export const BLOCKED_IMPORT_KEYS = new Set([
  'company_id',
  'companyid',
  'company',
  '_id',
  'id',
  'created_by',
  'createdby',
  'updated_by',
  'updatedby',
  'created_at',
  'createdat',
  'updated_at',
  'updatedat',
  'fetch_from_company_id',
  'fetchfromcompanyid',
  'fetch_from_product_id',
  'fetchfromproductid',
]);

const field = (spec) => spec;

/**
 * Importable product fields currently supported by the Add/Edit Product APIs.
 * `apiKey` is the frontend key expected by createProductRequest / updateProductRequest.
 */
export const PRODUCT_IMPORT_FIELDS = [
  field({
    key: 'name',
    apiKey: 'name',
    label: 'Name',
    type: 'string',
    required: true,
    aliases: [
      'name',
      'product name',
      'product_name',
      'productname',
      'title',
      'product title',
      'item name',
      'item',
    ],
  }),
  field({
    key: 'slug',
    apiKey: 'slug',
    label: 'Slug',
    type: 'string',
    aliases: ['slug', 'product slug', 'product_slug', 'handle', 'url slug'],
  }),
  field({
    key: 'description',
    apiKey: 'description',
    label: 'Description',
    type: 'string',
    aliases: [
      'description',
      'product description',
      'product_description',
      'body',
      'body html',
      'body (html)',
      'short description',
      'details',
    ],
  }),
  field({
    key: 'category',
    apiKey: 'categoryId',
    label: 'Category',
    type: 'lookup',
    lookup: 'category',
    aliases: [
      'category',
      'categories',
      'category name',
      'category_name',
      'category id',
      'category_id',
      'product category',
    ],
  }),
  field({
    key: 'brand',
    apiKey: 'brand_id',
    label: 'Brand',
    type: 'lookup',
    lookup: 'brand',
    aliases: ['brand', 'brand name', 'brand_name', 'brand id', 'brand_id', 'vendor', 'manufacturer'],
  }),
  field({
    key: 'product_type',
    apiKey: 'product_type',
    label: 'Product Type',
    type: 'enum',
    options: PRODUCT_IMPORT_TYPES,
    hasDefault: true,
    defaultValue: 'Single',
    aliases: ['product type', 'product_type', 'type', 'item type'],
  }),
  field({
    key: 'price_before_tax',
    apiKey: 'price_before_tax',
    label: 'Price before tax',
    type: 'number',
    aliases: ['price before tax', 'price_before_tax', 'net price', 'ex tax', 'price ex tax'],
  }),
  field({
    key: 'tax_rate',
    apiKey: 'tax_rate',
    label: 'Tax rate (%)',
    type: 'number',
    aliases: ['tax', 'tax rate', 'tax_rate', 'tax %', 'tax percent', 'vat', 'gst'],
  }),
  field({
    key: 'price',
    apiKey: 'price',
    label: 'Price',
    type: 'number',
    required: true,
    aliases: [
      'price',
      'sale price',
      'selling price',
      'retail price',
      'product price',
      'product_price',
      'regular price',
      'variant price',
      'unit price',
    ],
  }),
  field({
    key: 'wholesale_price',
    apiKey: 'wholesale_price',
    label: 'Wholesale Price',
    type: 'number',
    aliases: [
      'wholesale',
      'wholesale price',
      'wholesale_price',
      'purchase price',
      'cost',
      'cost price',
      'buying price',
      'cost of goods',
    ],
  }),
  field({
    key: 'alert_qty',
    apiKey: 'alert_qty',
    label: 'Alert Quantity',
    type: 'integer',
    aliases: ['alert', 'alert qty', 'alert_qty', 'alert quantity', 'reorder level', 'low stock'],
  }),
  field({
    key: 'stock',
    apiKey: 'stock',
    label: 'Stock',
    type: 'number',
    aliases: [
      'stock',
      'quantity',
      'qty',
      'inventory',
      'in stock',
      'total stock',
      'variant inventory qty',
      'inventory quantity',
    ],
  }),
  field({
    key: 'product_code',
    apiKey: 'product_code',
    label: 'Product Code',
    type: 'string',
    aliases: ['product code', 'product_code', 'code', 'item code'],
  }),
  field({
    key: 'sku',
    apiKey: 'sku',
    label: 'SKU',
    type: 'string',
    aliases: ['sku', 'product sku', 'item sku', 'variant sku', 'stock keeping unit'],
  }),
  field({
    key: 'barcode',
    apiKey: 'barcode',
    label: 'Barcode',
    type: 'string',
    aliases: ['barcode', 'ean', 'upc', 'gtin', 'isbn', 'variant barcode'],
  }),
  field({
    key: 'unit',
    apiKey: 'unit',
    label: 'Unit',
    type: 'enum',
    options: PRODUCT_IMPORT_UNITS,
    hasDefault: true,
    defaultValue: 'Piece',
    aliases: ['unit', 'uom', 'unit of measure'],
  }),
  field({
    key: 'weight',
    apiKey: 'weight',
    label: 'Weight',
    type: 'number',
    aliases: ['weight', 'weight (lbs)', 'weight (kg)'],
  }),
  field({
    key: 'length',
    apiKey: 'length',
    label: 'Length',
    type: 'number',
    aliases: ['length', 'length (in)'],
  }),
  field({
    key: 'width',
    apiKey: 'width',
    label: 'Width',
    type: 'number',
    aliases: ['width', 'width (in)'],
  }),
  field({
    key: 'height',
    apiKey: 'height',
    label: 'Height',
    type: 'number',
    aliases: ['height', 'height (in)'],
  }),
  field({
    key: 'dimension',
    apiKey: 'dimension',
    label: 'Dimension',
    type: 'string',
    aliases: ['dimension', 'dimensions', 'size'],
  }),
  field({
    key: 'status',
    apiKey: 'status',
    label: 'Status',
    type: 'enum',
    options: ['active', 'inactive'],
    hasDefault: true,
    defaultValue: 'active',
    aliases: ['status', 'published', 'active', 'visibility', 'is active'],
  }),
  field({
    key: 'image',
    apiKey: 'image',
    label: 'Image URL',
    type: 'string',
    aliases: ['image', 'images', 'image url', 'product image', 'photo', 'picture'],
  }),
];

export const SKIP_TARGET_KEY = '';

export function getFieldByKey(key, fields = PRODUCT_IMPORT_FIELDS) {
  return fields.find((f) => f.key === key) || null;
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[%#]/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[_./\\-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function aliasSet(fieldDef) {
  const values = [fieldDef.key, fieldDef.label, fieldDef.apiKey, ...(fieldDef.aliases || [])];
  return new Set(values.map(normalizeHeader).filter(Boolean));
}

function scoreHeaderAgainstField(normalizedHeader, fieldDef) {
  const aliases = aliasSet(fieldDef);
  if (aliases.has(normalizedHeader)) {
    return { confidence: 'high', score: 100 };
  }

  for (const alias of aliases) {
    if (!alias) continue;
    if (normalizedHeader === `${alias}s` || alias === `${normalizedHeader}s`) {
      return { confidence: 'high', score: 92 };
    }
  }

  let best = 0;
  for (const alias of aliases) {
    if (!alias || alias.length < 3) continue;
    if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
      const overlap = Math.min(alias.length, normalizedHeader.length) / Math.max(alias.length, normalizedHeader.length);
      best = Math.max(best, overlap);
    }
  }
  if (best >= 0.72) {
    return { confidence: 'medium', score: Math.round(60 + best * 30) };
  }

  const headerTokens = new Set(normalizedHeader.split(' ').filter((t) => t.length > 1));
  if (headerTokens.size === 0) return { confidence: 'none', score: 0 };
  let tokenBest = 0;
  for (const alias of aliases) {
    const aliasTokens = alias.split(' ').filter((t) => t.length > 1);
    if (aliasTokens.length === 0) continue;
    const hit = aliasTokens.filter((t) => headerTokens.has(t)).length;
    tokenBest = Math.max(tokenBest, hit / aliasTokens.length);
  }
  if (tokenBest >= 0.67) {
    return { confidence: 'medium', score: Math.round(50 + tokenBest * 25) };
  }

  return { confidence: 'none', score: 0 };
}

/**
 * Auto-map uploaded headers onto product fields. Each target is used at most once.
 */
export function autoMapColumns(headers, fields = PRODUCT_IMPORT_FIELDS) {
  const usedTargets = new Set();
  const candidates = [];

  headers.forEach((header, sourceIndex) => {
    const normalized = normalizeHeader(header);
    if (!normalized || BLOCKED_IMPORT_KEYS.has(normalized.replace(/\s+/g, ''))) {
      candidates.push({
        sourceIndex,
        sourceHeader: header,
        targetKey: SKIP_TARGET_KEY,
        confidence: 'none',
        score: 0,
        auto: false,
      });
      return;
    }

    let best = { targetKey: SKIP_TARGET_KEY, confidence: 'none', score: 0 };
    for (const fieldDef of fields) {
      const result = scoreHeaderAgainstField(normalized, fieldDef);
      if (result.score > best.score) {
        best = { targetKey: fieldDef.key, confidence: result.confidence, score: result.score };
      }
    }
    candidates.push({
      sourceIndex,
      sourceHeader: header,
      targetKey: best.score >= 50 ? best.targetKey : SKIP_TARGET_KEY,
      confidence: best.score >= 50 ? best.confidence : 'none',
      score: best.score,
      auto: best.score >= 50,
    });
  });

  candidates
    .filter((row) => row.targetKey)
    .sort((a, b) => b.score - a.score)
    .forEach((row) => {
      if (usedTargets.has(row.targetKey)) {
        row.targetKey = SKIP_TARGET_KEY;
        row.confidence = 'none';
        row.auto = false;
        row.score = 0;
        return;
      }
      usedTargets.add(row.targetKey);
    });

  return candidates.sort((a, b) => a.sourceIndex - b.sourceIndex);
}

export function mappedTargetKeys(mappings) {
  return new Set((mappings || []).map((row) => row.targetKey).filter(Boolean));
}

/**
 * Required mapping keys the user must confirm before continuing.
 * Unit / type have defaults so they are not blocking.
 */
export function getMissingRequiredMappings(mappings, fields = PRODUCT_IMPORT_FIELDS) {
  const mapped = mappedTargetKeys(mappings);
  const missing = [];
  for (const fieldDef of fields) {
    if (!fieldDef.required || fieldDef.hasDefault) continue;
    if (fieldDef.key === 'price' && (mapped.has('price') || mapped.has('price_before_tax'))) {
      continue;
    }
    if (!mapped.has(fieldDef.key)) missing.push(fieldDef);
  }
  return missing;
}

export function mergeBackendImportSchema(baseFields, schema) {
  const fields = baseFields.map((f) => ({ ...f, aliases: [...(f.aliases || [])] }));
  if (!schema || typeof schema !== 'object') return fields;

  const rawList = Array.isArray(schema)
    ? schema
    : Array.isArray(schema.fields)
      ? schema.fields
      : Array.isArray(schema.columns)
        ? schema.columns
        : Array.isArray(schema.data)
          ? schema.data
          : Array.isArray(schema?.data?.fields)
            ? schema.data.fields
            : [];

  if (rawList.length === 0) return fields;

  const byNorm = new Map();
  for (const fieldDef of fields) {
    byNorm.set(normalizeHeader(fieldDef.key), fieldDef);
    byNorm.set(normalizeHeader(fieldDef.apiKey), fieldDef);
    byNorm.set(normalizeHeader(fieldDef.label), fieldDef);
    (fieldDef.aliases || []).forEach((alias) => byNorm.set(normalizeHeader(alias), fieldDef));
  }

  rawList.forEach((entry) => {
    if (!entry) return;
    const key = String(entry.key ?? entry.name ?? entry.field ?? entry.column ?? '').trim();
    const label = String(entry.label ?? entry.title ?? key).trim();
    if (!key) return;
    const normalized = normalizeHeader(key);
    if (BLOCKED_IMPORT_KEYS.has(normalized.replace(/\s+/g, ''))) return;

    const existing = byNorm.get(normalized) || byNorm.get(normalizeHeader(label));
    const required = Boolean(entry.required || entry.is_required || entry.isRequired);
    if (existing) {
      if (required) existing.required = true;
      if (label && !existing.aliases.includes(label.toLowerCase())) {
        existing.aliases.push(label);
      }
      return;
    }
  });

  return fields;
}

export function buildSampleTemplateRows(fields = PRODUCT_IMPORT_FIELDS) {
  const headers = fields.map((f) => f.label);
  const sample = {
    name: 'Samsung TV',
    slug: 'samsung-tv',
    description: '55 inch 4K Smart TV',
    category: 'Electronics',
    brand: 'Samsung',
    product_type: 'Single',
    price_before_tax: '56522',
    tax_rate: '15',
    price: '65000',
    wholesale_price: '50000',
    alert_qty: '5',
    stock: '20',
    product_code: 'TV-55',
    sku: 'SAM-001',
    barcode: '1234567890123',
    unit: 'Piece',
    weight: '12.5',
    length: '123',
    width: '71',
    height: '8',
    dimension: '123x71x8',
    status: 'active',
    image: '',
  };
  const row = fields.map((f) => sample[f.key] ?? '');
  return { headers, rows: [row] };
}
