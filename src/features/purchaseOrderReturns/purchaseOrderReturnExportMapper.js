import {
  buildDetailExportColumns,
  mapDocumentsToDetailExportRows,
} from '../../utils/documentExportHelpers.js';

const POR_ITEM_KEYS = [
  'purchase_return_items',
  'purchaseReturnItems',
  'purchase_order_return_items',
  'items',
  'lines',
  'products',
];

const vendorDisplayName = (vendor) => {
  if (vendor == null || typeof vendor !== 'object' || Array.isArray(vendor)) return '';
  const n =
    vendor.name ??
    vendor.vendor_name ??
    vendor.business_name ??
    vendor.company_name ??
    vendor.full_name ??
    '';
  return String(n).trim();
};

const porSupplier = (row) =>
  row?.supplier_name ??
  vendorDisplayName(row?.vendor_id) ??
  row?.supplier?.name ??
  row?.vendor_name ??
  '';

const porRef = (row) =>
  row?.purchase_return_no ??
  row?.purchaseReturnNo ??
  row?.purchase_order_no ??
  row?.reference ??
  row?.ref_no ??
  '';

const porStatus = (row) =>
  String(
    row?.return_status ??
      row?.returnStatus ??
      row?.order_status ??
      row?.status ??
      row?.purchase_order_status ??
      ''
  );

const porTransaction = (row) => {
  const v =
    row?.transaction_number ?? row?.transactionNumber ?? row?.txn_no ?? row?.transaction_no ?? '';
  return v != null && String(v).trim() !== '' ? String(v) : '';
};

export const PURCHASE_ORDER_RETURN_EXPORT_COLUMNS = buildDetailExportColumns({
  referenceLabel: 'Return no',
  partyLabel: 'Supplier',
});

export const PURCHASE_ORDER_RETURN_ITEM_KEYS = POR_ITEM_KEYS;

export function mapPurchaseOrderReturnsToExportRows(records) {
  return mapDocumentsToDetailExportRows(records, {
    itemKeys: POR_ITEM_KEYS,
    getReference: porRef,
    getTransaction: porTransaction,
    getStatus: porStatus,
    getParty: porSupplier,
    getDescription: (row) =>
      String(row?.notes ?? row?.remarks ?? row?.description ?? '').trim(),
  });
}
