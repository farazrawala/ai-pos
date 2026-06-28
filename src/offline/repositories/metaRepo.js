import { ensureOfflineDbOpen, META_KEYS, offlineDb } from '../db.js';

export { META_KEYS };

export async function getMeta(key) {
  await ensureOfflineDbOpen();
  const row = await offlineDb.meta.get(String(key));
  return row?.value ?? null;
}

export async function setMeta(key, value) {
  await ensureOfflineDbOpen();
  await offlineDb.meta.put({ key: String(key), value });
  return value;
}

export async function getMetaNumber(key, fallback = 0) {
  const value = await getMeta(key);
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function incrementMetaNumber(key, delta = 1) {
  const current = await getMetaNumber(key, 0);
  const next = current + delta;
  await setMeta(key, next);
  return next;
}

export async function getAllMeta() {
  await ensureOfflineDbOpen();
  const rows = await offlineDb.meta.toArray();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function clearMeta() {
  await ensureOfflineDbOpen();
  await offlineDb.meta.clear();
}
