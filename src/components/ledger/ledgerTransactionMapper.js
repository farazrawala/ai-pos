import { parseTransactionAmount, getAccountName } from '../../features/transactions/transactionsAPI.js';

/**
 * Display label for API `created_by` when populated `{ _id, name }` or raw id string.
 * @param {unknown} raw
 */
export function formatTransactionCreatedByLabel(raw) {
  if (raw == null || raw === '') return '—';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const name = o.name ?? o.fullName ?? o.username ?? o.email;
    if (name != null && String(name).trim()) return String(name).trim();
    const id = o._id ?? o.id;
    if (id != null) return String(id);
  }
  return String(raw);
}

/**
 * @param {string} [module]
 */
function refModuleLabel(module) {
  if (!module) return '';
  return String(module)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {Record<string, unknown>} api
 * @returns {string[]}
 */
function extractLinkedRefs(api) {
  const refs = [];
  const rid = api.reference_id;
  if (!rid || typeof rid !== 'object') return refs;
  const refObj = /** @type {Record<string, unknown>} */ (rid).ref_id;
  const mod = /** @type {Record<string, unknown>} */ (rid).module;
  if (refObj && typeof refObj === 'object' && !Array.isArray(refObj)) {
    const po = refObj.purchase_order_no ?? refObj.purchaseOrderNo;
    const ord = refObj.order_no ?? refObj.orderNo;
    const tno = refObj.transaction_number ?? refObj.transactionNumber;
    if (po != null && String(po).trim()) refs.push(String(po).trim());
    else if (ord != null && String(ord).trim()) refs.push(String(ord).trim());
    else if (tno != null && String(tno).trim()) refs.push(String(tno).trim());
    else if (refObj._id && mod) refs.push(`${String(mod)}:${String(refObj._id).slice(-8)}`);
  }
  return refs;
}

/**
 * Map `/transaction/get-all-active` row (with populate) to {@link import('./mock/ledgerTypes.js').LedgerTransaction}.
 * @param {Record<string, unknown>} api
 * @returns {import('./mock/ledgerTypes.js').LedgerTransaction}
 */
export function mapApiTransactionToLedgerTransaction(api) {
  if (!api || typeof api !== 'object') {
    return {
      id: '',
      date: new Date().toISOString(),
      referenceNo: '—',
      description: '—',
      category: '',
      type: 'credit',
      debit: 0,
      credit: 0,
      paymentMethod: '',
      createdBy: '—',
      status: 'posted',
      debitAccount: '—',
      creditAccount: '—',
    };
  }

  const id = String(api._id ?? api.id ?? '');
  const typeRaw = String(api.type || '').toLowerCase().trim();
  const type = typeRaw === 'debit' ? 'debit' : 'credit';
  const amt = parseTransactionAmount(api.amount);
  const debit = type === 'debit' ? amt : 0;
  const credit = type === 'credit' ? amt : 0;
  const accName = getAccountName(api);
  const debitAccount = type === 'debit' ? accName : '—';
  const creditAccount = type === 'credit' ? accName : '—';

  const rid = api.reference_id;
  const refModule = rid && typeof rid === 'object' && 'module' in rid ? /** @type {{ module?: string }} */ (rid).module : undefined;
  const category = refModuleLabel(refModule) || 'General';

  const st = String(api.status || 'active').toLowerCase();
  /** @type {'posted'|'pending'|'void'} */
  let status = 'posted';
  if (st === 'pending') status = 'pending';
  else if (st === 'void' || st === 'cancelled') status = 'void';

  const linkedRefs = extractLinkedRefs(api);
  const notesParts = [];
  if (refModule && linkedRefs.length) {
    notesParts.push(`Ref: ${linkedRefs.join(', ')}`);
  }

  return {
    id,
    date: api.createdAt != null ? String(api.createdAt) : new Date().toISOString(),
    referenceNo: String(api.transaction_number ?? api.transactionNumber ?? id.slice(-8)),
    description: api.description != null ? String(api.description) : '—',
    category,
    type,
    debit,
    credit,
    paymentMethod: '—',
    createdBy: formatTransactionCreatedByLabel(api.created_by),
    status,
    notes: notesParts.length ? notesParts.join(' · ') : '',
    debitAccount,
    creditAccount,
    linkedRefs,
    attachments: [],
    auditTrail: [],
  };
}
