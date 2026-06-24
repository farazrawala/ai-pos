import { getProductAvailableStock } from './productStock.js';

/** @param {unknown} item */
export function getProductAlertQty(item) {
  const raw = item?.alert_qty ?? item?.alertQty;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** @param {unknown} item */
export function isLowStockProduct(item) {
  const alertQty = getProductAlertQty(item);
  if (alertQty <= 0) return false;
  const stock = getProductAvailableStock(item);
  if (stock == null) return false;
  return stock <= alertQty;
}

/** @param {unknown} item */
export function mapLowStockProductRow(item) {
  const stock = getProductAvailableStock(item) ?? 0;
  const alertQty = getProductAlertQty(item);
  const id = item?._id ?? item?.id ?? item?.product_id ?? '';
  const name = String(item?.name ?? item?.product_name ?? 'Product').trim() || 'Product';
  const code = String(item?.product_code ?? item?.sku ?? item?.barcode ?? '').trim();

  return {
    id: String(id),
    name,
    code,
    stock,
    alertQty,
    status: stock <= 0 ? 'out' : 'low',
  };
}

/** @param {unknown[]} products @param {number} [maxRows] */
export function pickLowStockProducts(products, maxRows = 20) {
  if (!Array.isArray(products)) return [];

  return products
    .filter(isLowStockProduct)
    .map(mapLowStockProductRow)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
    .slice(0, maxRows);
}
