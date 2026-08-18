import { describe, expect, it } from 'vitest';
import {
  autoMapColumns,
  getMissingRequiredMappings,
  mergeBackendImportSchema,
  normalizeHeader,
  PRODUCT_IMPORT_FIELDS,
} from './productImportFields.js';
import { parseCsvText } from './productImportParse.js';
import {
  applyCategoryLookupToRows,
  buildCreatePayload,
  buildNameLookup,
  collectCategorySegments,
  generateProductSlug,
  resolveLookupValue,
  splitCategoryPlan,
  stripTenantOverrideFields,
  validateImportRows,
} from './productImportEngine.js';

describe('product import mapping', () => {
  it('normalizes headers for alias matching', () => {
    expect(normalizeHeader('Product Name')).toBe('product name');
    expect(normalizeHeader('Sale-Price (%)')).toBe('sale price');
  });

  it('auto-maps common WooCommerce and POS aliases', () => {
    const mappings = autoMapColumns([
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Purchase Price',
      'Sale Price',
      'Stock',
      'Random Column',
    ]);
    const byHeader = Object.fromEntries(mappings.map((row) => [row.sourceHeader, row]));
    expect(byHeader['Product Name'].targetKey).toBe('name');
    expect(byHeader['Product Name'].confidence).toBe('high');
    expect(byHeader.SKU.targetKey).toBe('sku');
    expect(byHeader.Barcode.targetKey).toBe('barcode');
    expect(byHeader.Category.targetKey).toBe('category');
    expect(byHeader['Purchase Price'].targetKey).toBe('wholesale_price');
    expect(byHeader['Sale Price'].targetKey).toBe('price');
    expect(byHeader.Stock.targetKey).toBe('stock');
    expect(byHeader['Random Column'].targetKey).toBe('');
    expect(byHeader['Random Column'].confidence).toBe('none');
  });

  it('does not assign the same target twice', () => {
    const mappings = autoMapColumns(['Name', 'Product Name', 'Title']);
    const mapped = mappings.filter((row) => row.targetKey === 'name');
    expect(mapped).toHaveLength(1);
  });

  it('requires name and price mappings', () => {
    const mappings = autoMapColumns(['SKU', 'Stock']);
    const missing = getMissingRequiredMappings(mappings);
    expect(missing.map((field) => field.key).sort()).toEqual(['name', 'price']);
  });

  it('accepts price_before_tax in place of price', () => {
    const mappings = autoMapColumns(['Name', 'Price before tax']);
    expect(getMissingRequiredMappings(mappings)).toEqual([]);
  });

  it('overlays required flags from backend import-form schema', () => {
    const fields = mergeBackendImportSchema(PRODUCT_IMPORT_FIELDS, {
      fields: [{ key: 'sku', required: true, label: 'SKU' }],
    });
    expect(fields.find((field) => field.key === 'sku')?.required).toBe(true);
  });
});

describe('product import CSV parser', () => {
  it('parses quoted commas and detects headers', () => {
    const rows = parseCsvText('Name,SKU,Price\n"Samsung TV, 55",SAM-001,"65,000"\n');
    expect(rows[0]).toEqual(['Name', 'SKU', 'Price']);
    expect(rows[1][0]).toBe('Samsung TV, 55');
    expect(rows[1][2]).toBe('65,000');
  });
});

