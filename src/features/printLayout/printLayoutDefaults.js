/** Document types available in the layout designer. */
export const DOCUMENT_TYPES = [
  { value: 'sales_invoice', label: 'Sales Invoice' },
  { value: 'purchase_invoice', label: 'Purchase Invoice' },
];

export const DOCUMENT_TITLES = {
  sales_invoice: 'SALES INVOICE',
  purchase_invoice: 'PURCHASE INVOICE',
};

/** Paper sizes for the live preview canvas. Dimensions in millimetres (portrait). */
export const PAPER_SIZE_OPTIONS = [
  { value: 'a3', label: 'A3', description: '297 × 420 mm' },
  { value: 'a4', label: 'A4', description: '210 × 297 mm' },
  { value: 'a5', label: 'A5', description: '148 × 210 mm' },
  { value: 'a6', label: 'A6', description: '105 × 148 mm' },
  { value: 'b4', label: 'B4', description: '250 × 353 mm' },
  { value: 'b5', label: 'B5', description: '176 × 250 mm' },
  { value: 'letter', label: 'Letter', description: '216 × 279 mm' },
  { value: 'legal', label: 'Legal', description: '216 × 356 mm' },
  { value: 'tabloid', label: 'Tabloid', description: '279 × 432 mm' },
  { value: 'executive', label: 'Executive', description: '184 × 267 mm' },
  { value: 'custom', label: 'Custom', description: 'User defined' },
];

/** Portrait width/height in mm. Landscape swaps width ↔ height. */
export const PAPER_DIMENSIONS_MM = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  b4: { width: 250, height: 353 },
  b5: { width: 176, height: 250 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
  tabloid: { width: 279, height: 432 },
  executive: { width: 184, height: 267 },
};

export function getPaperDimensions(page = {}) {
  const orientation = page.orientation === 'landscape' ? 'landscape' : 'portrait';
  let widthMm;
  let heightMm;

  if (page.paperSize === 'custom') {
    widthMm = Number(page.customWidthMm) || 210;
    heightMm = Number(page.customHeightMm) || 297;
  } else {
    const base = PAPER_DIMENSIONS_MM[page.paperSize] || PAPER_DIMENSIONS_MM.a4;
    widthMm = base.width;
    heightMm = base.height;
  }

  if (orientation === 'landscape') {
    return { width: `${heightMm}mm`, height: `${widthMm}mm`, widthMm: heightMm, heightMm: widthMm };
  }

  return { width: `${widthMm}mm`, height: `${heightMm}mm`, widthMm, heightMm };
}

export const SECTION_IDS = [
  'companyHeader',
  'invoiceInfo',
  'customerInfo',
  'products',
  'totals',
  'payment',
  'notes',
  'signature',
  'footer',
];

export const SECTION_LABELS = {
  companyHeader: 'Company Header',
  invoiceInfo: 'Invoice Information',
  customerInfo: 'Customer Information',
  products: 'Products',
  totals: 'Totals',
  payment: 'Payment Information',
  notes: 'Notes',
  signature: 'Signature',
  footer: 'Footer',
};

export const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
];

export const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'none', label: 'None' },
];

export const BARCODE_TYPES = [
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'ean13', label: 'EAN-13' },
];

export const PRODUCT_COLUMNS = [
  { id: 'index', label: '#', defaultVisible: true },
  { id: 'product', label: 'Product Name', defaultVisible: true },
  { id: 'sku', label: 'SKU', defaultVisible: true },
  { id: 'barcode', label: 'Barcode', defaultVisible: false },
  { id: 'description', label: 'Description', defaultVisible: false },
  { id: 'qty', label: 'Quantity', defaultVisible: true },
  { id: 'unit', label: 'Unit', defaultVisible: false },
  { id: 'unitPrice', label: 'Unit Price', defaultVisible: true },
  { id: 'discount', label: 'Discount', defaultVisible: true },
  { id: 'tax', label: 'Tax', defaultVisible: true },
  { id: 'total', label: 'Total', defaultVisible: true },
];

/**
 * Centralized mock POS data — replace with API/company settings later.
 */
export const DEFAULT_POS_DATA = {
  company: {
    name: '',
    legalName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    website: '',
    logo: '',
    tagline: '',
    taxNumber: '',
    ntn: '',
    strn: '',
    registrationNumber: '',
  },
  user: {
    name: 'Ahmed Khan',
    email: 'ahmed@aipos.pk',
    phone: '+92 321 9876543',
    role: 'Sales Executive',
    branch: 'Main Branch — Lahore',
    warehouse: 'Central Warehouse',
  },
  invoice: {
    number: 'INV-2026-004521',
    date: '25 Aug 2026',
    dueDate: '08 Sep 2026',
    salesperson: 'Ahmed Khan',
    paymentMethod: 'Cash + Card',
    paymentReference: 'TXN-8844221',
    transactionId: 'PAY-992831',
  },
  customer: {
    name: 'Metro Retail Store',
    phone: '+92 333 4455667',
    email: 'accounts@metroretail.pk',
    address: '45 Mall Road, Model Town, Lahore',
    taxNumber: 'NTN-5544332-1',
    customerId: 'CUS-1024',
  },
  products: [
    {
      index: 1,
      product: 'Wireless Barcode Scanner',
      sku: 'SCN-2001',
      barcode: '8901234567890',
      description: '2D QR + 1D barcode',
      qty: 2,
      unit: 'Pcs',
      unitPrice: 12500,
      discount: 500,
      tax: 2375,
      total: 26875,
    },
    {
      index: 2,
      product: 'Thermal Receipt Printer 80mm',
      sku: 'PRT-8080',
      barcode: '8901234567891',
      description: 'USB + Ethernet',
      qty: 1,
      unit: 'Pcs',
      unitPrice: 28500,
      discount: 0,
      tax: 5130,
      total: 33630,
    },
    {
      index: 3,
      product: 'POS Cash Drawer',
      sku: 'CDR-401',
      barcode: '8901234567892',
      description: 'Heavy duty RJ11',
      qty: 1,
      unit: 'Pcs',
      unitPrice: 9800,
      discount: 200,
      tax: 1728,
      total: 11328,
    },
    {
      index: 4,
      product: 'A4 Document Tray',
      sku: 'ACC-112',
      barcode: '8901234567893',
      description: 'Stackable tray',
      qty: 3,
      unit: 'Pcs',
      unitPrice: 1200,
      discount: 0,
      tax: 648,
      total: 4248,
    },
  ],
  summary: {
    subtotal: 76100,
    discount: 700,
    tax: 9881,
    shipping: 1500,
    otherCharges: 250,
    grandTotal: 87031,
    amountPaid: 50000,
    balanceDue: 37031,
  },
  notes: {
    invoiceNotes: 'Goods once sold will not be taken back unless defective.',
    customerNotes: 'Please mention invoice number on payment transfer.',
    paymentTerms: 'Net 14 days. Late payments subject to 2% monthly interest.',
    returnPolicy: 'Returns accepted within 7 days with original packaging.',
    warrantyInformation: 'Hardware carries 12-month manufacturer warranty.',
    footerMessage: 'Thank you for doing business with us.',
  },
};

