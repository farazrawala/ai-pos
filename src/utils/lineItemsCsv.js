import { fetchProductActiveRequest } from '../features/products/productsAPI.js';
import { parseCsvText } from '../features/products/productImportParse.js';
import { exportRowsToCsv } from './listExport.js';
import { toast } from './toast.js';

/**
 * Line-item CSV shared by invoice, purchase order and sales return forms.
 * Columns: product_id, barcode, qty, rate (+ product_name, ignored on import).
 */

export const csvProductBarcode = (p) =>
  p && typeof p === 'object' ? String(p.barcode ?? p.product_barcode ?? '').trim() : '';

const productIdOf = (p) => String(p?._id ?? p?.id ?? '').trim();

const LINE_CSV_COLUMNS = [
  { key: 'productId', label: 'product_id' },
  { key: 'barcode', label: 'barcode' },
  { key: 'qty', label: 'qty' },
  { key: 'rate', label: 'rate' },
  { key: 'label', label: 'product_name' },
];

/** Run `fn` over `items` a few at a time so large files don't flood the API. */
export async function mapInChunks(items, fn, size = 5) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

function parseLineItemsCsv(text) {
  const [header, ...body] = parseCsvText(text);
  const norm = header.map((h) =>
    String(h ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );
  const col = (...names) => norm.findIndex((h) => names.includes(h));
  const idIdx = col('product_id', 'productid', '_id', 'id');
  const barcodeIdx = col('barcode');
  const qtyIdx = col('qty', 'quantity');
  const rateIdx = col('rate', 'price', 'unit_price');
  if (idIdx === -1 && barcodeIdx === -1) {
    throw new Error('CSV needs a product_id or barcode column.');
  }
  const cell = (row, idx) => (idx === -1 ? '' : String(row[idx] ?? '').trim());
  return body
    .map((row, i) => ({
      rowNumber: i + 2,
      productId: cell(row, idIdx),
      barcode: cell(row, barcodeIdx),
      qty: cell(row, qtyIdx),
      rate: cell(row, rateIdx),
    }))
    .filter((r) => r.productId || r.barcode);
}

const parseNumber = (raw) => {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Download `lines` ({ productId, barcode?, qty, rate, label }) as CSV.
 * Barcodes missing from the line state are looked up first.
 */
export async function exportLineItemsCsv(lines, filename) {
  const rows = (lines || []).filter((d) => String(d?.productId ?? '').trim());
  if (rows.length === 0) {
    toast.error('No line items to export.');
    return;
  }
  const missing = [...new Set(rows.filter((d) => !d.barcode).map((d) => String(d.productId)))];
  const barcodeById = new Map();
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    try {
      const res = await fetchProductActiveRequest({
        _id: chunk,
        includeInactive: true,
        page: 1,
        limit: chunk.length,
      });
      (res?.data || []).forEach((p) => barcodeById.set(productIdOf(p), csvProductBarcode(p)));
    } catch (err) {
      console.warn('[Line items CSV] Could not load barcodes for export', err);
    }
  }
  exportRowsToCsv({
    columns: LINE_CSV_COLUMNS,
    rows: rows.map((d) => ({
      ...d,
      barcode: d.barcode || barcodeById.get(String(d.productId)) || '',
    })),
    filename: String(filename || 'line-items').replace(/[^\w-]+/g, '_'),
  });
}

/**
 * Parse a CSV file and resolve each row to an active product (by product_id, then exact barcode).
 * @returns {Promise<{ matches: Array<{ product: object, qty: number|null, rate: number|null }>, notFound: number[] }>}
 */
export async function resolveLineItemsCsvFile(file) {
  const rows = parseLineItemsCsv(await file.text());
  if (rows.length === 0) throw new Error('No product rows found in the file.');

  const byId = new Map();
  const ids = [...new Set(rows.map((r) => r.productId).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await fetchProductActiveRequest({ _id: chunk, page: 1, limit: chunk.length });
    (res?.data || []).forEach((p) => byId.set(productIdOf(p), p));
  }

  const byBarcode = new Map();
  const barcodes = [
    ...new Set(rows.filter((r) => !byId.has(r.productId) && r.barcode).map((r) => r.barcode)),
  ];
  await mapInChunks(barcodes, async (code) => {
    const res = await fetchProductActiveRequest({
      search: code,
      searchFields: 'barcode',
      page: 1,
      limit: 5,
    });
    const hit = (res?.data || []).find((p) => csvProductBarcode(p) === code);
    if (hit) byBarcode.set(code, hit);
  });

  const matches = [];
  const notFound = [];
  rows.forEach((r) => {
    const product = byId.get(r.productId) || byBarcode.get(r.barcode);
    if (!product) {
      notFound.push(r.rowNumber);
      return;
    }
    const qty = parseNumber(r.qty);
    matches.push({ product, qty: qty != null && qty > 0 ? qty : null, rate: parseNumber(r.rate) });
  });
  return { matches, notFound };
}

/**
 * Merge imported lines into `prev`, one CSV row per line: the nth row for a product updates
 * the nth existing line for that product; extra rows are placed with `insert(list, line)`.
 * Re-importing an exported file therefore keeps repeated products as separate lines.
 */
export function mergeCsvLines(prev, imported, insert) {
  const existingKeys = new Map();
  prev.forEach((d) => {
    const pid = String(d.productId ?? '');
    if (!existingKeys.has(pid)) existingKeys.set(pid, []);
    existingKeys.get(pid).push(d.key);
  });
  const updates = new Map();
  let next = [...prev];
  imported.forEach((line) => {
    const key = existingKeys.get(String(line.productId ?? ''))?.shift();
    if (key !== undefined) updates.set(key, line);
    else next = insert(next, { ...line });
  });
  return next.map((d) => {
    const line = updates.get(d.key);
    return line ? { ...d, qty: line.qty, rate: line.rate } : d;
  });
}

export function reportLineItemsCsvImport(importedCount, notFound, saveHint = 'save') {
  if (importedCount > 0) {
    toast.success(`Imported ${importedCount} line item(s). Remember to ${saveHint}.`);
  }
  if (notFound.length > 0) {
    const shown = notFound.slice(0, 10).join(', ');
    toast.error(
      `${notFound.length} row(s) skipped, product not found (rows ${shown}${
        notFound.length > 10 ? '…' : ''
      }).`
    );
  }
}
