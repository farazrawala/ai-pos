import { describe, expect, it } from 'vitest';
import {
  buildProductPulseOverviewUrl,
  buildProductPulseSalesUrl,
  buildPulseQuery,
  buildPulseSearchOptions,
  fetchProductPulseOverview,
  isMongoObjectId,
  normalizeVariationList,
  pickDedicatedTimelinePoints,
  sellableProductIds,
} from './productPulseAPI.js';
import { skipLimitFromPage } from './productPulseEngine.js';

describe('ProductPulse API contracts', () => {
  it('never puts company_id on the query string (tenant comes from the auth token)', () => {
    const query = buildPulseQuery({
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      variantId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      warehouseId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      companyId: 'should-not-be-sent',
      company_id: 'also-not-sent',
    });
    expect(query.get('company_id')).toBeNull();
    expect(query.get('companyId')).toBeNull();
    expect(query.get('variant_id')).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(query.get('warehouse_id')).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(query.get('from')).toBe('2026-08-01');
    expect(query.get('to')).toBe('2026-08-31');
  });

  it('validates Mongo ids', () => {
    expect(isMongoObjectId('64f1c2a1b2c3d4e5f6789012')).toBe(true);
    expect(isMongoObjectId('../etc/passwd')).toBe(false);
    expect(isMongoObjectId('')).toBe(false);
  });

  it('uses skip/limit pagination matching the rest of the app', () => {
    const query = buildPulseQuery({ page: 3, limit: 25, sortBy: 'createdAt', sortOrder: 'desc' });
    expect(query.get('skip')).toBe('50');
    expect(query.get('limit')).toBe('25');
    expect(skipLimitFromPage(1, 25)).toEqual({ skip: 0, limit: 25, page: 1 });
  });

  it('builds dedicated pulse URLs under product/pulse/:id', () => {
    const id = '64f1c2a1b2c3d4e5f6789012';
    expect(buildProductPulseOverviewUrl(id, { startDate: '2026-08-01', endDate: '2026-08-30' })).toContain(
      `product/pulse/${id}`
    );
    expect(buildProductPulseSalesUrl(id, { page: 1, limit: 25 })).toContain(`/sales`);
  });

  it('rejects invalid product and variant ids before calling the API', async () => {
    await expect(fetchProductPulseOverview({ productId: '../secret' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      fetchProductPulseOverview({
        productId: '64f1c2a1b2c3d4e5f6789012',
        variantId: 'not-an-id',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sellable ids are children for variable products and the product itself otherwise', () => {
    expect(sellableProductIds({ _id: 'parent' }, [{ id: 'a' }, { id: 'b' }], '')).toEqual(['a', 'b']);
    expect(sellableProductIds({ _id: 'parent' }, [{ id: 'a' }, { id: 'b' }], 'b')).toEqual(['b']);
    expect(sellableProductIds({ _id: 'single' }, [], '')).toEqual(['single']);
  });

  it('reads nested childproducts from variation payloads', () => {
    const rows = normalizeVariationList(
      {
        success: true,
        data: {
          _id: 'parent',
          product_type: 'Variable',
          childproducts: [
            { _id: 'child-a', product_name: 'Nice To Meet Short Set [S]', sku: 'NTM-S' },
            { _id: 'child-b', product_name: 'Nice To Meet Short Set [M]', sku: 'NTM-M' },
            { _id: 'parent', product_name: 'Nice To Meet Short Set' },
          ],
        },
      },
      { _id: 'parent' }
    );
    expect(rows.map((row) => row.id)).toEqual(['child-a', 'child-b']);
    expect(rows[0].name).toBe('S');
  });

  it('lists nested variants as selectable search rows', () => {
    const options = buildPulseSearchOptions([
      {
        _id: 'parent',
        product_name: 'Nice To Meet Short Set',
        product_type: 'Variable',
        sku: 'shopify-10489802260661',
        childproducts: [
          {
            _id: 'child-s',
            product_name: 'Nice To Meet Short Set [S]',
            sku: 'NTM-S',
            parent_product_id: 'parent',
          },
        ],
      },
    ]);
    expect(options.some((row) => row.value === 'parent' && !row.isVariantChild)).toBe(true);
    expect(options.some((row) => row.value === 'child-s' && row.isVariantChild && row.parentId === 'parent')).toBe(
      true
    );
  });

  it('ignores empty dedicated timeline payloads so composition can run', () => {
    expect(pickDedicatedTimelinePoints({ data: [] })).toBeNull();
    expect(pickDedicatedTimelinePoints({ points: [] })).toBeNull();
    expect(pickDedicatedTimelinePoints({ data: { points: [{ date: '2026-08', revenue: 100 }] } })).toEqual([
      { date: '2026-08', revenue: 100 },
    ]);
  });
});
