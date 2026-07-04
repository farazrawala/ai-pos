import moment from 'moment';
import { getProductAvailableStock } from '../../utils/productStock.js';

const warehouseNameFromInventoryRow = (row) => {
  if (!row || typeof row !== 'object') return 'Warehouse';
  const w = row.warehouse_id ?? row.warehouseId;
  if (w && typeof w === 'object' && !Array.isArray(w)) {
    const n = w.name ?? w.warehouse_name ?? w.title;
    if (n != null && String(n).trim() !== '') return String(n).trim();
  }
  if (w != null && typeof w !== 'object') return String(w);
  const fallback = row.warehouse_name ?? row.warehouseName;
  return fallback != null && String(fallback).trim() !== '' ? String(fallback).trim() : 'Warehouse';
};

const formatQty = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toLocaleString();
};

const formatMoney = (value) => {
  if (value == null || value === '') return '';
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const productStatusLabel = (item) => {
  if (item?.status === 'active' || item?.isActive || item?.status === 1) return 'Active';
  if (item?.status === 'inactive' || item?.status === 0) return 'Inactive';
  const raw = item?.status;
  return raw == null || raw === '' ? '' : String(raw);
};

const warehouseStockSummary = (item) => {
  const inv = item?.warehouse_inventory ?? item?.warehouseInventory;
  if (!Array.isArray(inv) || inv.length === 0) return '';
  return inv
    .map((row) => `${warehouseNameFromInventoryRow(row)}: ${formatQty(Number(row?.quantity) || 0)}`)
    .join('; ');
};

export const PRODUCT_EXPORT_COLUMNS = [
  { key: 'sr', label: '#' },
  { key: 'name', label: 'Name' },
  { key: 'productCode', label: 'Product code' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'productType', label: 'Type' },
  { key: 'price', label: 'Price (PKR)' },
  { key: 'wholesalePrice', label: 'Wholesale (PKR)' },
  { key: 'taxRate', label: 'Tax (%)' },
  { key: 'alertQty', label: 'Alert qty' },
  { key: 'totalStock', label: 'Total stock' },
  { key: 'warehouseStock', label: 'Stock by warehouse' },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Created' },
];

/** @param {object[]} records */
export function mapProductsToExportRows(records) {
  if (!Array.isArray(records)) return [];

  return records.map((item, index) => {
    const stock = getProductAvailableStock(item);
    const taxRate = item?.tax_rate ?? item?.taxRate;
    const alertQty = item?.alert_qty ?? item?.alertQty;
    const created = item?.createdAt ?? item?.created_at;

    return {
      sr: index + 1,
      name: item?.name || item?.product_name || '',
      productCode: item?.product_code || item?.code || '',
      sku: item?.sku || '',
      barcode: item?.barcode ? String(item.barcode) : '',
      productType: item?.product_type || item?.productType || '',
      price: formatMoney(item?.price ?? item?.product_price),
      wholesalePrice: formatMoney(item?.wholesale_price ?? item?.wholesalePrice),
      taxRate:
        taxRate == null || taxRate === ''
          ? ''
          : (() => {
              const n = parseFloat(taxRate);
              return Number.isFinite(n) ? String(n) : String(taxRate);
            })(),
      alertQty: alertQty == null || alertQty === '' ? '' : String(alertQty),
      totalStock: formatQty(stock),
      warehouseStock: warehouseStockSummary(item),
      status: productStatusLabel(item),
      created: created ? moment(created).format('MM-DD-YYYY h:mm a') : '',
    };
  });
}
