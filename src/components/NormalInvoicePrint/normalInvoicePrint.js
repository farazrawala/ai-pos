import QRCode from 'qrcode';
import { escapeHtml, formatThermalMoney } from '../ThermalReceiptPrint/thermalReceiptPrint.js';

/**
 * @typedef {Object} NormalInvoicePrintLine
 * @property {string} description
 * @property {number} rate
 * @property {string} qtyLabel
 * @property {number} amount
 */

/**
 * @typedef {Object} NormalInvoicePrintPayload
 * @property {Record<string, boolean>} printerSettings
 * @property {{ name: string, phone?: string, email?: string, address?: string, logoUrl?: string }} companyBrand
 * @property {string} invoiceNo
 * @property {string} invoiceDate
 * @property {string} [terms]
 * @property {string} [note]
 * @property {string[]} [termsBody]
 * @property {string} [publicUrl]
 * @property {{ name: string, phone?: string, email?: string }} billTo
 * @property {NormalInvoicePrintLine[]} lines
 * @property {{ subTotal: number, tax: number, discount: number, shipping: number, total: number, paymentMade: number, balanceDue: number }} summary
 * @property {number} [grossAmount]
 * @property {string} [paymentMethod]
 * @property {number|string} [amountReceived]
 * @property {number|string} [changeGiven]
 */

/**
 * @typedef {Object} NormalInvoicePrintOptions
 * @property {string} [currencyLabel='PKR']
 * @property {string} [locale='en-PK']
 * @property {string} [windowFeatures='width=900,height=1000']
 * @property {boolean} [autoClose=true]
 * @property {boolean} [revokeBlobUrl=true]
 * @property {number} [printDelayMs=500]
 * @property {number} [fallbackPrintDelayMs=1800]
 * @property {string} [documentTitlePrefix='Invoice']
 * @property {string} [invoiceNumberPrefix='POS#']
 * @property {string} [documentHeading='INVOICE']
 * @property {string} [billToLabel='Bill To']
 * @property {string} [dateLabel='Invoice Date:']
 */

function fmtMoney(amount, options = {}) {
  return formatThermalMoney(amount, options);
}

function hasValue(v) {
  return v != null && String(v).trim() !== '' && String(v).trim() !== '—';
}

async function buildQrDataUrl(value, size = 96) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, { width: size, margin: 1 });
  } catch {
    return '';
  }
}

/**
 * Full HTML document for an A4 invoice (for printing or preview).
 * @param {NormalInvoicePrintPayload} payload
 * @param {NormalInvoicePrintOptions} [options]
 * @returns {Promise<string>}
 */
