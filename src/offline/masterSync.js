import { fetchAccountsRequest } from '../features/accounts/accountsAPI.js';
import { fetchCategoriesRequest } from '../features/categories/categoriesAPI.js';
import {
  extractCompanyFromUser,
  fetchCompanyById,
  getCompanyFromApiBody,
  getCompanyIdFromUser,
  getWarehouseIdFromCompany,
  mergeCompanyRecordForSettings,
} from '../features/company/companyAPI.js';
import { fetchProductsRequest } from '../features/products/productsAPI.js';
import { fetchUsersListRequest } from '../features/users/usersAPI.js';
import { META_KEYS, ensureOfflineDbOpen } from './db.js';
import { setCompanySettings } from './repositories/companySettingsRepo.js';
import { replaceAllCategories } from './repositories/categoriesRepo.js';
import { replaceAllCustomers } from './repositories/customersRepo.js';
import { getMeta, setMeta } from './repositories/metaRepo.js';
import { replaceAllPaymentMethods } from './repositories/paymentMethodsRepo.js';
import { replaceAllProducts } from './repositories/productsRepo.js';

/** Re-sync catalog when last download is older than this (4 hours). */
export const MASTER_SYNC_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export const MASTER_SYNC_PAGE_SIZE = 500;

export const MASTER_SYNC_PHASE = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  CUSTOMERS: 'customers',
  PAYMENT_METHODS: 'payment_methods',
  COMPANY: 'company',
  DONE: 'done',
};

let activeSyncPromise = null;

function normalizeRoles(role) {
  if (!role) return [];
  const list = Array.isArray(role) ? role : [role];
  return list.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean);
}

/** True when the logged-in user can open POS (admin or `pos.view`). */
export function userHasPosModuleAccess(user) {
  if (!user || typeof user !== 'object') return false;
  if (normalizeRoles(user.role).includes('ADMIN')) return true;
  return Boolean(user.permissions?.pos?.view);
}

export async function getLastMasterSyncAt() {
  await ensureOfflineDbOpen();
  const value = await getMeta(META_KEYS.LAST_MASTER_SYNC_AT);
  return value ? String(value) : null;
}

export async function isMasterSyncStale(maxAgeMs = MASTER_SYNC_MAX_AGE_MS) {
  const last = await getLastMasterSyncAt();
  if (!last) return true;
  const ts = Date.parse(last);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > maxAgeMs;
}

async function clearMasterDataCaches() {
  await Promise.all([
    replaceAllProducts([]),
    replaceAllCategories([]),
    replaceAllCustomers([]),
    replaceAllPaymentMethods([]),
    setCompanySettings(null),
  ]);
}

async function fetchAllPaginatedRecords(fetchPage, { pageSize, onProgress, phase, label }) {
  let page = 1;
  let all = [];
  let total = 0;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchPage(page, pageSize);
    const batch = Array.isArray(result?.data) ? result.data : [];
    all = all.concat(batch);
    total = Number(result?.total) || all.length;
    totalPages = Number(result?.totalPages) || 1;

    onProgress?.({
      phase,
      message: `Downloading ${label}… ${all.length}/${total || '?'}`,
      loaded: all.length,
      total: total || null,
    });

    if (!batch.length) break;
    if (batch.length < pageSize) break;
    if (totalPages > 0 && page >= totalPages) break;
    page += 1;
  }

  return all;
}

async function fetchAllProducts(onProgress) {
  return fetchAllPaginatedRecords(
    (page, limit) => fetchProductsRequest({ page, limit }),
    {
      pageSize: MASTER_SYNC_PAGE_SIZE,
      onProgress,
      phase: MASTER_SYNC_PHASE.PRODUCTS,
      label: 'products',
    }
  );
}

async function fetchAllCategories(onProgress) {
  return fetchAllPaginatedRecords(
    (page, limit) => fetchCategoriesRequest({ page, limit }),
    {
      pageSize: MASTER_SYNC_PAGE_SIZE,
      onProgress,
      phase: MASTER_SYNC_PHASE.CATEGORIES,
      label: 'categories',
    }
  );
}

