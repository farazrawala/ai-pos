import { describe, it, expect } from 'vitest';
import {
  EMPTY_INVENTORY,
  applyPurchase,
  applySale,
  applyReduceAtCost,
  applyQtyLedgerCost,
  roundMoney2,
} from './inventoryCost.js';

/** Round the internal full-precision WAC for display comparisons. */
const avg2 = (state) => (state.qty === 0 ? 0 : roundMoney2(state.avgCost));

describe('Weighted Average Cost (WAC) engine', () => {
  it('sets WAC on first purchase', () => {
    const s = applyPurchase(EMPTY_INVENTORY, 10, 100);
    expect(s.qty).toBe(10);
    expect(s.value).toBe(1000);
    expect(avg2(s)).toBe(100);
  });

  it('recomputes WAC when a second purchase is received', () => {
    let s = applyPurchase(EMPTY_INVENTORY, 10, 100);
    s = applyPurchase(s, 30, 140);
    // (1000 + 4200) / 40 = 130
    expect(s.qty).toBe(40);
    expect(s.value).toBe(5200);
    expect(avg2(s)).toBe(130);
  });

  it('keeps WAC unchanged on a sale and reduces value at WAC', () => {
    let s = applyPurchase(EMPTY_INVENTORY, 10, 100);
    s = applyPurchase(s, 20, 140); // WAC = 126.666...
    const avgBefore = s.avgCost;
    s = applySale(s, 15);
    expect(s.qty).toBe(15);
    expect(s.avgCost).toBe(avgBefore); // WAC must not change on a sale
    expect(s.value).toBe(roundMoney2(15 * avgBefore));
  });

  it('recalculates WAC at original cost when a purchase order is edited down', () => {
    let s = applyPurchase(EMPTY_INVENTORY, 10, 100);
    s = applyPurchase(s, 30, 140); // qty 40, value 5200, WAC 130
    // Edit the second PO from 30 -> 20 units: remove 10 units @ original 140.
    s = applyReduceAtCost(s, 10, 140);
    expect(s.qty).toBe(30);
    expect(s.value).toBe(3800);
    expect(avg2(s)).toBe(126.67); // 3800 / 30
  });

  it('allows negative inventory and negative inventory value on oversell', () => {
    let s = applyPurchase(EMPTY_INVENTORY, 40, 160); // qty 40, WAC 160
    s = applySale(s, 50);
    expect(s.qty).toBe(-10);
    expect(s.avgCost).toBe(160); // WAC unchanged
    expect(s.value).toBe(-1600);
  });

  it('reprices from negative stock to a new WAC after a purchase', () => {
    // qty -10 @ WAC 160, then buy 20 @ 200 -> qty 10, value -1600 + 4000 = 2400, WAC 240
    let s = { qty: -10, value: -1600, avgCost: 160 };
    s = applyPurchase(s, 20, 200);
    expect(s.qty).toBe(10);
    expect(s.value).toBe(2400);
    expect(avg2(s)).toBe(240);
  });
});

describe('WAC qty-ledger sequence (authoritative WAC single-product table)', () => {
  // Each row: type, qty, optional unitCost, and the expected running state.
  const steps = [
    { type: 'purchase', qty: 10, unitCost: 100, expQty: 10, expAvg: 100, expValue: 1000 },
    { type: 'purchase', qty: 30, unitCost: 140, expQty: 40, expAvg: 130, expValue: 5200 },
    // Edit PO #2 down to 20 units => remove 10 units @ 140
    { type: 'edit_purchase', qty: 10, unitCost: 140, expQty: 30, expAvg: 126.67, expValue: 3800 },
    { type: 'sale', qty: 15, expQty: 15, expAvg: 126.67, expValue: 1900 },
    { type: 'purchase', qty: 25, unitCost: 180, expQty: 40, expAvg: 160, expValue: 6400 },
    { type: 'sale', qty: 50, expQty: -10, expAvg: 160, expValue: -1600 },
    { type: 'purchase', qty: 20, unitCost: 200, expQty: 10, expAvg: 240, expValue: 2400 },
    { type: 'purchase_return', qty: 5, expQty: 5, expAvg: 240, expValue: 1200 },
    { type: 'sales_return', qty: 10, expQty: 15, expAvg: 240, expValue: 3600 },
    { type: 'sale', qty: 30, expQty: -15, expAvg: 240, expValue: -3600 },
  ];

  it('matches qty, WAC and inventory value at every step', () => {
    let state = { ...EMPTY_INVENTORY };
    steps.forEach((step, i) => {
      state = applyQtyLedgerCost(state, step);
      expect(state.qty, `qty at step #${i + 1} (${step.type})`).toBe(step.expQty);
      expect(roundMoney2(state.value), `value at step #${i + 1} (${step.type})`).toBe(
        step.expValue
      );
      expect(avg2(state), `WAC at step #${i + 1} (${step.type})`).toBe(step.expAvg);
    });
  });
});
