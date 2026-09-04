import {
  BLOCKED_IMPORT_KEYS,
  PRODUCT_IMPORT_FIELDS,
  PRODUCT_IMPORT_TYPES,
  PRODUCT_IMPORT_UNITS,
  getFieldByKey,
  mappedTargetKeys,
  normalizeHeader,
} from './productImportFields.js';

export const IMPORT_EXISTING_MODES = [
  { value: 'skip', label: 'Skip existing products' },
  { value: 'update', label: 'Update existing products' },
  { value: 'create_only', label: 'Create new products only' },
];

export const IMPORT_MATCH_MODES = [
  { value: 'sku', label: 'SKU' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'sku_then_barcode', label: 'SKU first, then Barcode' },
  { value: 'name', label: 'Name' },
];

export const IMPORT_DUPLICATE_NAME_MODES = [
  { value: 'skip', label: 'Yes, skip duplicate names' },
  { value: 'allow', label: 'No, import them anyway' },
];

export function generateProductSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseImportNumber(value) {
  if (value == null) return { empty: true };
  const raw = String(value).trim();
  if (raw === '') return { empty: true };
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return { invalid: true, raw };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { invalid: true, raw };
  return { value: n };
}

export function parseImportInteger(value) {
  const parsed = parseImportNumber(value);
  if (parsed.empty || parsed.invalid) return parsed;
  if (!Number.isInteger(parsed.value)) {
    return { value: Math.trunc(parsed.value) };
  }
  return parsed;
}

export function normalizeStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return { empty: true };
  if (['active', '1', 'true', 'yes', 'published', 'publish', 'enabled', 'on'].includes(raw)) {
    return { value: 'active' };
  }
  if (['inactive', '0', 'false', 'no', 'draft', 'unpublished', 'disabled', 'off', 'hidden'].includes(raw)) {
    return { value: 'inactive' };
  }
  return { invalid: true, raw: value };
}

export function normalizeProductType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return { empty: true };
  if (['single', 'simple', 'standard', 'product'].includes(raw)) return { value: 'Single' };
  if (['variable', 'variant', 'variation', 'variable product'].includes(raw)) return { value: 'Variable' };
  const match = PRODUCT_IMPORT_TYPES.find((item) => item.toLowerCase() === raw);
  if (match) return { value: match };
  return { invalid: true, raw: value };
}

export function normalizeUnit(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { empty: true };
  const match = PRODUCT_IMPORT_UNITS.find((item) => item.toLowerCase() === raw.toLowerCase());
  if (match) return { value: match };
  if (['pcs', 'pc', 'piece', 'pieces'].includes(raw.toLowerCase())) return { value: 'Piece' };
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(raw.toLowerCase())) return { value: 'Kg' };
  if (['ltr', 'liter', 'litre', 'liters', 'litres'].includes(raw.toLowerCase())) return { value: 'Ltr' };
  if (['doz', 'dozen', 'dz'].includes(raw.toLowerCase())) return { value: 'Dozen' };
  if (['roll', 'rolls'].includes(raw.toLowerCase())) return { value: 'Roll' };
  if (['box', 'boxes'].includes(raw.toLowerCase())) return { value: 'Box' };
  return { invalid: true, raw: value };
}

export function recordId(record) {
  return String(record?._id ?? record?.id ?? '').trim();
}

