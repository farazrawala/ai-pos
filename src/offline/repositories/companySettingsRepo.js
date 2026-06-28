import { COMPANY_SETTINGS_KEY, ensureOfflineDbOpen, offlineDb } from '../db.js';

export async function setCompanySettings(company) {
  await ensureOfflineDbOpen();
  await offlineDb.company_settings.put({
    key: COMPANY_SETTINGS_KEY,
    value: company ?? null,
    updated_at: new Date().toISOString(),
  });
  return company ?? null;
}

export async function getCompanySettings() {
  await ensureOfflineDbOpen();
  const row = await offlineDb.company_settings.get(COMPANY_SETTINGS_KEY);
  return row?.value ?? null;
}

export async function clearCompanySettings() {
  await ensureOfflineDbOpen();
  await offlineDb.company_settings.clear();
}
