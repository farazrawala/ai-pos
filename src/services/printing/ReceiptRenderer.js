import { EscPosBuilder } from './EscPosBuilder.js';

const money = (n, currency = 'PKR') => {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return `${currency} ${safe.toFixed(2)}`;
};

/** Render receipt / kitchen tickets to ESC/POS bytes. */
export class ReceiptRenderer {
  constructor({ template = {}, printer = {}, company = {} } = {}) {
    this.template = template;
    this.printer = printer;
    this.company = company;
  }

  renderReceipt(receipt) {
    const paperWidth = this.printer.paper_width || this.printer.paperWidth || '80mm';
    const b = new EscPosBuilder({
      encoding: this.printer.character_encoding || 'utf8',
      paperWidth,
    });
    const t = this.template;
    const c = this.company;

    b.init().align('center');

    if (t.show_logo !== false && c.logo_text) b.text(String(c.logo_text)).blank();
    if (t.show_business_name !== false) {
      b.bold(true).text(String(c.name || c.company_name || 'Store')).bold(false);
    }
    if (t.show_address !== false && c.address) b.text(String(c.address));
    if (t.show_phone !== false && c.phone) b.text(`Tel: ${c.phone}`);
    if (t.show_gst !== false && c.gst) b.text(`GST: ${c.gst}`);

    b.blank().separator('=').align('left');

    if (t.show_invoice_number !== false && receipt.invoiceNo) b.text(`Invoice: ${receipt.invoiceNo}`);
    if (t.show_customer_name !== false && receipt.customerName) b.text(`Customer: ${receipt.customerName}`);
    if (t.show_cashier !== false && receipt.cashier) b.text(`Cashier: ${receipt.cashier}`);
    if (t.show_date !== false && receipt.date) b.text(`Date: ${receipt.date}`);

    b.blank().separator('-');

    if (t.show_items !== false && Array.isArray(receipt.lines)) {
      for (const line of receipt.lines) {
        const name = line.name || line.description || 'Item';
        b.text(`${name}`.slice(0, paperWidth === '58mm' ? 20 : 28));
        if (t.show_qty !== false && t.show_price !== false) {
          b.text(`  ${line.qty ?? 1} x ${money(line.price)} = ${money(line.amount ?? line.qty * line.price)}`);
        }
      }
    }

    b.blank().separator('-');
    if (t.show_items !== false && Array.isArray(receipt.lines) && receipt.lines.length) {
      const totalQty = receipt.lines.reduce((sum, line) => {
        const n = Number(line.qty);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      const totalQtyLabel = Number.isInteger(totalQty)
        ? String(totalQty)
        : totalQty.toFixed(2).replace(/\.?0+$/, '');
      b.text(`Total Qty: ${totalQtyLabel}`);
    }
    if (t.show_discount !== false && receipt.discount) b.text(`Discount: ${money(receipt.discount)}`);
    if (t.show_tax !== false && receipt.tax) b.text(`Tax: ${money(receipt.tax)}`);
    if (t.show_grand_total !== false) b.bold(true).text(`TOTAL: ${money(receipt.total)}`).bold(false);

    if (t.show_barcode !== false && receipt.barcode) b.blank().align('center').text(`[${receipt.barcode}]`);
    if (t.show_qr_code !== false && receipt.qrPayload) b.blank().align('center').text(`QR: ${receipt.qrPayload}`);

    b.blank().align('center').text(String(t.footer_text || 'Thank You')).blank(2);

    if (this.printer.open_cash_drawer) b.openDrawer();
    if (this.printer.auto_cut !== false) b.cut();
    return b.build();
  }

  renderKitchenTicket({ title, lines = [], meta = {} }) {
    const paperWidth = this.printer.paper_width || '80mm';
    const b = new EscPosBuilder({ paperWidth });
    b.init().align('center').bold(true).text(String(title || 'KITCHEN')).bold(false).blank();
    if (meta.orderNo) b.align('left').text(`Order: ${meta.orderNo}`);
    if (meta.date) b.text(`Time: ${meta.date}`);
    b.separator('-');
    for (const line of lines) {
      b.bold(true).text(`${line.qty ?? 1}x ${line.name || line.description}`).bold(false);
      if (line.note) b.text(`  ${line.note}`);
    }
    b.blank(2);
    if (this.printer.auto_cut !== false) b.cut();
    return b.build();
  }
}
