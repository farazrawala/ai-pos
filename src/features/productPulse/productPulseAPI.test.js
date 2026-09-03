import { describe, expect, it } from 'vitest';
import {
  buildProductPulseOverviewUrl,
  buildProductPulseSalesUrl,
  buildPulseQuery,
  fetchProductPulseOverview,
  isMongoObjectId,
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

  it('ignores empty dedicated timeline payloads so composition can run', () => {
    expect(pickDedicatedTimelinePoints({ data: [] })).toBeNull();
    expect(pickDedicatedTimelinePoints({ points: [] })).toBeNull();
    expect(pickDedicatedTimelinePoints({ data: { points: [{ date: '2026-08', revenue: 100 }] } })).toEqual([
      { date: '2026-08', revenue: 100 },
    ]);
  });
});
