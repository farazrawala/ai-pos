import { describe, expect, it } from 'vitest';
import {
  buildOrderPulseOverviewUrl,
  buildOrderPulseOrdersUrl,
  buildPulseQuery,
} from './orderPulseAPI.js';
import { skipLimitFromPage } from './orderPulseEngine.js';
import { fetchOrderPulseOverview } from './orderPulseAPI.js';

describe('OrderPulse API contracts', () => {
  it('never puts company_id on the query string (tenant comes from the auth token)', () => {
    const query = buildPulseQuery({
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      warehouseId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      orderStatus: 'delivered',
      paymentMethodId: 'cccccccccccccccccccccccc',
      productId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      companyId: 'should-not-be-sent',
      company_id: 'also-not-sent',
    });
    expect(query.get('company_id')).toBeNull();
    expect(query.get('companyId')).toBeNull();
    expect(query.get('warehouse_id')).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(query.get('order_status')).toBe('delivered');
    expect(query.get('product_id')).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(query.get('from')).toBe('2026-08-01');
    expect(query.get('to')).toBe('2026-08-31');
  });

  it('uses skip/limit pagination matching the rest of the app', () => {
    const query = buildPulseQuery({ page: 3, limit: 25, sortBy: 'createdAt', sortOrder: 'desc' });
    expect(query.get('skip')).toBe('50');
    expect(query.get('limit')).toBe('25');
    expect(skipLimitFromPage(1, 25)).toEqual({ skip: 0, limit: 25, page: 1 });
  });

  it('builds dedicated pulse URLs under order/pulse', () => {
    expect(buildOrderPulseOverviewUrl({ startDate: '2026-08-01', endDate: '2026-08-30' })).toContain(
      'order/pulse/overview'
    );
    expect(buildOrderPulseOrdersUrl({ page: 1, limit: 25 })).toContain('/orders');
  });

  it('rejects invalid warehouse and product ids before calling the API', async () => {
    await expect(fetchOrderPulseOverview({ warehouseId: '../secret' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(fetchOrderPulseOverview({ productId: 'not-an-id' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
