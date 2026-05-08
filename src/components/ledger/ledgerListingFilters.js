import moment from 'moment';

/**
 * Client-side filter + sort for ledger users listing (mock).
 * @param {import('../mock/ledgerTypes.js').LedgerUserRow[]} users
 * @param {object} f
 */
export function filterLedgerUsers(users, f) {
  let list = [...users];

  const q = String(f.search || '').trim().toLowerCase();
  if (q) {
    list = list.filter((u) => u.fullName.toLowerCase().includes(q));
  }

  const cq = String(f.contactSearch || '').trim().toLowerCase();
  if (cq) {
    list = list.filter(
      (u) =>
        String(u.email || '')
          .toLowerCase()
          .includes(cq) || String(u.phone || '').toLowerCase().includes(cq)
    );
  }

  if (f.status && f.status !== 'all') {
    list = list.filter((u) => u.status === f.status);
  }

  if (f.balanceType === 'positive') list = list.filter((u) => u.currentBalance > 0);
  else if (f.balanceType === 'negative') list = list.filter((u) => u.currentBalance < 0);
  else if (f.balanceType === 'zero') list = list.filter((u) => u.currentBalance === 0);

  if (f.dateFrom && f.dateTo) {
    const from = moment(f.dateFrom).startOf('day');
    const to = moment(f.dateTo).endOf('day');
    list = list.filter((u) => {
      if (!u.lastTransactionAt) return false;
      const d = moment(u.lastTransactionAt);
      return d.isBetween(from, to, undefined, '[]');
    });
  }

  const dir = f.sortDir === 'desc' ? -1 : 1;
  const sb = f.sortBy || 'fullName';

  if (sb === 'fullName') {
    list.sort((a, b) => a.fullName.localeCompare(b.fullName) * dir);
  } else if (sb === 'currentBalance') {
    list.sort((a, b) => (a.currentBalance - b.currentBalance) * dir);
  } else if (sb === 'openingBalance') {
    list.sort((a, b) => (a.openingBalance - b.openingBalance) * dir);
  } else if (sb === 'lastTransactionAt') {
    list.sort((a, b) => {
      const ta = a.lastTransactionAt ? new Date(a.lastTransactionAt).getTime() : 0;
      const tb = b.lastTransactionAt ? new Date(b.lastTransactionAt).getTime() : 0;
      return (ta - tb) * dir;
    });
  } else if (sb === 'status') {
    list.sort((a, b) => a.status.localeCompare(b.status) * dir);
  }

  return list;
}