async function fetchAllCustomers(onProgress) {
  const pageSize = MASTER_SYNC_PAGE_SIZE;
  let skip = 0;
  let all = [];

  while (true) {
    const batch = await fetchUsersListRequest({
      limit: pageSize,
      skip,
      role: 'CUSTOMER',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    const rows = Array.isArray(batch) ? batch : [];
    all = all.concat(rows);

    onProgress?.({
      phase: MASTER_SYNC_PHASE.CUSTOMERS,
      message: `Downloading customers… ${all.length}${rows.length < pageSize ? '' : '+'}`,
      loaded: all.length,
      total: rows.length < pageSize ? all.length : null,
    });

    if (rows.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function fetchAllPaymentMethods(onProgress) {
  return fetchAllPaginatedRecords(
    (page, limit) =>
      fetchAccountsRequest({
        page,
        limit,
        account_type: 'current_asset',
        sortBy: 'createdAt',
        sortOrder: 'asc',
      }),
    {
      pageSize: MASTER_SYNC_PAGE_SIZE,
      onProgress,
      phase: MASTER_SYNC_PHASE.PAYMENT_METHODS,
      label: 'payment methods',
    }
  );
}

async function downloadCompanySettings(companyId, companyRecord, onProgress) {
  onProgress?.({
    phase: MASTER_SYNC_PHASE.COMPANY,
    message: 'Downloading company settings…',
    loaded: 0,
    total: 1,
  });

  let company = companyRecord && typeof companyRecord === 'object' ? companyRecord : null;

  if (companyId) {
    try {
      const body = await fetchCompanyById(companyId);
      const fetched = getCompanyFromApiBody(body);
      if (fetched) {
        company = mergeCompanyRecordForSettings(fetched, company);
      }
    } catch (err) {
      console.warn('[masterSync] Could not fetch company settings', err);
      if (!company) {
        throw new Error('Could not download company settings');
      }
    }
  }

  await setCompanySettings(company);
  return company;
}

/**
 * Download POS master data into IndexedDB while online.
 * @param {object} [options]
 * @param {string} [options.companyId]
 * @param {string} [options.warehouseId]
 * @param {object|null} [options.companyRecord]
 * @param {boolean} [options.force] - Run even if another sync is in progress
 * @param {(progress: { phase: string, message: string, loaded?: number, total?: number|null }) => void} [options.onProgress]
 */
export async function runMasterSync(options = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Connect to the internet to download catalog');
  }

  const companyId = String(options.companyId ?? '').trim();
  if (!companyId) {
    throw new Error('Company id is required for master sync');
  }

  if (activeSyncPromise && !options.force) {
    return activeSyncPromise;
  }

  const syncJob = performMasterSync(options);
  activeSyncPromise = syncJob.finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}

async function performMasterSync(options = {}) {
  const companyId = String(options.companyId ?? '').trim();
  const warehouseId =
    String(options.warehouseId ?? '').trim() ||
    getWarehouseIdFromCompany(options.companyRecord) ||
    '';
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  await ensureOfflineDbOpen();

  const previousCompanyId = String((await getMeta(META_KEYS.COMPANY_ID)) ?? '').trim();
  if (previousCompanyId && previousCompanyId !== companyId) {
    await clearMasterDataCaches();
  }

  const products = await fetchAllProducts(onProgress);
  await replaceAllProducts(products);

  const categories = await fetchAllCategories(onProgress);
  await replaceAllCategories(categories);

  const customers = await fetchAllCustomers(onProgress);
  await replaceAllCustomers(customers);

  const paymentMethods = await fetchAllPaymentMethods(onProgress);
  await replaceAllPaymentMethods(paymentMethods);

  const company = await downloadCompanySettings(companyId, options.companyRecord, onProgress);
  const resolvedWarehouseId = warehouseId || getWarehouseIdFromCompany(company) || '';

  await setMeta(META_KEYS.LAST_MASTER_SYNC_AT, new Date().toISOString());
  await setMeta(META_KEYS.COMPANY_ID, companyId);
  await setMeta(META_KEYS.WAREHOUSE_ID, resolvedWarehouseId);
  await setMeta(META_KEYS.SYNC_VERSION, 1);

  const summary = {
    products: products.length,
    categories: categories.length,
    customers: customers.length,
    paymentMethods: paymentMethods.length,
    companyId,
    warehouseId: resolvedWarehouseId,
    syncedAt: new Date().toISOString(),
  };

  onProgress?.({
    phase: MASTER_SYNC_PHASE.DONE,
    message: 'Catalog ready for offline use',
    loaded: products.length,
    total: products.length,
  });

  return summary;
}

/** Fire-and-forget master sync after login when POS is enabled. */
export function triggerMasterSyncAfterLogin(user, companyRecord = null) {
  if (!userHasPosModuleAccess(user)) return;

  const company = companyRecord || extractCompanyFromUser(user);
  const companyId =
    getCompanyIdFromUser(user) || String(company?._id ?? company?.id ?? '').trim();
  if (!companyId) return;

  const warehouseId = getWarehouseIdFromCompany(company);

  runMasterSync({
    companyId,
    warehouseId,
    companyRecord: company,
    force: true,
  }).catch((err) => {
    console.warn('[masterSync] Background sync after login failed', err);
  });
}
