const DEFAULT_LOCALE = 'en-PK';

/**
 * @param {number} value
 * @param {number} fractionDigits
 */
function formatRs(value, fractionDigits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Rs. —';
  return `Rs. ${n.toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * @param {number} value
 */
export function formatCurrency(value) {
  return formatRs(value, 0);
}

/** Two decimals — typical for general-ledger / financial statements. */
export function formatCurrencyAccounting(value) {
  return formatRs(value, 2);
}
