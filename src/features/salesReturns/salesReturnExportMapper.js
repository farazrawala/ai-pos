import {
  buildDetailExportColumns,
  mapDocumentsToDetailExportRows,
} from '../../utils/documentExportHelpers.js';

const SR_ITEM_KEYS = [
  'sales_return_items',
  'salesReturnItems',
  'sales_order_return_items',
  'items',
  'lines',
  'products',
];

const customerDisplayName = (customer) => {
  if (customer == null || typeof customer !== 'object' || Array.isArray(customer)) return '';
  const n =
    customer.name ??
    customer.customer_name ??
    customer.business_name ??
    customer.company_name ??
    customer.full_name ??
    '';
  return String(n).trim();
};

const srCustomer = (row) =>
  row?.customer_name ??
  customerDisplayName(row?.customer_id) ??
  row?.customer?.name ??
  '';

const srRef = (row) =>
  row?.sales_return_no ??
  row?.salesReturnNo ??
  row?.sales_order_no ??
  row?.reference ??
  row?.ref_no ??
  '';

const srStatus = (row) =>
  String(
    row?.return_status ??
      row?.returnStatus ??
      row?.order_status ??
      row?.status ??
      row?.sales_order_status ??
      ''
  );

const srTransaction = (row) => {
  const v =
    row?.transaction_number ?? row?.transactionNumber ?? row?.txn_no ?? row?.transaction_no ?? '';
  return v != null && String(v).trim() !== '' ? String(v) : '';
};

export const SALES_RETURN_EXPORT_COLUMNS = buildDetailExportColumns({
  referenceLabel: 'Return no',
  partyLabel: 'Customer',
});

export const SALES_RETURN_ITEM_KEYS = SR_ITEM_KEYS;

export function mapSalesReturnsToExportRows(records) {
  return mapDocumentsToDetailExportRows(records, {
    itemKeys: SR_ITEM_KEYS,
    getReference: srRef,
    getTransaction: srTransaction,
    getStatus: srStatus,
    getParty: srCustomer,
    getDescription: (row) =>
      String(row?.notes ?? row?.remarks ?? row?.description ?? '').trim(),
  });
}
