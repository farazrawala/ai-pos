/** Linked document / order reference for display. */
export function formatLedgerLinkRef(row) {
  if (row?.linkedRefs?.length) return row.linkedRefs.join(', ');
  return '—';
}

/** @param {number} n */
export const fmtMoney = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** @param {number} value */
export const balanceTextClass = (value) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x === 0) return 'text-muted';
  return x > 0 ? 'text-success' : 'text-danger';
};

/** Debit/credit totals stay neutral at zero so empty books don't look like alerts. */
export const flowAmountClass = (value, kind) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x === 0) return 'text-muted';
  return kind === 'credit' ? 'text-success' : 'text-danger';
};

export function formatRoleLabel(role) {
  const raw = String(role || '').trim();
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseRoleLabels(role) {
  const list = Array.isArray(role)
    ? role
    : role != null && String(role).trim()
      ? String(role).split(',')
      : [];
  return list.map((item) => formatRoleLabel(item)).filter(Boolean);
}

export function userInitials(name) {
  const initials = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '—';
}

const AVATAR_TONES = [
  { bg: '#e8eef5', color: '#3d5a80' },
  { bg: '#e9f4ee', color: '#2d6a4f' },
  { bg: '#f1eef6', color: '#5b4b7a' },
  { bg: '#f6efe8', color: '#7a5b3d' },
  { bg: '#eaf3f6', color: '#2f6273' },
  { bg: '#f5eef1', color: '#7a3d56' },
];

export function avatarTone(seed) {
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/**
 * Running balance is `credit - debit`, so amounts billed to the party (debits)
 * push it negative — a negative balance is money receivable from them.
 * @param {number} value
 */
export const balancePositionLabel = (value) => {
  const x = Number(value);
  if (!Number.isFinite(x) || x === 0) return 'Settled';
  return x < 0 ? 'Receivable' : 'Payable';
};

/** Opening balance the backend posts as its own ledger line. */
export function isOpeningBalanceTransaction(t) {
  return /(initial|opening)\s+balance/i.test(String(t?.description ?? ''));
}

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
