/**
 * Maps `/api/user/get-all-active` and `/api/user/get/:id` payloads to {@link import('./mock/ledgerTypes.js').LedgerUserRow}.
 * Ledger-specific fields (debit/credit totals, last tx) are absent from the user API — filled with safe defaults until a ledger endpoint exists.
 */

/**
 * @param {Record<string, unknown>} api
 * @returns {import('./mock/ledgerTypes.js').LedgerUserRow}
 */
export function mapApiUserToLedgerRow(api) {
  if (!api || typeof api !== 'object') {
    return {
      id: '',
      fullName: '—',
      email: '',
      phone: '',
      role: '—',
      status: 'active',
      openingBalance: 0,
      currentBalance: 0,
      totalDebit: 0,
      totalCredit: 0,
      lastTransactionAt: '',
      activityIndicator: 'offline',
      accountStatus: '',
      createdAt: '',
      lastActivityAt: '',
    };
  }

  const id = String(api._id ?? api.id ?? '');
  const initial = Number(api.initial_balance ?? api.initialBalance ?? 0) || 0;
  const roles = Array.isArray(api.role) ? api.role : api.role != null ? [api.role] : [];
  const roleLabel = roles.filter(Boolean).join(', ') || '—';
  const statusRaw = String(api.status ?? 'active').toLowerCase();
  const status =
    statusRaw === 'active' || statusRaw === 'inactive' || statusRaw === 'suspended' ? statusRaw : 'active';

  const updatedAt = api.updatedAt != null ? String(api.updatedAt) : '';
  const createdAt = api.createdAt != null ? String(api.createdAt) : '';

  return {
    id,
    fullName: String(api.name ?? api.fullName ?? '').trim() || '—',
    email: api.email != null ? String(api.email) : '',
    phone: api.phone != null ? String(api.phone) : '',
    role: roleLabel,
    status,
    openingBalance: initial,
    currentBalance: initial,
    totalDebit: 0,
    totalCredit: 0,
    lastTransactionAt: updatedAt || createdAt,
    activityIndicator: status === 'active' ? 'recent' : 'offline',
    accountStatus: status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'Suspended',
    createdAt,
    lastActivityAt: updatedAt || createdAt,
  };
}

/** Maps ledger listing sort keys to user list API `sortBy` values (best-effort). */
export const LEDGER_LIST_SORT_API = {
  fullName: 'name',
  openingBalance: 'initial_balance',
  currentBalance: 'initial_balance',
  lastTransactionAt: 'updatedAt',
  status: 'status',
};
