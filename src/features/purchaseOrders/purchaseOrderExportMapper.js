import {
  buildDetailExportColumns,
  mapDocumentsToDetailExportRows,
} from '../../utils/documentExportHelpers.js';

const PO_ITEM_KEYS = [
  'purchase_order_items',
  'purchaseOrderItems',
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

const poSupplier = (row) =>
  row?.supplier_name ??
  vendorDisplayName(row?.vendor_id) ??
  row?.supplier?.name ??
  row?.vendor_name ??
  '';

const poRef = (row) =>
  row?.purchase_order_no ??
  row?.po_no ??
  row?.order_no ??
  row?.reference ??
  row?.ref_no ??
  row?.invoice_no ??
  '';

const poStatus = (row) =>
  String(row?.order_status ?? row?.status ?? row?.purchase_order_status ?? row?.po_status ?? '');

const poTransaction = (row) => {
  const v =
    row?.transaction_number ?? row?.transactionNumber ?? row?.txn_no ?? row?.transaction_no ?? '';
  return v != null && String(v).trim() !== '' ? String(v) : '';
};

export const PURCHASE_ORDER_EXPORT_COLUMNS = buildDetailExportColumns({
  referenceLabel: 'Reference',
  partyLabel: 'Supplier',
});

export const PURCHASE_ORDER_ITEM_KEYS = PO_ITEM_KEYS;

export function mapPurchaseOrdersToExportRows(records) {
  return mapDocumentsToDetailExportRows(records, {
    itemKeys: PO_ITEM_KEYS,
    getReference: poRef,
    getTransaction: poTransaction,
    getStatus: poStatus,
    getParty: poSupplier,
    getDescription: (row) =>
      String(row?.notes ?? row?.remarks ?? row?.description ?? '').trim(),
  });
}
