/** @param {number} n */
export const fmtMoney = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** @param {number} value */
export const balanceTextClass = (value) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x === 0) return 'text-dark';
  return x > 0 ? 'text-success' : 'text-danger';
};

/**
 * @param {import('./mock/ledgerTypes.js').LedgerTransaction[]} sortedChrono
 * @param {number} openingBalance
 */
export function computeRunningBalances(sortedChrono, openingBalance) {
  let bal = openingBalance;
  return sortedChrono.map((t) => {
    bal += Number(t.credit) || 0;
    bal -= Number(t.debit) || 0;
    return { ...t, runningBalance: bal };
  });
}
