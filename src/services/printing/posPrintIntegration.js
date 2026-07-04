import moment from 'moment';
import {
  fetchPrintersRequest,
  fetchPrinterTemplatesRequest,
  fetchPrinterAssignmentsRequest,
  fetchPrinterCategoryLinksRequest,
} from '../../features/printers/printersAPI.js';
import { DEFAULT_RECEIPT_TEMPLATE } from '../../features/printers/printerConstants.js';
import { printerService, loadBridgeUrl } from './index.js';

const CONFIG_CACHE_MS = 30_000;
let cachedConfig = null;
let cacheTimestamp = 0;

function mapThermalReceiptToRenderer(receipt, payment) {
  const paid = Number(payment?.paid ?? receipt?.summary?.paymentMade ?? 0);
  const total = Number(receipt?.summary?.total ?? receipt?.grossAmount ?? 0);
  return {
    invoiceNo: receipt.invoiceNo,
    customerName: receipt.billTo?.name || receipt.customerName,
    cashier: receipt.cashier,
    date: receipt.invoiceDate || moment().format('D MMM YYYY, h:mm a'),
    lines: (receipt.lines || []).map((line) => ({
      name: line.description || line.name,
      qty: parseFloat(String(line.qtyLabel || line.qty || 1).replace(/,/g, '')) || 1,
      price: line.rate ?? line.price ?? 0,
      amount: line.amount ?? 0,
    })),
    discount: receipt.summary?.discount ?? 0,
    tax: receipt.summary?.tax ?? 0,
    total,
    change: payment?.change ?? Math.max(0, paid - total),
  };
}

async function loadPrintConfig(force = false) {
  if (!force && cachedConfig && Date.now() - cacheTimestamp < CONFIG_CACHE_MS) {
    return cachedConfig;
  }
  const [printers, templates, assignments, categoryLinks] = await Promise.all([
    fetchPrintersRequest(),
    fetchPrinterTemplatesRequest(),
    fetchPrinterAssignmentsRequest(),
    fetchPrinterCategoryLinksRequest(),
  ]);
  const printersById = {};
  for (const p of printers) printersById[String(p._id)] = p;

  const assignmentByDept = {};
  for (const a of assignments) assignmentByDept[a.department] = a.printer_id;

  const categoryPrinterMap = {};
  for (const link of categoryLinks) {
    categoryPrinterMap[String(link.category_id)] = String(link.printer_id);
  }

  cachedConfig = {
    printers,
    printersById,
    template: templates[0] || DEFAULT_RECEIPT_TEMPLATE,
    salesPrinterId: assignmentByDept.sales_counter,
    categoryPrinterMap,
  };
  cacheTimestamp = Date.now();
  return cachedConfig;
}

/** Whether a print bridge URL is configured (required for network printing in browsers). */
export function isNetworkPrintConfigured() {
  return Boolean(loadBridgeUrl());
}

/**
 * Print POS receipt + category-split kitchen tickets via local print bridge.
 * Returns true when at least the receipt job was queued; false to fall back to browser print.
 */
export async function printPosOrderViaBridge({
  receipt,
  payment,
  companyBrand,
  cartLines = [],
  invoiceNo,
  defaultPrinter,
}) {
  if (!isNetworkPrintConfigured()) return false;

  try {
    await printerService.bridge.healthCheck();
  } catch {
    return false;
  }

  const config = await loadPrintConfig();
  let salesPrinter = config.salesPrinterId
    ? config.printersById[String(config.salesPrinterId)]
    : null;

  if (!salesPrinter && defaultPrinter?.status === 'enabled' && defaultPrinter?.ip_address) {
    salesPrinter = defaultPrinter;
  }

  if (!salesPrinter) {
    salesPrinter = config.printers.find((p) => p.status === 'enabled');
  }

  if (!salesPrinter || salesPrinter.status === 'disabled') return false;

  const company = {
    name: companyBrand?.name || receipt.shopName,
    company_name: companyBrand?.name || receipt.shopName,
    address: companyBrand?.address,
    phone: companyBrand?.phone,
    gst: companyBrand?.gst || companyBrand?.tax_number,
  };

  await printerService.printReceipt({
    printer: salesPrinter,
    template: config.template,
    company,
    receipt: mapThermalReceiptToRenderer(receipt, payment),
  });

  const kitchenLines = (cartLines || []).map((line) => ({
    name: line.name,
    qty: parseFloat(String(line.quantity || 1).replace(/,/g, '')) || 1,
    category_id: line.category_id ?? line.categoryId,
    note: line.note,
  }));

  if (kitchenLines.some((l) => l.category_id)) {
    printerService.splitAndPrintOrder({
      lines: kitchenLines,
      categoryPrinterMap: config.categoryPrinterMap,
      printersById: config.printersById,
      orderMeta: {
        orderNo: invoiceNo || receipt.invoiceNo,
        date: moment().format('h:mm a'),
      },
    });
  }

  return true;
}

export function invalidatePrintConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}
