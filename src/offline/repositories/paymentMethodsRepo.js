import { ensureOfflineDbOpen, offlineDb } from '../db.js';
import { omitUndefined, pickRecordId } from '../utils/recordId.js';

function normalizePaymentMethod(record) {
  const _id = pickRecordId(record);
  if (!_id) return null;
  return omitUndefined({ ...record, _id });
}

export async function upsertPaymentMethods(paymentMethods) {
  await ensureOfflineDbOpen();
  const rows = (Array.isArray(paymentMethods) ? paymentMethods : [])
    .map(normalizePaymentMethod)
    .filter(Boolean);
  if (rows.length === 0) return 0;
  await offlineDb.payment_methods.bulkPut(rows);
  return rows.length;
}

export async function getPaymentMethodById(id) {
  await ensureOfflineDbOpen();
  const key = String(id ?? '').trim();
  if (!key) return null;
  return (await offlineDb.payment_methods.get(key)) ?? null;
}

export async function getAllPaymentMethods() {
  await ensureOfflineDbOpen();
  return offlineDb.payment_methods.toArray();
}

export async function countPaymentMethods() {
  await ensureOfflineDbOpen();
  return offlineDb.payment_methods.count();
}

export async function clearPaymentMethods() {
  await ensureOfflineDbOpen();
  await offlineDb.payment_methods.clear();
}

export async function replaceAllPaymentMethods(paymentMethods) {
  await ensureOfflineDbOpen();
  await offlineDb.payment_methods.clear();
  return upsertPaymentMethods(paymentMethods);
}
