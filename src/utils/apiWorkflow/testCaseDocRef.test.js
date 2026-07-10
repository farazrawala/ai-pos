import { describe, it, expect } from 'vitest';
import {
  buildTestCaseDocRefMap,
  formatTestCaseDocRef,
  resolveTestCaseDocRef,
} from './testCaseDocRef.js';
import { createInventoryTestCaseSteps } from './testCaseSteps.js';

describe('testCaseDocRef', () => {
  it('formats serial refs per document type', () => {
    expect(formatTestCaseDocRef('sale', 1)).toBe('ORD-001');
    expect(formatTestCaseDocRef('purchase', 2)).toBe('PO-002');
    expect(formatTestCaseDocRef('purchase_return', 3)).toBe('PR-003');
    expect(formatTestCaseDocRef('sales_return', 4)).toBe('SR-004');
  });

  it('assigns independent serial counters per type', () => {
    const cases = [
      { n: 1, type: 'purchase' },
      { n: 2, type: 'sale' },
      { n: 3, type: 'purchase' },
      { n: 4, type: 'sales_return' },
      { n: 5, type: 'purchase_return' },
    ];
    const map = buildTestCaseDocRefMap(cases);
    expect(map.get(1)?.ref).toBe('PO-001');
    expect(map.get(2)?.ref).toBe('ORD-001');
    expect(map.get(3)?.ref).toBe('PO-002');
    expect(map.get(4)?.ref).toBe('SR-001');
    expect(map.get(5)?.ref).toBe('PR-001');
  });

  it('resolves referenced doc on edit/delete steps', () => {
    const cases = [{ n: 1, type: 'purchase' }];
    const map = buildTestCaseDocRefMap(cases);
    expect(resolveTestCaseDocRef({ n: 9, type: 'delete_purchase', ref: 1 }, map)).toBe('PO-001');
  });
});

describe('createInventoryTestCaseSteps doc refs', () => {
  it('embeds serial refs in API bodies and step metadata', () => {
    const steps = createInventoryTestCaseSteps('purchase-sell-return');
    const poCreate = steps.find(
      (s) => s.method === 'POST' && s.url?.includes('purchase_order_create')
    );
    const saleCreate = steps.find((s) => s.method === 'POST' && s.url?.includes('order_save'));
    const srCreate = steps.find(
      (s) => s.method === 'POST' && s.url?.includes('sales_return_create')
    );

    expect(poCreate?.docRef).toBe('PO-001');
    expect(poCreate?.body?.ref_no).toBe('PO-001');
    expect(saleCreate?.docRef).toBe('ORD-001');
    expect(saleCreate?.body?.order_no).toBe('ORD-001');
    expect(srCreate?.docRef).toBe('SR-001');
    expect(srCreate?.body?.ref_no).toBe('SR-001');
  });
});
