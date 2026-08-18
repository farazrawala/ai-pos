export function formatPKR(value, { compact = false } = {}) {
  const n = Number(value) || 0;
  if (compact && Math.abs(n) >= 100000) {
    return `PKR ${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k`;
  }
  return `PKR ${n.toLocaleString('en-US')}`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}
