import moment from 'moment';
import { fmtMoney } from './ledgerUtils.js';

/**
 * @param {import('./mock/ledgerTypes.js').LedgerTransaction} t
 * @returns {'payment'|'invoice'|'adjustment'|'note'}
 */
function inferTimelineType(t) {
  const cat = String(t.category || '').toLowerCase();
  const desc = String(t.description || '').toLowerCase();
  if (cat.includes('adjust') || desc.includes('adjust')) return 'adjustment';
  if (
    cat.includes('purchase') ||
    cat.includes('order') ||
    cat.includes('invoice') ||
    desc.includes('purchase') ||
    desc.includes('invoice')
  ) {
    return 'invoice';
  }
  if (
    cat.includes('receipt') ||
    cat.includes('payment') ||
    cat.includes('sales') ||
    desc.includes('receipt') ||
    desc.includes('payment received')
  ) {
    return 'payment';
  }
  if (t.type === 'credit') return 'payment';
  if (t.type === 'debit') return 'invoice';
  return 'note';
}

/**
 * Recent-activity items for the vertical timeline (newest first).
 *
 * @param {import('./mock/ledgerTypes.js').LedgerTransaction[]} transactions
 * @param {{ limit?: number }} [options] — default 10 (recent activity)
 * @returns {{ id: string, at: string, type: string, title: string, detail: string, by: string }[]}
 */
export function buildLedgerTimelineEvents(transactions, options = {}) {
  const limit = options.limit ?? 10;
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const slice = sorted.slice(0, limit);

  return slice.map((t) => {
    const type = inferTimelineType(t);
    const title =
      t.category && String(t.category).trim() && String(t.category).toLowerCase() !== 'general'
        ? String(t.category)
        : t.type === 'credit'
          ? 'Credit entry'
          : t.type === 'debit'
            ? 'Debit entry'
            : 'Transaction';

    const refDesc = [t.referenceNo, t.description].filter(Boolean).join(' — ') || '—';
    const d = Number(t.debit) || 0;
    const c = Number(t.credit) || 0;
    let amt = '';
    if (d > 0 && c > 0) amt = `${fmtMoney(d)} Dr · ${fmtMoney(c)} Cr`;
    else if (d > 0) amt = `${fmtMoney(d)} debit`;
    else if (c > 0) amt = `${fmtMoney(c)} credit`;
    const detail = amt ? `${refDesc} · ${amt}` : refDesc;

    return {
      id: String(t.id || `${t.date}-${t.referenceNo}`),
      at: moment(t.date).format('DD MMM YYYY, HH:mm'),
      type,
      title,
      detail,
      by: String(t.createdBy || '—'),
    };
  });
}

/**
 * Aggregate ledger lines into monthly totals for stacked/grouped bar chart.
 * Fills every calendar month from first to last transaction month (inclusive).
 *
 * @param {import('./mock/ledgerTypes.js').LedgerTransaction[]} transactions
 * @returns {{ labels: string[], debit: number[], credit: number[] }}
 */
export function buildMonthlyDebitCreditSeries(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { labels: ['—'], debit: [0], credit: [0] };
  }

  /** @type {Map<string, { debit: number; credit: number }>} */
  const buckets = new Map();

  for (const t of transactions) {
    if (!t?.date) continue;
    const m = moment(t.date);
    if (!m.isValid()) continue;
    const key = m.format('YYYY-MM');
    if (!buckets.has(key)) {
      buckets.set(key, { debit: 0, credit: 0 });
    }
    const b = buckets.get(key);
    b.debit += Number(t.debit) || 0;
    b.credit += Number(t.credit) || 0;
  }

  const keys = Array.from(buckets.keys()).sort();
  if (keys.length === 0) {
    return { labels: ['—'], debit: [0], credit: [0] };
  }

  const start = moment(keys[0], 'YYYY-MM').startOf('month');
  const end = moment(keys[keys.length - 1], 'YYYY-MM').startOf('month');
  const labels = [];
  const debit = [];
  const credit = [];

  for (let d = start.clone(); d.isSameOrBefore(end, 'month'); d.add(1, 'month')) {
    const key = d.format('YYYY-MM');
    const b = buckets.get(key) || { debit: 0, credit: 0 };
    labels.push(d.format('MMM YYYY'));
    debit.push(Number(b.debit.toFixed(2)));
    credit.push(Number(b.credit.toFixed(2)));
  }

  return { labels, debit, credit };
}
