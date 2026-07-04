/** Validate IPv4 for printer IP fields. */
export function isValidPrinterIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return false;
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

export function isValidPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

export function validatePrinterPayload(data = {}) {
  const errors = {};
  if (!String(data.name || '').trim()) errors.name = 'Printer name is required';
  if (!isValidPrinterIp(data.ip_address ?? data.ipAddress)) {
    errors.ip_address = 'Enter a valid IPv4 address';
  }
  if (!isValidPort(data.port ?? 9100)) errors.port = 'Port must be 1–65535';
  return errors;
}

export function normalizePrinterRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    _id: row._id ?? row.id ?? '',
    name: row.name ?? '',
    ip_address: row.ip_address ?? row.ipAddress ?? '',
    port: Number(row.port) || 9100,
    printer_type: row.printer_type ?? row.printerType ?? 'esc_pos',
    paper_width: row.paper_width ?? row.paperWidth ?? '80mm',
    character_encoding: row.character_encoding ?? row.characterEncoding ?? 'utf8',
    copies: Math.max(1, Number(row.copies) || 1),
    auto_cut: row.auto_cut !== false && row.autoCut !== false,
    open_cash_drawer: Boolean(row.open_cash_drawer ?? row.openCashDrawer),
    status: row.status === 'disabled' ? 'disabled' : 'enabled',
    department: row.department ?? '',
  };
}

export function normalizeTemplateRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    _id: row._id ?? row.id ?? '',
    name: row.name ?? 'Default Receipt',
    ...row,
  };
}

export function normalizeAssignmentRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    _id: row._id ?? row.id ?? '',
    department: row.department ?? '',
    printer_id: row.printer_id ?? row.printerId ?? '',
  };
}

export function normalizeCategoryLinkRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    _id: row._id ?? row.id ?? '',
    category_id: row.category_id ?? row.categoryId ?? '',
    printer_id: row.printer_id ?? row.printerId ?? '',
  };
}
