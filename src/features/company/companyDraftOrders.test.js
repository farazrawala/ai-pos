import { describe, it, expect } from 'vitest';
import {
  pickDraftOrdersFromApiBody,
  normalizeCompanyDraftOrders,
} from '../../features/company/companyAPI.js';

describe('pickDraftOrdersFromApiBody', () => {
  it('reads draft_orders on the company document', () => {
    const rows = [{ _id: 'a', label: 'One', payload: { cartLines: [] } }];
    expect(pickDraftOrdersFromApiBody({ draft_orders: rows })).toEqual(rows);
  });

  it('reads nested data.draft_orders', () => {
    const rows = [{ _id: 'b', label: 'Two', payload: {} }];
    expect(pickDraftOrdersFromApiBody({ success: true, data: { draft_orders: rows } })).toEqual(
      rows
    );
  });

  it('reads a draft array on data', () => {
    const rows = [{ _id: 'c', label: 'Three', payload: { cartLines: [1] } }];
    expect(pickDraftOrdersFromApiBody({ success: true, data: rows })).toEqual(rows);
  });
});

describe('normalizeCompanyDraftOrders', () => {
  it('keeps drafts when _id is a Mongo $oid object', () => {
    const list = normalizeCompanyDraftOrders({
      draft_orders: [{ _id: { $oid: 'abc123' }, label: 'Phone', payload: { cartLines: [] } }],
    });
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe('abc123');
    expect(list[0].label).toBe('Phone');
  });

  it('keeps drafts that have no _id', () => {
    const list = normalizeCompanyDraftOrders({
      draft_orders: [{ label: 'No id', payload: { cartLines: [] } }],
    });
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe('draft-0');
  });
});