export const DEFAULT_LAYOUT_SETTINGS = {
  documentType: 'sales_invoice',

  company: { ...DEFAULT_POS_DATA.company },
  user: { ...DEFAULT_POS_DATA.user },
  invoice: { ...DEFAULT_POS_DATA.invoice },
  customer: { ...DEFAULT_POS_DATA.customer },
  notes: { ...DEFAULT_POS_DATA.notes },

  logo: {
    dataUrl: '',
    position: 'left',
    width: 72,
    height: 72,
    maintainAspectRatio: true,
  },

  header: {
    showLogo: true,
    showCompanyName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    showTaxNumber: true,
    showInvoiceTitle: true,
    showInvoiceNumber: true,
    showInvoiceDate: true,
    showDueDate: true,
    alignment: 'left',
  },

  customerDisplay: {
    showName: true,
    showPhone: true,
    showEmail: true,
    showAddress: true,
    showTaxNumber: true,
    showCustomerId: true,
    layout: 'two-column',
  },

  userInfo: {
    showCashier: true,
    showSalesperson: true,
    showUserName: true,
    showUserEmail: false,
    showUserPhone: false,
    showBranch: true,
    showWarehouse: false,
  },

  products: {
    columnOrder: PRODUCT_COLUMNS.map((c) => c.id),
    columnVisibility: Object.fromEntries(PRODUCT_COLUMNS.map((c) => [c.id, c.defaultVisible])),
    tableFontSize: 11,
    headerFontSize: 11,
    rowSpacing: 6,
    borderStyle: 'solid',
    showBorders: true,
    headerAlignment: 'left',
    productAlignment: 'left',
    quantityAlignment: 'center',
    priceAlignment: 'right',
    totalAlignment: 'right',
  },

  totals: {
    showSubtotal: true,
    showDiscount: true,
    showTax: true,
    showShipping: true,
    showOtherCharges: true,
    showGrandTotal: true,
    showPaidAmount: true,
    showBalance: true,
    showPaymentMethod: true,
    grandTotalFontSize: 14,
    grandTotalBold: true,
    grandTotalAlignment: 'right',
    grandTotalBorder: true,
    grandTotalHighlight: true,
  },

  payment: {
    showPaymentMethod: true,
    showPaymentReference: true,
    showTransactionId: true,
    showBankDetails: false,
    showCashDetails: true,
    showCardDetails: true,
    bankDetails: 'Bank: Meezan Bank\nAccount: 01234567890123\nIBAN: PK00MEZN0000123456789012',
    cashDetails: 'Cash received at counter',
    cardDetails: 'Visa **** 4242 — Auth: 883921',
  },

  signature: {
    showAuthorized: true,
    showCustomer: false,
    position: 'left',
    authorizedLabel: 'Authorized Signature',
    customerLabel: 'Customer Signature',
  },

  qrBarcode: {
    showQrCode: true,
    showInvoiceQr: true,
    showPaymentQr: false,
    showBarcode: true,
    barcodeType: 'code128',
    qrSize: 64,
    position: 'right',
  },

  footer: {
    showFooter: true,
    footerText: 'Thank you for doing business with us.',
    showCompanyName: true,
    showWebsite: true,
    showPhone: true,
    showEmail: true,
    showPageNumber: true,
  },

  page: {
    paperSize: 'a4',
    orientation: 'portrait',
    customWidthMm: 210,
    customHeightMm: 297,
    margins: { top: 20, bottom: 20, left: 24, right: 24 },
    fontFamily: 'Inter, sans-serif',
    baseFontSize: 11,
    headingFontSize: 18,
    tableFontSize: 11,
    sectionSpacing: 16,
    rowSpacing: 4,
    headerSpacing: 12,
    footerSpacing: 12,
  },

  design: {
    primaryColor: '#f97316',
    secondaryColor: '#64748b',
    textColor: '#1e293b',
    borderColor: '#cbd5e1',
    tableHeaderBg: '#f8fafc',
    tableHeaderText: '#334155',
    borderRadius: 4,
    borderWidth: 1,
    dividerStyle: 'solid',
    boldHeadings: true,
    uppercaseInvoiceTitle: true,
  },

  sectionOrder: [...SECTION_IDS],
};

export function createDefaultLayoutSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT_SETTINGS));
}
