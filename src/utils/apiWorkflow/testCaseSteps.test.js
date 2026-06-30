import { describe, it, expect } from 'vitest';
import {
  WAC_SINGLE_PRODUCT_CASES,
  WAC_BY_CLAUD_CASES,
  createInventoryTestCaseSteps,
} from './testCaseSteps.js';
import { buildQtyLedgerFromSteps } from './inventoryQty.js';
import { roundMoney2 } from './inventoryCost.js';

describe('WAC single-product regression suite (with negative inventory)', () => {
  const steps = createInventoryTestCaseSteps('wac-single-product');
  const ledger = buildQtyLedgerFromSteps(steps);

  it('produces one ledger entry per transaction case', () => {
    expect(ledger).toHaveLength(WAC_SINGLE_PRODUCT_CASES.length);
  });

  it('running quantity equals the expected quantity at every step', () => {
    WAC_SINGLE_PRODUCT_CASES.forEach((tc, i) => {
      expect(ledger[i].qty, `step #${tc.n} (${tc.type})`).toBe(tc.expected);
    });
  });

  it('allows inventory to go negative (no Math.max(0) clamping)', () => {
    const negatives = ledger.filter((row) => row.qty < 0).map((row) => row.qty);
    // Steps #9 (-35), #13 (-45), #18 (-15), #19 (-5) push stock negative.
    expect(negatives).toEqual([-35, -45, -15, -5]);
  });

  it('keeps inventory value consistent with qty × WAC at every step', () => {
    ledger.forEach((row, i) => {
      const expectedValue = roundMoney2(row.qty * row.avgCost);
      expect(row.value, `value at step #${i + 1}`).toBeCloseTo(expectedValue, 2);
    });
  });

  it('recalculates WAC when recovering negative stock with a purchase (#10)', () => {
    // #9 leaves qty -35 with some WAC; #10 buys 80 @ 200 → qty 45 (not clamped to 80/200).
    const step9 = ledger[8];
    const step10 = ledger[9];
    expect(step9.qty).toBe(-35);
    expect(step10.qty).toBe(45);
    // New WAC must come from ((-35 × oldWAC) + 80 × 200) / 45, i.e. recomputed.
    const expectedWac = (step9.qty * step9.avgCost + 80 * 200) / step10.qty;
    expect(step10.avgCost).toBeCloseTo(expectedWac, 4);
  });

  it('leaves WAC unchanged on sales and sales returns', () => {
    WAC_SINGLE_PRODUCT_CASES.forEach((tc, i) => {
      if ((tc.type === 'sale' || tc.type === 'sales_return') && i > 0) {
        // Sales never change WAC; sales returns add back at the current WAC
        // (tiny differences only from rounding inventory value to 2 decimals).
        expect(ledger[i].avgCost, `WAC after step #${tc.n} (${tc.type})`).toBeCloseTo(
          ledger[i - 1].avgCost,
          2
        );
      }
    });
  });

  it('returns to zero stock after the final historical delete (#22)', () => {
    expect(ledger[ledger.length - 1].qty).toBe(0);
  });
});

describe('WAC by claud suite (wac_transaction_tracker.html)', () => {
  const steps = createInventoryTestCaseSteps('wac-by-claud');
  const ledger = buildQtyLedgerFromSteps(steps, WAC_BY_CLAUD_CASES);

  it('produces one ledger entry per transaction case', () => {
    expect(ledger).toHaveLength(WAC_BY_CLAUD_CASES.length);
  });

  it('running quantity matches the HTML tracker at every step', () => {
    WAC_BY_CLAUD_CASES.forEach((tc, i) => {
      expect(ledger[i].qty, `step #${tc.n} (${tc.type})`).toBe(tc.expected);
    });
  });

  it('ends at qty 10 after final validation', () => {
    expect(ledger[ledger.length - 1].qty).toBe(10);
  });

  it('includes negative stock steps from the spec', () => {
    const negatives = ledger.filter((row) => row.qty < 0).map((row) => row.qty);
    expect(negatives).toContain(-25);
    expect(negatives).toContain(-20);
  });

  it('purchase return #21 is capped to available stock (qty 45 → 35)', () => {
    const step21 = ledger[20];
    expect(step21.qty).toBe(35);
    expect(step21.avgCost).toBeGreaterThan(0);
  });
});
