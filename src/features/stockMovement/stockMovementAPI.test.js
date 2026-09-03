import { describe, expect, it } from 'vitest';
import { getReferenceDisplay } from './stockMovementAPI.js';

describe('stock movement reference display', () => {
  it('shows the document number once instead of repeating the type', () => {
    expect(
      getReferenceDisplay({
        reference_name: 'Order (ORD-1362)',
        reference_type: 'order',
      })
    ).toEqual({ primary: 'ORD-1362', secondary: '', title: 'Order (ORD-1362)' });

    expect(
      getReferenceDisplay({
        reference_name: 'Purchase Order (PO-0706)',
        reference_type: 'purchase_order',
      })
    ).toEqual({ primary: 'PO-0706', secondary: '', title: 'Purchase Order (PO-0706)' });
  });

  it('falls back to the name when no document code is present', () => {
    expect(
      getReferenceDisplay({
        reference_name: 'Stock transfer',
        reference_type: 'transfer',
      })
    ).toEqual({ primary: 'Stock transfer', secondary: 'Transfer', title: 'Stock transfer' });
  });
});
