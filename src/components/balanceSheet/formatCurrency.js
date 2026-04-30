/**
 * @param {number} value
 * @param {string} [currency='USD']
 */
export function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
