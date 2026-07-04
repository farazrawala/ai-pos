/** Printer hardware / layout types. */
export const PRINTER_TYPES = [
  { value: 'esc_pos', label: 'ESC/POS Thermal' },
  { value: 'network', label: 'Standard Network Printer' },
];

export const PAPER_WIDTHS = [
  { value: '58mm', label: '58mm' },
  { value: '80mm', label: '80mm' },
  { value: 'a4', label: 'A4' },
];

export const CHARACTER_ENCODINGS = [
  { value: 'utf8', label: 'UTF-8' },
  { value: 'cp437', label: 'CP437 (PC USA)' },
  { value: 'cp850', label: 'CP850 (Multilingual)' },
];

export const PRINTER_STATUSES = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

/** Department / station assignment targets. */
export const PRINTER_DEPARTMENTS = [
  { value: 'sales_counter', label: 'Sales Counter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bar', label: 'Bar' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'warehouse', label: 'Warehouse' },
];

export const PRINT_JOB_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'printing', label: 'Printing' },
  { value: 'printed', label: 'Printed' },
  { value: 'failed', label: 'Failed' },
];

export const CONNECTION_TEST_RESULTS = {
  online: 'Online',
  offline: 'Offline',
  timeout: 'Timeout',
  refused: 'Connection Refused',
  error: 'Error',
};

export const DEFAULT_PRINTER = {
  name: '',
  ip_address: '',
  port: 9100,
  printer_type: 'esc_pos',
  paper_width: '80mm',
  character_encoding: 'utf8',
  copies: 1,
  auto_cut: true,
  open_cash_drawer: false,
  status: 'enabled',
};

export const DEFAULT_RECEIPT_TEMPLATE = {
  name: 'Default Receipt',
  show_logo: true,
  show_business_name: true,
  show_address: true,
  show_phone: true,
  show_gst: true,
  show_invoice_number: true,
  show_customer_name: true,
  show_cashier: true,
  show_date: true,
  show_items: true,
  show_qty: true,
  show_price: true,
  show_discount: true,
  show_tax: true,
  show_grand_total: true,
  show_qr_code: false,
  show_barcode: false,
  footer_text: 'Thank You',
};

export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:17890';

export const BRIDGE_STORAGE_KEY = 'posPrintBridgeUrl';
