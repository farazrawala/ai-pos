import { BLOCKED_IMPORT_KEYS, normalizeHeader } from './productImportFields.js';

export const PRODUCT_IMPORT_MAX_BYTES = 25 * 1024 * 1024;
export const PRODUCT_IMPORT_MAX_ROWS = 20000;
export const PRODUCT_IMPORT_ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXCEL_MIME = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/haansoftxlsx',
]);

function readMagic(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return 'ole';
  }
  return 'text';
}

function extensionOf(fileName) {
  const name = String(fileName || '').toLowerCase();
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1) : '';
}

export function detectImportFormat(file) {
  const ext = extensionOf(file?.name);
  const mime = String(file?.type || '').toLowerCase();
  if (ext === 'csv' || mime === 'text/csv' || mime === 'text/plain') return 'csv';
  if (ext === 'xlsx' || ext === 'xls' || EXCEL_MIME.has(mime)) return 'excel';
  return ext || mime || 'unknown';
}

export function validateImportFile(file) {
  if (!file) return 'Please choose a file to import.';
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > PRODUCT_IMPORT_MAX_BYTES) {
    return `File is too large. Maximum size is ${Math.round(PRODUCT_IMPORT_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  const ext = extensionOf(file.name);
  if (!['csv', 'xls', 'xlsx'].includes(ext)) {
    return 'Unsupported file type. Upload a CSV, XLS, or XLSX file.';
  }
  return '';
}

function detectDelimiter(headerLine) {
  const counts = {
    ',': (headerLine.match(/,/g) || []).length,
    ';': (headerLine.match(/;/g) || []).length,
    '\t': (headerLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  if (!raw.trim()) {
    throw new Error('The file does not contain any data.');
  }

  const firstLineEnd = raw.search(/\r\n|\n|\r/);
  const firstLine = firstLineEnd === -1 ? raw : raw.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    current.push(cell);
    cell = '';
  };
  const pushRow = () => {
    const isEmpty = current.every((value) => String(value).trim() === '');
    if (!isEmpty) rows.push(current);
    current = [];
  };

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      pushCell();
      continue;
    }
    if (ch === '\r') {
      pushCell();
      pushRow();
      if (next === '\n') i += 1;
      continue;
    }
    if (ch === '\n') {
      pushCell();
      pushRow();
      continue;
    }
    cell += ch;
  }
  pushCell();
  if (current.length > 1 || String(current[0] || '').trim() !== '') pushRow();

  if (rows.length === 0) {
    throw new Error('The file does not contain any rows.');
  }

  return rows;
}

function uniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = String(header ?? '').trim() || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function matrixToTable(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('The spreadsheet is empty.');
  }
  const headerRow = matrix[0] || [];
  const headers = uniqueHeaders(headerRow.map((cell) => String(cell ?? '').trim()));
  const blocked = headers.filter((header) => BLOCKED_IMPORT_KEYS.has(normalizeHeader(header).replace(/\s+/g, '')));
  if (blocked.length > 0) {
    // Keep the columns for display, but mapping will skip them.
  }

  const dataRows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] || [];
    const isEmpty = raw.every((cell) => String(cell ?? '').trim() === '');
    if (isEmpty) continue;
    const row = headers.map((_, col) => {
      const value = raw[col];
      if (value == null) return '';
      if (value instanceof Date) return value.toISOString();
      return String(value).trim();
    });
    dataRows.push(row);
    if (dataRows.length >= PRODUCT_IMPORT_MAX_ROWS) break;
  }

  if (dataRows.length === 0) {
    throw new Error('No data rows were found under the header row.');
  }

  return {
    headers,
    rows: dataRows,
    truncated: matrix.length - 1 > dataRows.length,
  };
}

async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const magic = readMagic(buffer);
  const ext = extensionOf(file.name);
  if (ext === 'xlsx' && magic !== 'zip') {
    throw new Error('This file is not a valid XLSX workbook.');
  }
  if (ext === 'xls' && magic !== 'ole' && magic !== 'zip') {
    throw new Error('This file is not a valid Excel workbook.');
  }

  const mod = await import('xlsx');
  const XLSX = mod.default || mod;
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    throw new Error('The workbook does not contain any sheets.');
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  return matrixToTable(matrix);
}

async function parseCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const magic = readMagic(buffer);
  if (magic === 'zip' || magic === 'ole') {
    throw new Error('This file looks like an Excel workbook. Please upload it as XLS or XLSX.');
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return matrixToTable(parseCsvText(text));
}

export async function parseProductImportFile(file) {
  const fileError = validateImportFile(file);
  if (fileError) throw new Error(fileError);

  const ext = extensionOf(file.name);
  const parsed = ext === 'csv' ? await parseCsvFile(file) : await parseExcelFile(file);

  return {
    fileName: file.name,
    fileSize: file.size,
    headers: parsed.headers,
    rows: parsed.rows,
    truncated: Boolean(parsed.truncated),
    totalRows: parsed.rows.length,
  };
}
