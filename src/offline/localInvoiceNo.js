import { META_KEYS } from './db.js';
import { incrementMetaNumber } from './repositories/metaRepo.js';

/** Local offline invoice number: `OFF-YYYYMMDD-NNN` (sequence resets daily). */
export async function nextLocalInvoiceNo(now = new Date()) {
  const dayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const seqKey = `${META_KEYS.OFFLINE_INVOICE_SEQ}_${dayKey}`;
  const seq = await incrementMetaNumber(seqKey, 1);
  return `OFF-${dayKey}-${String(seq).padStart(3, '0')}`;
}
