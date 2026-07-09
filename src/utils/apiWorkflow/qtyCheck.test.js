import { describe, it, expect } from 'vitest';
import {
  extractWarehouseQtyForProduct,
  extractStockByProductQty,
  normalizeWarehouseInventoryList,
  resolveActualProductQty,
} from './qtyCheck.js';

describe('normalizeWarehouseInventoryList', () => {
  it('reads nested data.data arrays from API envelopes', () => {
    const rows = [{ product_id: 'p1', quantity: 100 }];
    expect(
      normalizeWarehouseInventoryList({
        success: true,
        status: 200,
        data: { data: rows, total: 1 },
      })
    ).toEqual(rows);
  });
});

describe('extractWarehouseQtyForProduct', () => {
  const productId = 'prod-1';
  const warehouseId = 'wh-1';

  it('sums quantity for a product in nested list responses', () => {
    const actual = extractWarehouseQtyForProduct(
      {
        data: {
          data: [
            {
              product_id: { _id: productId },
              warehouse_id: { _id: warehouseId },
              quantity: 100,
            },
          ],
        },
      },
      productId,
      warehouseId
    );
    expect(actual).toBe(100);
  });

  it('falls back to all warehouses when warehouse filter does not match', () => {
    const actual = extractWarehouseQtyForProduct(
      {
        data: [
          {
            product_id: productId,
            warehouse_id: 'wh-other',
            quantity: 100,
          },
        ],
      },
      productId,
      warehouseId
    );
    expect(actual).toBe(100);
  });

  it('returns 0 when product is not present', () => {
    expect(
      extractWarehouseQtyForProduct({ data: [] }, productId, warehouseId)
    ).toBe(0);
  });
});

describe('extractStockByProductQty', () => {
  it('reads available_qty from stock-by-product payload', () => {
    expect(
      extractStockByProductQty({
        data: {
          available_qty: 100,
          warehouses: [{ warehouse_id: 'wh-1', available_qty: 100 }],
        },
      })
    ).toBe(100);
  });
});

describe('resolveActualProductQty', () => {
  it('uses stock-by-product when warehouse inventory list is empty', () => {
    const actual = resolveActualProductQty(
      { data: { data: [] } },
      { data: { available_qty: 100 } },
      'prod-1',
      'wh-1'
    );
    expect(actual).toBe(100);
  });
});
