import { CURRENCY_CODE, CURRENCY_LOCALE } from '../config/env.js';

/**
 * Format a numeric amount with the app currency from `.env` (`VITE_CURRENCY_CODE`, `VITE_CURRENCY_LOCALE`).
 * @param {number|string|null|undefined} value
 * @param {{ fractionDigits?: number }} [options]
 */
export function formatMoney(value, { fractionDigits = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${CURRENCY_CODE} ${n.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
