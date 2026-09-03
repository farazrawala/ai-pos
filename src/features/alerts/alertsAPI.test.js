import { describe, expect, it } from 'vitest';
import {
  buildLowStockAlertsQuery,
  parseLowStockAlertRow,
  rowMatchesLowStockDate,
  rowMatchesLowStockSearch,
  sortLowStockRows,
} from './alertsAPI.js';

describe('Low stock alerts API helpers', () => {
  it('never puts company_id on the query string', () => {
    const query = buildLowStockAlertsQuery({
      skip: 0,
      limit: 50,
      search: 'giraffe',
      from: '2026-09-01',
      to: '2026-09-03',
      mode: 'live',
      company_id: 'should-not-be-sent',
    });
    expect(query.get('company_id')).toBeNull();
    expect(query.get('skip')).toBe('0');
    expect(query.get('limit')).toBe('50');
    expect(query.get('search')).toBe('giraffe');
    expect(query.get('from')).toBe('2026-09-01');
    expect(query.get('mode')).toBe('live');
  });

  it('parses the live low-stock payload shape', () => {
    const row = parseLowStockAlertRow({
      alert_id: '6a9f1a2b3c4d5e6f708192a3',
      product_id: '6a8b1c2d3e4f5a6b7c8d9e0f',
      product_name: 'Adorable Giraffe Short Set',
      product_code: 'AGS-001',
      sku: 'shopify-10489801965749',
      barcode: '1234567890123',
      unit: 'pcs',
      on_hand: 2,
      alert_qty: 10,
      shortage: 8,
      product_price: 1499,
      wholesale_price: 1200,
      product_image: 'uploads/products/giraffe.jpg',
      low_stock: true,
      alert_created_at: '2026-09-01T10:15:00.000Z',
    });
    expect(row.id).toBe('6a8b1c2d3e4f5a6b7c8d9e0f');
    expect(row.stock).toBe(2);
    expect(row.alertQty).toBe(10);
    expect(row.shortage).toBe(8);
    expect(row.status).toBe('low');
    expect(row.alertCreatedAt).toBe('2026-09-01');
  });

  it('marks zero on-hand as out of stock and computes shortage', () => {
    const row = parseLowStockAlertRow({
      product_id: 'abc',
      product_name: 'Baby Bear Printed Sweatshirt Set',
      on_hand: 0,
      alert_qty: 5,
    });
    expect(row.status).toBe('out');
    expect(row.shortage).toBe(5);
  });

  it('filters by name, code, sku, and barcode', () => {
    const row = parseLowStockAlertRow({
      product_name: 'Giraffe Short Set',
      product_code: 'AGS-001',
      sku: 'shopify-1048',
      barcode: '1234567890123',
    });
    expect(rowMatchesLowStockSearch(row, 'giraffe')).toBe(true);
    expect(rowMatchesLowStockSearch(row, 'AGS')).toBe(true);
    expect(rowMatchesLowStockSearch(row, '1048')).toBe(true);
    expect(rowMatchesLowStockSearch(row, 'zzz')).toBe(false);
  });

  it('keeps rows with no alert date when a date range is applied', () => {
    const row = parseLowStockAlertRow({ product_name: 'Undated', on_hand: 1, alert_qty: 5 });
    expect(rowMatchesLowStockDate(row, '2026-09-01', '2026-09-03')).toBe(true);
  });

  it('sorts shortage high to low by default', () => {
    const rows = sortLowStockRows(
      [
        { name: 'A', shortage: 2 },
        { name: 'B', shortage: 8 },
      ],
      'shortage',
      'desc'
    );
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
  });
});
