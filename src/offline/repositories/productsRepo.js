import { isProductInactive } from '../../components/product/productVariationUtils.js';
import { ensureOfflineDbOpen, offlineDb } from '../db.js';
import { omitUndefined, pickRecordId } from '../utils/recordId.js';

function normalizeProduct(record) {
  const _id = pickRecordId(record);
  if (!_id) return null;

  const skuRaw = record.sku ?? record.product_code ?? '';
  const barcodeRaw = record.barcode ?? '';
  const categoryRaw = record.category_id ?? record.categoryId ?? '';

  return omitUndefined({
    ...record,
    _id,
    sku: skuRaw != null && String(skuRaw).trim() !== '' ? String(skuRaw).trim() : undefined,
    barcode:
      barcodeRaw != null && String(barcodeRaw).trim() !== '' ? String(barcodeRaw).trim() : undefined,
    category_id:
      categoryRaw != null && String(categoryRaw).trim() !== ''
        ? String(categoryRaw).trim()
        : undefined,
  });
}

export async function upsertProducts(products) {
  await ensureOfflineDbOpen();
  const rows = (Array.isArray(products) ? products : [])
    .map(normalizeProduct)
    .filter(Boolean);
  if (rows.length === 0) return 0;
  await offlineDb.products.bulkPut(rows);
  return rows.length;
}

export async function getProductById(id) {
  await ensureOfflineDbOpen();
  const key = String(id ?? '').trim();
  if (!key) return null;
  return (await offlineDb.products.get(key)) ?? null;
}

export async function getAllProducts() {
  await ensureOfflineDbOpen();
  return offlineDb.products.toArray();
}

export async function countProducts() {
  await ensureOfflineDbOpen();
  return offlineDb.products.count();
}

export async function getProductsByCategory(categoryId) {
  await ensureOfflineDbOpen();
  const key = String(categoryId ?? '').trim();
  if (!key) return getAllProducts();
  return offlineDb.products.where('category_id').equals(key).toArray();
}

export async function getProductByBarcode(barcode) {
  await ensureOfflineDbOpen();
  const key = String(barcode ?? '').trim();
  if (!key) return null;
  return (await offlineDb.products.where('barcode').equals(key).first()) ?? null;
}

export async function getProductBySku(sku) {
  await ensureOfflineDbOpen();
  const key = String(sku ?? '').trim();
  if (!key) return null;
  return (await offlineDb.products.where('sku').equals(key).first()) ?? null;
}

export async function clearProducts() {
  await ensureOfflineDbOpen();
  await offlineDb.products.clear();
}

export async function replaceAllProducts(products) {
  await ensureOfflineDbOpen();
  await offlineDb.products.clear();
  return upsertProducts(products);
}

function normalizeSearchToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function productMatchesSearchQuery(product, query) {
  const needle = normalizeSearchToken(query);
  if (!needle) return true;
  const haystacks = [
    product?.barcode,
    product?.sku,
    product?.product_code,
    product?.product_name,
    product?.name,
  ];
  return haystacks.some((value) => value != null && normalizeSearchToken(value).includes(needle));
}

function matchesCategoryFilter(product, categoryId) {
  if (!categoryId) return true;
  const productCategory = String(product?.category_id ?? product?.categoryId ?? '').trim();
  return productCategory === String(categoryId).trim();
}

function matchesStatusFilter(product, status) {
  const key = String(status ?? '').trim().toLowerCase();
  if (!key || key === 'all') return true;
  if (key === 'inactive') return isProductInactive(product);
  if (key === 'active') return !isProductInactive(product);
  return true;
}

/** Search cached products by text and Dexie indexes (sku, barcode, category_id). */
export async function searchProducts({ query = '', categoryId, status } = {}) {
  await ensureOfflineDbOpen();
  const q = String(query ?? '').trim();
  const cat = categoryId ? String(categoryId).trim() : '';

  const baseRows = cat ? await getProductsByCategory(cat) : await getAllProducts();
  const filterByStatus = (rows) => rows.filter((p) => matchesStatusFilter(p, status));

  if (!q) return filterByStatus(baseRows);

  const matches = new Map();

  const byBarcode = await getProductByBarcode(q);
  if (byBarcode && matchesCategoryFilter(byBarcode, cat)) {
    matches.set(byBarcode._id, byBarcode);
  }

  const bySku = await getProductBySku(q);
  if (bySku && matchesCategoryFilter(bySku, cat)) {
    matches.set(bySku._id, bySku);
  }

  for (const product of baseRows) {
    if (productMatchesSearchQuery(product, q)) {
      matches.set(product._id, product);
    }
  }

  return filterByStatus(Array.from(matches.values()));
}

export async function lookupProductsForScan(query, categoryId) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  return searchProducts({ query: q, categoryId });
}