export function recordName(record, fallbackKeys = []) {
  for (const key of fallbackKeys) {
    const value = record?.[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

export function buildNameLookup(records, nameKeys) {
  const byId = new Map();
  const byName = new Map();
  (records || []).forEach((record) => {
    const id = recordId(record);
    if (id) byId.set(id.toLowerCase(), record);
    for (const key of nameKeys) {
      const name = record?.[key];
      if (name == null || String(name).trim() === '') continue;
      const normalized = normalizeHeader(name);
      if (normalized && !byName.has(normalized)) byName.set(normalized, record);
    }
  });
  return { byId, byName };
}

export function resolveLookupValue(rawValue, lookup) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { empty: true };
  const parts = raw.split(/>|,/).map((part) => part.trim()).filter(Boolean);
  const candidates = [raw, ...parts.slice().reverse(), ...parts];
  for (const candidate of candidates) {
    const idHit = lookup.byId.get(candidate.toLowerCase());
    if (idHit) {
      return {
        matched: true,
        id: recordId(idHit),
        label: recordName(idHit, ['name', 'category_name', 'brand_name']) || candidate,
        raw,
      };
    }
    const nameHit = lookup.byName.get(normalizeHeader(candidate));
    if (nameHit) {
      return {
        matched: true,
        id: recordId(nameHit),
        label: recordName(nameHit, ['name', 'category_name', 'brand_name']) || candidate,
        raw,
      };
    }
  }
  return { matched: false, raw, label: parts[parts.length - 1] || raw };
}

export function mapRowValues(row, mappings) {
  const values = {};
  (mappings || []).forEach((mapping) => {
    if (!mapping.targetKey) return;
    values[mapping.targetKey] = row[mapping.sourceIndex] ?? '';
  });
  return values;
}

function existingKey(product, field) {
  const value = product?.[field];
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function existingNameKey(product) {
  const name = product?.name ?? product?.product_name;
  if (name == null) return '';
  return String(name).trim().toLowerCase();
}

export function indexExistingProducts(products) {
  const bySku = new Map();
  const byBarcode = new Map();
  const byName = new Map();
  (products || []).forEach((product) => {
    const sku = existingKey(product, 'sku');
    if (sku && !bySku.has(sku)) bySku.set(sku, product);
    const barcode = existingKey(product, 'barcode');
    if (barcode && !byBarcode.has(barcode)) byBarcode.set(barcode, product);
    const name = existingNameKey(product);
    if (name && !byName.has(name)) byName.set(name, product);
  });
  return { bySku, byBarcode, byName };
}

export function findExistingProduct(values, index, matchBy) {
  const sku = String(values.sku ?? '').trim().toLowerCase();
  const barcode = String(values.barcode ?? '').trim().toLowerCase();
  const name = String(values.name ?? '').trim().toLowerCase();
  if (matchBy === 'barcode') {
    return barcode ? index.byBarcode.get(barcode) || null : null;
  }
  if (matchBy === 'name') {
    return name ? index.byName.get(name) || null : null;
  }
  if (matchBy === 'sku_then_barcode') {
    return (sku && index.bySku.get(sku)) || (barcode && index.byBarcode.get(barcode)) || null;
  }
  return sku ? index.bySku.get(sku) || null : null;
}

export function parseCategoryCell(raw) {
  return String(raw ?? '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => ({
      raw: group,
      parts: group
        .split(/>/)
        .map((part) => part.trim())
        .filter(Boolean),
    }))
    .filter((group) => group.parts.length > 0);
}

export function collectCategorySegments(rawRows, mappings) {
  const mapping = (mappings || []).find((row) => row.targetKey === 'category');
  if (!mapping) return [];
  const byKey = new Map();
  (rawRows || []).forEach((row) => {
    parseCategoryCell(row?.[mapping.sourceIndex]).forEach((path) => {
      path.parts.forEach((part, index) => {
        const key = normalizeHeader(part);
        if (!key) return;
        const depth = index + 1;
        const current = byKey.get(key);
        if (!current || depth < current.depth) {
          byKey.set(key, {
            name: part,
            parentName: index > 0 ? path.parts[index - 1] : '',
            depth,
          });
        }
      });
    });
  });
  return [...byKey.values()].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
}

export function splitCategoryPlan(segments, existingCategories) {
  const lookup = buildNameLookup(existingCategories, ['name', 'category_name']);
  const existing = [];
  const missing = [];
  (segments || []).forEach((segment) => {
    if (lookup.byName.has(normalizeHeader(segment.name))) existing.push(segment);
    else missing.push(segment);
  });
  return { existing, missing, total: (segments || []).length };
}

export function uniqueCategorySlug(name, usedSlugs) {
  const used = usedSlugs instanceof Set ? usedSlugs : new Set();
  const base = generateProductSlug(name) || 'category';
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

export function pickCreatedCategory(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    if (result.data.category != null && typeof result.data.category === 'object') {
      return result.data.category;
    }
    return result.data;
  }
  if (result.category != null && typeof result.category === 'object') return result.category;
  if (result._id || result.id || result.category_id) return result;
  return null;
}

export function applyCategoryLookupToRows(rows, lookup) {
  return (rows || []).map((row) => {
    const raw = row.values?.category;
    if (!raw) return row;
    const resolved = resolveLookupValue(raw, lookup);
    if (!resolved.matched) return row;
    const warnings = (row.warnings || []).filter(
      (msg) => !/category not found/i.test(msg) && !/category will be created/i.test(msg)
    );
    let status = row.status;
    if (status === 'warning' && warnings.length === 0 && row.action !== 'skip' && (row.errors || []).length === 0) {
      status = 'ready';
    }
    return {
      ...row,
      warnings,
      status,
      values: {
        ...row.values,
        categoryId: [resolved.id],
        categoryLabel: resolved.label,
        categoryMatch: 'matched',
      },
    };
  });
}

function applyResolution(unmatched, resolutions, kind) {
  const key = String(unmatched.raw || '').trim().toLowerCase();
  return resolutions?.[kind]?.[key] || null;
}

function coerceFieldValue(fieldDef, raw) {
  if (!fieldDef) return { value: raw };
  if (fieldDef.type === 'number') return parseImportNumber(raw);
  if (fieldDef.type === 'integer') return parseImportInteger(raw);
  if (fieldDef.key === 'status') return normalizeStatus(raw);
  if (fieldDef.key === 'product_type') return normalizeProductType(raw);
  if (fieldDef.key === 'unit') return normalizeUnit(raw);
  const text = String(raw ?? '').trim();
  if (!text) return { empty: true };
  return { value: text };
}

export function stripTenantOverrideFields(payload) {
  const next = { ...payload };
  Object.keys(next).forEach((key) => {
    const normalized = normalizeHeader(key).replace(/\s+/g, '');
    if (BLOCKED_IMPORT_KEYS.has(normalized) || BLOCKED_IMPORT_KEYS.has(key.toLowerCase())) {
      delete next[key];
    }
  });
  return next;
}

export function buildCreatePayload(values, options = {}) {
  const name = String(values.name ?? '').trim();
  const taxRate = values.tax_rate;
  const beforeTax = values.price_before_tax;
  let price = values.price;
  if ((price == null || price === '') && beforeTax != null && Number.isFinite(Number(beforeTax))) {
    const rate = Number.isFinite(Number(taxRate)) ? Number(taxRate) : 0;
    price = Math.round(Number(beforeTax) * (1 + rate / 100) * 100) / 100;
  }

  const payload = {
    name,
    price: Number(price),
    unit: values.unit || 'Piece',
    product_type: values.product_type || 'Single',
    status: values.status || 'active',
  };

  const slug = String(values.slug ?? '').trim() || generateProductSlug(name);
  if (slug) payload.slug = slug;
  if (values.description) payload.description = String(values.description).trim();
  if (values.sku) payload.sku = String(values.sku).trim();
  if (values.barcode) payload.barcode = String(values.barcode).trim();
  if (values.product_code) payload.product_code = String(values.product_code).trim();
  if (values.dimension) payload.dimension = String(values.dimension).trim();
  if (values.categoryId) {
    payload.categoryId = Array.isArray(values.categoryId) ? values.categoryId : [values.categoryId];
  } else {
    payload.categoryId = [];
  }
  if (values.brand_id) payload.brand_id = values.brand_id;
  if (beforeTax != null && beforeTax !== '') payload.price_before_tax = Number(beforeTax);
  else payload.price_before_tax = 0;
  if (taxRate != null && taxRate !== '') payload.tax_rate = Number(taxRate);
  if (values.wholesale_price != null && values.wholesale_price !== '') {
    payload.wholesale_price = Number(values.wholesale_price);
  }
  if (values.alert_qty != null && values.alert_qty !== '') payload.alert_qty = Number(values.alert_qty);
  if (values.stock != null && values.stock !== '') payload.stock = Number(values.stock);
  ['weight', 'length', 'width', 'height'].forEach((key) => {
    if (values[key] != null && values[key] !== '') payload[key] = Number(values[key]);
  });

  const images = [];
  if (values.image) {
    const first = String(values.image).split(',')[0].trim();
    if (/^https?:\/\//i.test(first)) images.push(first);
  }

  return {
    productData: stripTenantOverrideFields(payload),
    images,
    existingId: options.existingId || '',
  };
}

export function buildUpdatePayload(values, mappedKeys) {
  const mapped = mappedKeys instanceof Set ? mappedKeys : new Set(mappedKeys || []);
  const { productData, images, existingId } = buildCreatePayload(values);
  const update = {};
  const allow = new Set(
    [...mapped].map((key) => {
      if (key === 'category') return 'categoryId';
      if (key === 'brand') return 'brand_id';
      if (key === 'image') return 'image';
      return key;
    })
  );
  allow.add('name');
  if (mapped.has('price') || mapped.has('price_before_tax') || mapped.has('tax_rate')) {
    allow.add('price');
    allow.add('price_before_tax');
    allow.add('tax_rate');
  }
  Object.entries(productData).forEach(([key, value]) => {
    if (allow.has(key)) update[key] = value;
  });
  if (!mapped.has('slug')) delete update.slug;
  if (!mapped.has('unit')) delete update.unit;
  if (!mapped.has('product_type')) delete update.product_type;
  if (!mapped.has('status')) delete update.status;
  return { productData: stripTenantOverrideFields(update), images, existingId };
}

function beginImportValidation({
  mappings,
  fields = PRODUCT_IMPORT_FIELDS,
  existingProducts = [],
  categories = [],
  brands = [],
  resolutions = { category: {}, brand: {} },
  options = {},
}) {
  return {
    mappings,
    fields,
    resolutions,
    existingMode: options.existingMode || 'skip',
    matchBy: options.matchBy || 'sku_then_barcode',
    skipDuplicateNames: options.skipDuplicateNames !== false,
    createMissingCategories: options.createMissingCategories !== false,
    mappedKeys: mappedTargetKeys(mappings),
    categoryLookup: buildNameLookup(categories, ['name', 'category_name']),
    brandLookup: buildNameLookup(brands, ['name', 'brand_name']),
    existingIndex: indexExistingProducts(existingProducts),
    fileSkus: new Map(),
    fileBarcodes: new Map(),
    fileNames: new Map(),
    unmatchedCategories: new Map(),
    unmatchedBrands: new Map(),
    resultRows: [],
  };
}

function finishImportValidation(ctx) {
  const resultRows = ctx.resultRows;
  const summary = {
    total: resultRows.length,
    ready: resultRows.filter((row) => row.status === 'ready' || row.status === 'warning').length,
    warnings: resultRows.filter((row) => row.status === 'warning').length,
    errors: resultRows.filter((row) => row.status === 'error').length,
    skipped: resultRows.filter((row) => row.status === 'skip').length,
    create: resultRows.filter((row) => (row.status === 'ready' || row.status === 'warning') && row.action === 'create')
      .length,
    update: resultRows.filter((row) => (row.status === 'ready' || row.status === 'warning') && row.action === 'update')
      .length,
  };
  return {
    rows: resultRows,
    summary,
    unmatchedCategories: [...ctx.unmatchedCategories.values()],
    unmatchedBrands: [...ctx.unmatchedBrands.values()],
    mappedKeys: ctx.mappedKeys,
  };
}

function validateOneImportRow(row, index, ctx) {
  const {
    mappings,
    fields,
    resolutions,
    existingMode,
    matchBy,
    skipDuplicateNames,
    createMissingCategories,
    mappedKeys,
    categoryLookup,
    brandLookup,
    existingIndex,
    fileSkus,
    fileBarcodes,
    fileNames,
    unmatchedCategories,
    unmatchedBrands,
  } = ctx;
    const rowNumber = index + 2;
    const rawValues = mapRowValues(row, mappings);
    const errors = [];
    const warnings = [];
    const values = { ...rawValues };

    const nameParsed = coerceFieldValue(getFieldByKey('name', fields), rawValues.name);
    if (nameParsed.empty || !nameParsed.value) errors.push('Name is required');
    else values.name = nameParsed.value;

    ['sku', 'barcode', 'product_code', 'description', 'slug', 'dimension', 'image'].forEach((key) => {
      if (!mappedKeys.has(key)) return;
      const parsed = coerceFieldValue(getFieldByKey(key, fields), rawValues[key]);
      values[key] = parsed.empty ? '' : parsed.value || String(rawValues[key] || '').trim();
    });

    const sku = String(values.sku || '').trim().toLowerCase();
    if (sku) {
      if (fileSkus.has(sku)) errors.push(`Duplicate SKU in file (also row ${fileSkus.get(sku)})`);
      else fileSkus.set(sku, rowNumber);
    }
    const barcode = String(values.barcode || '').trim().toLowerCase();
    if (barcode) {
      if (fileBarcodes.has(barcode)) {
        errors.push(`Duplicate barcode in file (also row ${fileBarcodes.get(barcode)})`);
      } else fileBarcodes.set(barcode, rowNumber);
    }

    const numericKeys = [
      'price',
      'price_before_tax',
      'wholesale_price',
      'tax_rate',
      'stock',
      'alert_qty',
      'weight',
      'length',
      'width',
      'height',
    ];
    numericKeys.forEach((key) => {
      if (!mappedKeys.has(key) && key !== 'price') return;
      if (key === 'price' && !mappedKeys.has('price')) return;
      const fieldDef = getFieldByKey(key, fields);
      const parsed = coerceFieldValue(fieldDef, rawValues[key]);
      if (parsed.empty) {
        values[key] = '';
        return;
      }
      if (parsed.invalid) {
        errors.push(`${fieldDef?.label || key} must be a valid number`);
        return;
      }
      if ((key === 'price' || key === 'wholesale_price' || key === 'stock' || key === 'alert_qty') && parsed.value < 0) {
        errors.push(`${fieldDef?.label || key} cannot be negative`);
        return;
      }
      if (key === 'tax_rate' && (parsed.value < 0 || parsed.value > 100)) {
        errors.push('Tax rate must be between 0 and 100');
        return;
      }
      values[key] = parsed.value;
    });

    if (mappedKeys.has('price')) {
      if (values.price === '' || values.price == null) values.price = 0;
      else if (Number(values.price) < 0) errors.push('Retail price cannot be negative');
    } else if (mappedKeys.has('price_before_tax')) {
      if (values.price_before_tax === '' || values.price_before_tax == null) {
        values.price = 0;
        values.price_before_tax = 0;
      } else {
        const rate = Number.isFinite(Number(values.tax_rate)) ? Number(values.tax_rate) : 0;
        values.price = Math.round(Number(values.price_before_tax) * (1 + rate / 100) * 100) / 100;
        if (!Number.isFinite(Number(values.price)) || Number(values.price) < 0) {
          errors.push('Valid retail price is required');
        }
      }
    } else {
      errors.push('Valid retail price is required');
    }

    if (mappedKeys.has('unit')) {
      const parsed = normalizeUnit(rawValues.unit);
      if (parsed.invalid) errors.push('Unit is not valid');
      else values.unit = parsed.empty ? 'Piece' : parsed.value;
    } else {
      values.unit = 'Piece';
    }

    if (mappedKeys.has('product_type')) {
      const parsed = normalizeProductType(rawValues.product_type);
      if (parsed.invalid) errors.push('Product type must be Single or Variable');
      else values.product_type = parsed.empty ? 'Single' : parsed.value;
    } else {
      values.product_type = 'Single';
    }

    if (mappedKeys.has('status')) {
      const parsed = normalizeStatus(rawValues.status);
      if (parsed.invalid) errors.push('Status must be Active or Inactive');
      else values.status = parsed.empty ? 'active' : parsed.value;
    } else {
      values.status = 'active';
    }

    if (mappedKeys.has('category')) {
      const resolved = resolveLookupValue(rawValues.category, categoryLookup);
      if (resolved.empty) {
        values.categoryId = undefined;
      } else if (resolved.matched) {
        values.categoryId = [resolved.id];
        values.categoryLabel = resolved.label;
        values.categoryMatch = 'matched';
      } else {
        const resolution = applyResolution(resolved, resolutions, 'category');
        if (resolution?.action === 'map' && resolution.id) {
          values.categoryId = [resolution.id];
          values.categoryLabel = resolution.label || resolved.raw;
          values.categoryMatch = 'mapped';
        } else if (resolution?.action === 'create' && resolution.id) {
          values.categoryId = [resolution.id];
          values.categoryLabel = resolution.label || resolved.raw;
          values.categoryMatch = 'created';
        } else if (resolution?.action === 'skip_row') {
          errors.push(`Category not found: ${resolved.raw}`);
          values.categoryMatch = 'missing';
        } else if (resolution?.action === 'skip_value') {
          warnings.push(`Category not found: ${resolved.raw} (value skipped)`);
          values.categoryMatch = 'skipped';
        } else {
          unmatchedCategories.set(String(resolved.raw).trim().toLowerCase(), resolved);
          if (createMissingCategories) {
            warnings.push(`Category will be created first: ${resolved.raw}`);
            values.categoryMatch = 'pending_create';
          } else {
            warnings.push(`Category not found: ${resolved.raw}`);
            values.categoryMatch = 'missing';
          }
        }
      }
    }

    if (mappedKeys.has('brand')) {
      const resolved = resolveLookupValue(rawValues.brand, brandLookup);
      if (resolved.empty) {
        values.brand_id = undefined;
      } else if (resolved.matched) {
        values.brand_id = resolved.id;
        values.brandLabel = resolved.label;
        values.brandMatch = 'matched';
      } else {
        const resolution = applyResolution(resolved, resolutions, 'brand');
        if (resolution?.action === 'map' && resolution.id) {
          values.brand_id = resolution.id;
          values.brandLabel = resolution.label || resolved.raw;
          values.brandMatch = 'mapped';
        } else if (resolution?.action === 'create' && resolution.id) {
          values.brand_id = resolution.id;
          values.brandLabel = resolution.label || resolved.raw;
          values.brandMatch = 'created';
        } else if (resolution?.action === 'skip_row') {
          errors.push(`Brand not found: ${resolved.raw}`);
          values.brandMatch = 'missing';
        } else if (resolution?.action === 'skip_value') {
          warnings.push(`Brand not found: ${resolved.raw} (value skipped)`);
          values.brandMatch = 'skipped';
        } else {
          unmatchedBrands.set(String(resolved.raw).trim().toLowerCase(), resolved);
          warnings.push(`Brand not found: ${resolved.raw}`);
          values.brandMatch = 'missing';
        }
      }
    }

    if (mappedKeys.has('image') && values.image && !/^https?:\/\//i.test(String(values.image).split(',')[0].trim())) {
      warnings.push('Image is not a URL and will be skipped');
      values.image = '';
    }

    const existing = findExistingProduct(values, existingIndex, matchBy);
    let action = 'create';
    if (existing) {
      if (existingMode === 'update') {
        action = 'update';
        values.existingId = recordId(existing);
        values.existingName = existing.name || existing.product_name || values.name;
      } else {
        action = 'skip';
        values.existingId = recordId(existing);
        warnings.push('Matches an existing product and will be skipped');
      }
    }

    const nameKey = String(values.name || '').trim().toLowerCase();
    if (action === 'create' && skipDuplicateNames && nameKey) {
      if (fileNames.has(nameKey)) {
        action = 'skip';
        warnings.push(`Duplicate name in file (also row ${fileNames.get(nameKey)}) and will be skipped`);
      } else if (existingIndex.byName.has(nameKey)) {
        const named = existingIndex.byName.get(nameKey);
        action = 'skip';
        values.existingId = recordId(named);
        warnings.push('Duplicate name already exists and will be skipped');
      }
    }
    if (nameKey && !fileNames.has(nameKey)) fileNames.set(nameKey, rowNumber);

    let status = 'ready';
    if (errors.length > 0) status = 'error';
    else if (action === 'skip') status = 'skip';
    else if (warnings.length > 0) status = 'warning';

    return {
      rowNumber,
      raw: row,
      values,
      errors,
      warnings,
      status,
      action,
    };
}

export function validateImportRows(params) {
  const ctx = beginImportValidation(params);
  (params.rows || []).forEach((row, index) => {
    ctx.resultRows.push(validateOneImportRow(row, index, ctx));
  });
  return finishImportValidation(ctx);
}

export async function validateImportRowsAsync(params, { chunkSize = 400, onProgress } = {}) {
  const ctx = beginImportValidation(params);
  const rows = params.rows || [];
  const size = Math.max(50, Number(chunkSize) || 400);
  for (let i = 0; i < rows.length; i += size) {
    const end = Math.min(rows.length, i + size);
    for (let index = i; index < end; index += 1) {
      ctx.resultRows.push(validateOneImportRow(rows[index], index, ctx));
    }
    onProgress?.(end, rows.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return finishImportValidation(ctx);
}

export function rowsReadyToImport(validatedRows) {
  return (validatedRows || []).filter(
    (row) => (row.status === 'ready' || row.status === 'warning') && (row.action === 'create' || row.action === 'update')
  );
}

export function chunkItems(items, size) {
  const chunks = [];
  const n = Math.max(1, Number(size) || 100);
  for (let i = 0; i < items.length; i += n) chunks.push(items.slice(i, i + n));
  return chunks;
}

export async function runWithConcurrency(items, concurrency, worker, onItem) {
  const limit = Math.max(1, Number(concurrency) || 1);
  let cursor = 0;
  const results = new Array(items.length);

  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    try {
      const value = await worker(items[index], index);
      results[index] = { ok: true, value };
      onItem?.(items[index], { ok: true, value }, index);
    } catch (error) {
      results[index] = { ok: false, error };
      onItem?.(items[index], { ok: false, error }, index);
    }
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}
