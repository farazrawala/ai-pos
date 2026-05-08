import moment from 'moment';

/**
 * Filter ledger lines for detail table (mock).
 * @param {import('./mock/ledgerTypes.js').LedgerTransaction[]} list
 * @param {object} f
 */
export function filterDetailTransactions(list, f) {
  return list.filter((t) => {
    if (f.dateFrom && moment(t.date).isBefore(moment(f.dateFrom).startOf('day'))) return false;
    if (f.dateTo && moment(t.date).isAfter(moment(f.dateTo).endOf('day'))) return false;
    if (f.transactionType === 'debit' && t.type !== 'debit') return false;
    if (f.transactionType === 'credit' && t.type !== 'credit') return false;
    if (f.reference && !String(t.referenceNo).toLowerCase().includes(String(f.reference).toLowerCase())) {
      return false;
    }
    if (f.paymentMethod !== 'all' && (t.paymentMethod || '') !== f.paymentMethod) return false;
    if (
      f.category &&
      !String(t.category || '')
        .toLowerCase()
        .includes(String(f.category).toLowerCase())
    ) {
      return false;
    }
    if (
      f.createdBy &&
      !String(t.createdBy || '')
        .toLowerCase()
        .includes(String(f.createdBy).toLowerCase())
    ) {
      return false;
    }
    if (f.searchNotes) {
      const q = String(f.searchNotes).toLowerCase();
      const inDesc = String(t.description || '').toLowerCase().includes(q);
      const inNotes = String(t.notes || '').toLowerCase().includes(q);
      if (!inDesc && !inNotes) return false;
    }
    return true;
  });
}

export function compareTransactions(a, b, sortKey, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1;
  if (sortKey === 'date') return (new Date(a.date) - new Date(b.date)) * dir;
  if (sortKey === 'referenceNo') return String(a.referenceNo).localeCompare(String(b.referenceNo)) * dir;
  if (sortKey === 'debit') return ((Number(a.debit) || 0) - (Number(b.debit) || 0)) * dir;
  if (sortKey === 'credit') return ((Number(a.credit) || 0) - (Number(b.credit) || 0)) * dir;
  if (sortKey === 'runningBalance')
    return ((Number(a.runningBalance) || 0) - (Number(b.runningBalance) || 0)) * dir;
  return 0;
}