export async function buildNormalInvoiceHtml(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    return '<!DOCTYPE html><html><body>Invalid invoice data</body></html>';
  }

  const {
    currencyLabel = 'PKR',
    locale = 'en-PK',
    documentTitlePrefix = 'Invoice',
    invoiceNumberPrefix = 'POS#',
    documentHeading = 'INVOICE',
    billToLabel = 'Bill To',
    dateLabel = 'Invoice Date:',
  } = options;

  const fmtOpts = { currencyLabel, locale };
  const fmt = (n) => fmtMoney(n, fmtOpts);

  const ps = payload.printerSettings || {};
  const brand = payload.companyBrand || { name: '' };
  const billTo = payload.billTo || { name: '—' };
  const summary = payload.summary || {};
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const termsBody = Array.isArray(payload.termsBody) ? payload.termsBody : [];

  const qrDataUrl =
    ps.show_qrcode && payload.publicUrl
      ? await buildQrDataUrl(payload.publicUrl, 96)
      : '';

  const logoHtml =
    ps.show_logo && brand.logoUrl
      ? `<img src="${escapeHtml(brand.logoUrl)}" alt="" class="logo" />`
      : ps.show_logo
        ? '<div class="logo-placeholder">LOGO</div>'
        : '';

  const companyLines = [];
  if (ps.show_company_name && brand.name) {
    companyLines.push(`<div class="company-kicker">${escapeHtml(brand.name)}</div>`);
    companyLines.push(`<div class="company-name">${escapeHtml(brand.name)}</div>`);
  }
  if (ps.show_phone && brand.phone) {
    companyLines.push(`<div class="muted">${escapeHtml(brand.phone)}</div>`);
  }
  if (ps.show_email && brand.email) {
    companyLines.push(`<div class="muted">${escapeHtml(brand.email)}</div>`);
  }
  if (ps.show_address && brand.address) {
    companyLines.push(`<div class="muted">${escapeHtml(brand.address)}</div>`);
  }

  const invoiceMeta = ps.show_invoice_no
    ? `<div class="meta-row"><span class="muted">${escapeHtml(invoiceNumberPrefix)} </span><strong>${escapeHtml(payload.invoiceNo || '')}</strong></div>`
    : '';

  const billToLines = [
    `<div class="bill-name">${escapeHtml(billTo.name || '—')}</div>`,
  ];
  if (ps.show_customer_phone && hasValue(billTo.phone)) {
    billToLines.push(`<div class="muted">${escapeHtml(billTo.phone)}</div>`);
  }
  if (ps.show_customer_email && hasValue(billTo.email)) {
    billToLines.push(`<div class="muted">${escapeHtml(billTo.email)}</div>`);
  }

  const dateBlock = ps.show_invoice_date
    ? `<div class="meta-row"><span class="muted">${escapeHtml(dateLabel)}</span> <strong>${escapeHtml(payload.invoiceDate || '')}</strong></div>`
    : '';

  const grossBlock =
    ps.show_gross_amount && payload.grossAmount != null
      ? `<div class="gross-row"><strong>Gross Amount: ${escapeHtml(fmt(payload.grossAmount))}</strong></div>`
      : '';

  const linesHtml = lines
    .map(
      (line, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escapeHtml(line.description || '')}</td>
        <td class="right">${escapeHtml(fmt(line.rate))}</td>
        <td class="right">${escapeHtml(line.qtyLabel || '')}</td>
        <td class="right strong">${escapeHtml(fmt(line.amount))}</td>
      </tr>`
    )
    .join('');

  const summaryRows = [
    `<div class="sum-row"><span class="muted">Sub Total</span><span class="strong">${escapeHtml(fmt(summary.subTotal))}</span></div>`,
    `<div class="sum-row"><span class="muted">Tax</span><span>${escapeHtml(fmt(summary.tax))}</span></div>`,
  ];

  if (ps.show_discount) {
    summaryRows.push(
      `<div class="sum-row"><span class="muted">Discount</span><span>${escapeHtml(fmt(summary.discount))}</span></div>`
    );
  }
  if (ps.show_shipping) {
    summaryRows.push(
      `<div class="sum-row"><span class="muted">Shipping</span><span>${escapeHtml(fmt(summary.shipping))}</span></div>`
    );
  }

  summaryRows.push(
    `<div class="sum-row total"><span>Total</span><span>${escapeHtml(fmt(summary.total))}</span></div>`
  );

  if (ps.show_payment_made) {
    summaryRows.push(
      `<div class="sum-row payment-made"><span>Payment Made</span><span>(-) ${escapeHtml(fmt(summary.paymentMade))}</span></div>`
    );
  }
  if (ps.show_balance_due) {
    summaryRows.push(
      `<div class="sum-row strong"><span>Balance Due</span><span>${escapeHtml(fmt(summary.balanceDue))}</span></div>`
    );
  }
  if (ps.show_change_return) {
    if (hasValue(payload.amountReceived)) {
      summaryRows.push(
        `<div class="sum-row"><span class="muted">Amount received</span><span>${escapeHtml(fmt(payload.amountReceived))}</span></div>`
      );
    }
    if (hasValue(payload.changeGiven)) {
      summaryRows.push(
        `<div class="sum-row"><span class="muted">Change return</span><span>${escapeHtml(fmt(payload.changeGiven))}</span></div>`
      );
    }
  }

  const paymentMethodBlock =
    ps.show_payment_method && payload.paymentMethod
      ? `<div class="note-block"><span class="muted">Payment Method:</span> <strong>${escapeHtml(payload.paymentMethod)}</strong></div>`
      : '';

  const noteBlock = payload.note
    ? `<div class="note-block"><div class="muted small-label">Note</div><div class="note-text">${escapeHtml(payload.note)}</div></div>`
    : '';

  const qrBlock =
    ps.show_qrcode && qrDataUrl
      ? `<div class="qr-wrap"><img src="${qrDataUrl}" alt="Invoice QR code" width="96" height="96" /><div class="muted qr-caption">Scan invoice QR code</div></div>`
      : '';

  const termsHtml =
    termsBody.length > 0
      ? `<div class="terms-title">Terms &amp; Condition</div><ol class="terms-list">${termsBody
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join('')}</ol>`
      : '';

  const title = `${documentTitlePrefix} ${escapeHtml(payload.invoiceNo || '')}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Open Sans', system-ui, sans-serif;
    font-size: 11pt;
    color: #212529;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 100%;
    max-width: 186mm;
    margin: 0 auto;
    padding: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid #dee2e6;
    margin-bottom: 18px;
  }
  .brand {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    flex: 1;
    min-width: 0;
  }
  .logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: #fff;
    flex-shrink: 0;
  }
  .logo-placeholder {
    width: 72px;
    height: 72px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9pt;
    color: #6c757d;
    flex-shrink: 0;
  }
  .company-kicker {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #6c757d;
    letter-spacing: 0.04em;
  }
  .company-name {
    font-size: 14pt;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .invoice-head {
    text-align: right;
    flex-shrink: 0;
  }
  .invoice-title {
    font-size: 24pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1.1;
    margin-bottom: 8px;
  }
  .meta-row { font-size: 10pt; margin-bottom: 4px; }
  .muted { color: #6c757d; font-size: 9.5pt; }
  .strong { font-weight: 600; }
  .center { text-align: center; }
  .right { text-align: right; }
  .section {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 18px;
  }
  .section-col { flex: 1; min-width: 0; }
  .section-col.right-col { text-align: right; }
  .section-label {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 8px;
    letter-spacing: 0.04em;
  }
  .bill-name {
    color: #11cdef;
    font-weight: 700;
    font-size: 11pt;
    margin-bottom: 4px;
  }
  .gross-row {
    text-align: right;
    font-size: 12pt;
    margin-bottom: 14px;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  table.items th,
  table.items td {
    border: 1px solid #dee2e6;
    padding: 8px 10px;
    vertical-align: middle;
  }
  table.items th {
    background: #f8f9fa;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #495057;
  }
  table.items td { font-size: 9.5pt; }
  .bottom {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
  }
  .bottom-left { flex: 1; min-width: 0; }
  .bottom-right { width: 46%; min-width: 220px; }
  .note-block { margin-bottom: 12px; font-size: 10pt; }
  .small-label { font-size: 8pt; margin-bottom: 4px; }
  .note-text {
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 8px 10px;
    min-height: 64px;
    white-space: pre-wrap;
    font-size: 9.5pt;
    background: #fff;
  }
  .summary-box {
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 12px 14px;
    background: #f8f9fa;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 10pt;
  }
  .sum-row.total {
    font-weight: 700;
    border-top: 1px solid #dee2e6;
    margin-top: 6px;
    padding-top: 8px;
  }
  .sum-row.payment-made { color: #dc3545; font-weight: 600; }
  .footer {
    border-top: 1px solid #dee2e6;
    padding-top: 16px;
  }
  .qr-wrap {
    text-align: center;
    margin-bottom: 16px;
  }
  .qr-caption { margin-top: 6px; font-size: 9pt; }
  .terms-title { font-weight: 600; margin-bottom: 8px; }
  .terms-list {
    margin: 0 0 0 18px;
    padding: 0;
    color: #6c757d;
    font-size: 9.5pt;
  }
  .terms-list li { margin-bottom: 4px; }
</style></head><body>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logoHtml}
        <div>${companyLines.join('')}</div>
      </div>
      <div class="invoice-head">
        <div class="invoice-title">${escapeHtml(documentHeading)}</div>
        ${invoiceMeta}
      </div>
    </div>

    <div class="section">
      <div class="section-col">
        <div class="section-label">${escapeHtml(billToLabel)}</div>
        ${billToLines.join('')}
      </div>
      <div class="section-col right-col">
        ${dateBlock}
        <div class="meta-row"><span class="muted">Terms:</span> <strong>${escapeHtml(payload.terms || '')}</strong></div>
      </div>
    </div>

    ${grossBlock}

    <table class="items">
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Description</th>
          <th style="width:90px" class="right">Rate</th>
          <th style="width:90px" class="right">Qty</th>
          <th style="width:100px" class="right">Amount</th>
        </tr>
      </thead>
      <tbody>${linesHtml}</tbody>
    </table>

    <div class="bottom">
      <div class="bottom-left">
        ${paymentMethodBlock}
        ${noteBlock}
      </div>
      <div class="bottom-right">
        <div class="section-label">Summary</div>
        <div class="summary-box">${summaryRows.join('')}</div>
      </div>
    </div>

    <div class="footer">
      ${qrBlock}
      ${termsHtml}
    </div>
  </div>
</body></html>`;
}

/**
 * Opens a new window with the A4 invoice and triggers the print dialog.
 * @param {NormalInvoicePrintPayload} payload
 * @param {NormalInvoicePrintOptions & { onBlocked?: () => void }} [options]
 * @returns {Promise<boolean>} true if a window was opened
 */
export async function openNormalInvoicePrint(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    console.warn('[NormalInvoicePrint] openNormalInvoicePrint: `payload` is required');
    return false;
  }

  const {
    windowFeatures = 'width=900,height=1000',
    autoClose = true,
    revokeBlobUrl = true,
    printDelayMs = 500,
    fallbackPrintDelayMs = 1800,
    onBlocked,
  } = options;

  const html = await buildNormalInvoiceHtml(payload, options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const w = window.open(blobUrl, '_blank', windowFeatures);
  if (!w) {
    URL.revokeObjectURL(blobUrl);
    onBlocked?.();
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Allow pop-ups to print the invoice.');
    }
    return false;
  }

  const revoke = () => {
    if (!revokeBlobUrl) return;
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (_) {
      /* ignore */
    }
  };

  let printScheduled = false;
  const schedulePrint = () => {
    if (printScheduled) return;
    printScheduled = true;
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (_) {
        /* ignore */
      }
    }, printDelayMs);
  };

  try {
    if (w.document?.readyState === 'complete') {
      schedulePrint();
    } else {
      w.addEventListener('load', schedulePrint, { once: true });
    }
  } catch (_) {
    w.addEventListener('load', schedulePrint, { once: true });
  }

  setTimeout(schedulePrint, fallbackPrintDelayMs);

  if (autoClose) {
    w.addEventListener(
      'afterprint',
      () => {
        revoke();
        setTimeout(() => {
          try {
            w.close();
          } catch (_) {
            /* ignore */
          }
        }, 100);
      },
      { once: true }
    );
  } else {
    w.addEventListener('load', revoke, { once: true });
  }

  return true;
}