describe('product import validation', () => {
  it('maps category names to ids and strips tenant fields', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Sale Price', 'Category']);
    const result = validateImportRows({
      rows: [['Samsung TV', 'SAM-001', '65000', 'Electronics']],
      mappings,
      categories: [{ _id: 'cat1', name: 'Electronics' }],
      brands: [],
      existingProducts: [],
    });
    expect(result.rows[0].status).toBe('ready');
    expect(result.rows[0].values.categoryId).toEqual(['cat1']);
    const payload = stripTenantOverrideFields(
      buildCreatePayload({
        ...result.rows[0].values,
        company_id: 'other-company',
      }).productData
    );
    expect(payload.company_id).toBeUndefined();
    expect(payload.name).toBe('Samsung TV');
    expect(payload.price).toBe(65000);
  });

  it('flags invalid prices and duplicate SKUs', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Price']);
    const result = validateImportRows({
      rows: [
        ['Samsung TV', 'SAM-001', 'abc'],
        ['LG TV', 'SAM-001', '100'],
      ],
      mappings,
      existingProducts: [],
    });
    expect(result.rows[0].errors.some((msg) => /number/i.test(msg))).toBe(true);
    expect(result.rows[1].errors.some((msg) => /duplicate sku/i.test(msg))).toBe(true);
  });

  it('accepts a retail price of 0', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Price']);
    const result = validateImportRows({
      rows: [['AC Gas', '86', '0']],
      mappings,
      existingProducts: [],
    });
    expect(result.rows[0].errors).toEqual([]);
    expect(result.rows[0].values.price).toBe(0);
    expect(result.rows[0].status).not.toBe('error');
  });

  it('skips existing SKUs unless update is selected', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Price']);
    const existing = [{ _id: 'p1', sku: 'SAM-001', name: 'Old' }];
    const skipped = validateImportRows({
      rows: [['Samsung TV', 'SAM-001', '100']],
      mappings,
      existingProducts: existing,
      options: { existingMode: 'skip', matchBy: 'sku' },
    });
    expect(skipped.rows[0].action).toBe('skip');
    const updated = validateImportRows({
      rows: [['Samsung TV', 'SAM-001', '100']],
      mappings,
      existingProducts: existing,
      options: { existingMode: 'update', matchBy: 'sku' },
    });
    expect(updated.rows[0].action).toBe('update');
    expect(updated.rows[0].values.existingId).toBe('p1');
  });

  it('skips duplicate names when that option is enabled', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Price']);
    const existing = [{ _id: 'p1', sku: 'OTHER', name: 'Samsung TV' }];
    const skipped = validateImportRows({
      rows: [
        ['Samsung TV', 'SAM-001', '100'],
        ['Samsung TV', 'SAM-002', '120'],
      ],
      mappings,
      existingProducts: existing,
      options: { existingMode: 'skip', matchBy: 'sku', skipDuplicateNames: true },
    });
    expect(skipped.rows[0].action).toBe('skip');
    expect(skipped.rows[1].action).toBe('skip');
    const allowed = validateImportRows({
      rows: [['Samsung TV', 'SAM-001', '100']],
      mappings,
      existingProducts: existing,
      options: { existingMode: 'skip', matchBy: 'sku', skipDuplicateNames: false },
    });
    expect(allowed.rows[0].action).toBe('create');
  });

  it('resolves nested category paths and generates slugs', () => {
    const lookup = {
      byId: new Map(),
      byName: new Map([['mens t shirts', { _id: 'c2', name: 'Mens T-Shirts' }]]),
    };
    const resolved = resolveLookupValue('Clothing > Mens T-Shirts', lookup);
    expect(resolved.matched).toBe(true);
    expect(resolved.id).toBe('c2');
    expect(generateProductSlug('Samsung TV 55"')).toBe('samsung-tv-55');
  });

  it('collects parent-then-child category segments and splits missing ones', () => {
    const mappings = autoMapColumns(['Name', 'Price', 'Category']);
    const segments = collectCategorySegments(
      [
        ['Tee', '100', 'Clothing > Mens T-Shirts'],
        ['Hat', '80', 'Accessories'],
      ],
      mappings
    );
    expect(segments.map((item) => item.name)).toEqual(['Accessories', 'Clothing', 'Mens T-Shirts']);
    expect(segments.find((item) => item.name === 'Mens T-Shirts')?.parentName).toBe('Clothing');
    const plan = splitCategoryPlan(segments, [{ _id: 'c1', name: 'Clothing' }]);
    expect(plan.existing.map((item) => item.name)).toEqual(['Clothing']);
    expect(plan.missing.map((item) => item.name)).toEqual(['Accessories', 'Mens T-Shirts']);
  });

  it('warns that missing categories will be created first, then maps category_id after create', () => {
    const mappings = autoMapColumns(['Name', 'SKU', 'Sale Price', 'Category']);
    const result = validateImportRows({
      rows: [['Samsung TV', 'SAM-001', '65000', 'Electronics']],
      mappings,
      categories: [],
      brands: [],
      existingProducts: [],
      options: { createMissingCategories: true },
    });
    expect(result.rows[0].status).toBe('warning');
    expect(result.rows[0].values.categoryMatch).toBe('pending_create');
    expect(result.rows[0].warnings.some((msg) => /created first/i.test(msg))).toBe(true);
    const remapped = applyCategoryLookupToRows(
      result.rows,
      buildNameLookup([{ _id: 'cat1', name: 'Electronics' }], ['name', 'category_name'])
    );
    expect(remapped[0].values.categoryId).toEqual(['cat1']);
    expect(remapped[0].values.categoryMatch).toBe('matched');
    expect(remapped[0].status).toBe('ready');
  });
});
