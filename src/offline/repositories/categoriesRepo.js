import { ensureOfflineDbOpen, offlineDb } from '../db.js';
import { omitUndefined, pickRecordId } from '../utils/recordId.js';

function normalizeCategory(record) {
  const _id = pickRecordId(record);
  if (!_id) return null;
  return omitUndefined({ ...record, _id });
}

export async function upsertCategories(categories) {
  await ensureOfflineDbOpen();
  const rows = (Array.isArray(categories) ? categories : [])
    .map(normalizeCategory)
    .filter(Boolean);
  if (rows.length === 0) return 0;
  await offlineDb.categories.bulkPut(rows);
  return rows.length;
}

export async function getCategoryById(id) {
  await ensureOfflineDbOpen();
  const key = String(id ?? '').trim();
  if (!key) return null;
  return (await offlineDb.categories.get(key)) ?? null;
}

export async function getAllCategories() {
  await ensureOfflineDbOpen();
  return offlineDb.categories.toArray();
}

export async function countCategories() {
  await ensureOfflineDbOpen();
  return offlineDb.categories.count();
}

export async function clearCategories() {
  await ensureOfflineDbOpen();
  await offlineDb.categories.clear();
}

export async function replaceAllCategories(categories) {
  await ensureOfflineDbOpen();
  await offlineDb.categories.clear();
  return upsertCategories(categories);
}
