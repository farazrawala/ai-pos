import Dexie from 'dexie';

export const OFFLINE_DB_NAME = 'ai_pos_offline';

export const META_KEYS = {
  LAST_MASTER_SYNC_AT: 'last_master_sync_at',
  COMPANY_ID: 'company_id',
  WAREHOUSE_ID: 'warehouse_id',
  OFFLINE_INVOICE_SEQ: 'offline_invoice_seq',
  SYNC_VERSION: 'sync_version',
};

export const COMPANY_SETTINGS_KEY = 'company';

export const PENDING_ORDER_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
};

class OfflinePosDatabase extends Dexie {
  meta;

  products;

  categories;

  customers;

  payment_methods;

  company_settings;

  pending_orders;

  local_stock_adjustments;

  constructor() {
    super(OFFLINE_DB_NAME);

    this.version(1).stores({
      meta: 'key',
      products: '_id, sku, barcode, category_id',
      categories: '_id',
      customers: '_id',
      payment_methods: '_id',
      company_settings: 'key',
      pending_orders: 'client_order_id, status, created_at, local_invoice_no',
      local_stock_adjustments: '++id, product_id, warehouse_id, [product_id+warehouse_id]',
    });

    this.meta = this.table('meta');
    this.products = this.table('products');
    this.categories = this.table('categories');
    this.customers = this.table('customers');
    this.payment_methods = this.table('payment_methods');
    this.company_settings = this.table('company_settings');
    this.pending_orders = this.table('pending_orders');
    this.local_stock_adjustments = this.table('local_stock_adjustments');
  }
}

export const offlineDb = new OfflinePosDatabase();

let openPromise = null;

async function ensureOfflineDbOpen() {
  if (offlineDb.isOpen()) return offlineDb;
  if (!openPromise) {
    openPromise = offlineDb.open().finally(() => {
      openPromise = null;
    });
  }
  await openPromise;
  return offlineDb;
}

/** Returns true when IndexedDB opened successfully. */
export async function isOfflineDbReady() {
  try {
    await ensureOfflineDbOpen();
    return offlineDb.isOpen();
  } catch (err) {
    console.error('[offline] IndexedDB open failed', err);
    return false;
  }
}

/** Wipe all offline stores (logout / company switch). */
export async function clearOfflineDb() {
  await ensureOfflineDbOpen();
  await Promise.all([
    offlineDb.meta.clear(),
    offlineDb.products.clear(),
    offlineDb.categories.clear(),
    offlineDb.customers.clear(),
    offlineDb.payment_methods.clear(),
    offlineDb.company_settings.clear(),
    offlineDb.pending_orders.clear(),
    offlineDb.local_stock_adjustments.clear(),
  ]);
}

export { ensureOfflineDbOpen };
