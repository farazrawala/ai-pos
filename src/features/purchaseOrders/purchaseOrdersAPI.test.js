import { describe, expect, it } from 'vitest';
import { poRefId, purchaseOrderContainsProduct } from './purchaseOrdersAPI.js';

describe('purchaseOrderContainsProduct', () => {
  const productId = '64f1c2a1b2c3d4e5f6789012';

  it('matches a line with a bare product_id', () => {
    expect(
      purchaseOrderContainsProduct(
        { purchase_order_items: [{ product_id: productId, qty: 2 }] },
        productId
      )
    ).toBe(true);
  });

  it('matches a populated product_id object', () => {
    expect(
      purchaseOrderContainsProduct(
        { items: [{ product_id: { _id: productId, product_name: 'Widget' } }] },
        productId
      )
    ).toBe(true);
  });

  it('ignores purchase orders that do not include the product', () => {
    expect(
      purchaseOrderContainsProduct(
        { items: [{ product_id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }] },
        productId
      )
    ).toBe(false);
    expect(purchaseOrderContainsProduct({ items: [] }, productId)).toBe(false);
    expect(purchaseOrderContainsProduct(null, productId)).toBe(false);
  });

  it('reads an id from a populated ref', () => {
    expect(poRefId({ _id: productId, name: 'Widget' })).toBe(productId);
    expect(poRefId(productId)).toBe(productId);
    expect(poRefId(null)).toBe('');
  });
});
