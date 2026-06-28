import { ensureOfflineDbOpen, offlineDb } from '../db.js';
import { omitUndefined, pickRecordId } from '../utils/recordId.js';

function normalizeCustomer(record) {
  const _id = pickRecordId(record);
  if (!_id) return null;
  return omitUndefined({ ...record, _id });
}

export async function upsertCustomers(customers) {
  await ensureOfflineDbOpen();
  const rows = (Array.isArray(customers) ? customers : [])
    .map(normalizeCustomer)
    .filter(Boolean);
  if (rows.length === 0) return 0;
  await offlineDb.customers.bulkPut(rows);
  return rows.length;
}

export async function getCustomerById(id) {
  await ensureOfflineDbOpen();
  const key = String(id ?? '').trim();
  if (!key) return null;
  return (await offlineDb.customers.get(key)) ?? null;
}

export async function getAllCustomers() {
  await ensureOfflineDbOpen();
  return offlineDb.customers.toArray();
}

export async function countCustomers() {
  await ensureOfflineDbOpen();
  return offlineDb.customers.count();
}

export async function clearCustomers() {
  await ensureOfflineDbOpen();
  await offlineDb.customers.clear();
}

export async function replaceAllCustomers(customers) {
  await ensureOfflineDbOpen();
  await offlineDb.customers.clear();
  return upsertCustomers(customers);
}
