import QRCode from 'qrcode';
import { defaultPrinterSettings } from '../../features/company/companyAPI.js';
import { APP_NAME } from '../../config/env.js';

const THERMAL_RECEIPT_SOFTWARE_CONTACT = 'For Software Contact : 03361225588';

/**
 * @typedef {Object} ThermalReceiptLine
 * @property {string} description
 * @property {string} [qtyLabel]
 * @property {number} rate
 * @property {number} amount
 */

/**
 * @typedef {Object} ThermalReceiptSummary
 * @property {number} subTotal
 * @property {number} tax
 * @property {number} discount
 * @property {number} [shipping]
 * @property {number} total
 * @property {number} paymentMade
 * @property {number} balanceDue
 */

/**
 * @typedef {Object} ThermalReceiptData
 * @property {string} shopName
 * @property {string} invoiceNo
 * @property {string} invoiceDate
 * @property {string} [paymentMethod]
 * @property {string} [paymentStatus]
 * @property {{ name: string, phone?: string, email?: string }} [billTo]
 * @property {ThermalReceiptLine[]} [lines]
 * @property {ThermalReceiptSummary} [summary]
 * @property {string} [terms]
 * @property {number} [grossAmount]
 * @property {string} [publicUrl]
 * @property {string} [currentUserName]
 * @property {string} [cashier]
 */

/**
 * @typedef {Object} ThermalPrintOptions
 * @property {string} [currencyLabel='PKR']
 * @property {string} [locale='en-PK']
 * @property {string} [windowFeatures='width=380,height=720']
 * @property {boolean} [autoClose=true]
 * @property {boolean} [revokeBlobUrl=true]
 * @property {number} [printDelayMs=400]
 * @property {number} [fallbackPrintDelayMs=1500]
 * @property {string} [footerThankYou] Defaults to "Thanks for purchasing from {company name}"
 * @property {string} [documentTitlePrefix='Receipt']
 * @property {string} [invoiceNumberPrefix='POS#']
 * @property {Record<string, boolean>} [printerSettings]
 * @property {{ name?: string, phone?: string, email?: string, address?: string, logoUrl?: string }} [companyBrand]
 * @property {{ amount_received?: number|string, change_given?: number|string }} [sourceOrder]
 * @property {string} [qrDataUrl]
 */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatThermalMoney(amount, options = {}) {
  const { currencyLabel = 'PKR', locale = 'en-PK' } = options;
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `${currencyLabel} ${safe.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hasDisplayValue(v) {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '—' && s.toLowerCase() !== 'n/a';
}

function normalizeData(data) {
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const summary = data.summary || {};
  const billTo = data.billTo || { name: '—' };
  return {
    shopName: data.shopName ?? '',
    invoiceNo: String(data.invoiceNo ?? ''),
    invoiceDate: data.invoiceDate ?? '',
    paymentMethod: data.paymentMethod ?? '—',
    paymentStatus: data.paymentStatus ?? '—',
    billTo: {
      name: billTo.name ?? '—',
      phone: billTo.phone ?? '',
      email: billTo.email ?? '',
    },
    terms: data.terms ?? '',
    grossAmount: Number(data.grossAmount) || Number(summary.total) || 0,
    publicUrl: String(data.publicUrl ?? '').trim(),
    currentUserName: String(data.currentUserName ?? data.cashier ?? '').trim(),
    cashier: String(data.cashier ?? data.currentUserName ?? '').trim(),
    lines: lines.map((line) => ({
      description: line.description ?? '',
      qtyLabel: line.qtyLabel ?? String(line.qty ?? ''),
      rate: Number(line.rate) || 0,
      amount: Number(line.amount) || 0,
    })),
    summary: {
      subTotal: Number(summary.subTotal) || 0,
      tax: Number(summary.tax) || 0,
      discount: Number(summary.discount) || 0,
      shipping: Number(summary.shipping) || 0,
      total: Number(summary.total) || 0,
      paymentMade: Number(summary.paymentMade) || 0,
      balanceDue: Number(summary.balanceDue) || 0,
    },
  };
}

function resolvePrinterSettings(options = {}) {
  return options.printerSettings && typeof options.printerSettings === 'object'
    ? { ...defaultPrinterSettings(), ...options.printerSettings }
    : defaultPrinterSettings();
}

function summaryRow(label, value, className = '') {
  if (!value) return '';
  return `<div class="row ${className}"><span>${escapeHtml(label)}</span><span>${value}</span></div>`;
}

/**
 * Full HTML document for an 80mm-style thermal receipt (for printing or preview).
 * @param {ThermalReceiptData} data
 * @param {ThermalPrintOptions} [options]
 * @returns {string}
 */
export function buildThermalReceiptHtml(data, options = {}) {
  if (!data || typeof data !== 'object') {
    return '<!DOCTYPE html><html><body>Invalid receipt data</body></html>';
  }

  const d = normalizeData(data);
  const ps = resolvePrinterSettings(options);
  const brand = options.companyBrand || { name: d.shopName };
  const sourceOrder = options.sourceOrder || null;

  const {
    currencyLabel = 'PKR',
    locale = 'en-PK',
    footerThankYou,
    documentTitlePrefix = 'Receipt',
    invoiceNumberPrefix = 'POS#',
    qrDataUrl = '',
  } = options;

  const fmt = (n) => formatThermalMoney(n, { currencyLabel, locale });
  const companyName = String(brand.name || d.shopName || APP_NAME).trim() || APP_NAME;
  const customFooterThankYou =
    footerThankYou != null && String(footerThankYou).trim() !== ''
      ? String(footerThankYou).trim()
      : '';
  const footerThanksLine = customFooterThankYou || 'Thanks for purchasing from';
  const footerThanksCompany = customFooterThankYou ? '' : companyName;

  const logoHtml = ps.show_logo
    ? brand.logoUrl
      ? `<div class="logo-wrap"><img src="${escapeHtml(brand.logoUrl)}" alt="" class="logo" /></div>`
      : `<div class="logo-fallback">${escapeHtml(companyName.charAt(0).toUpperCase())}</div>`
    : '';

  const companyLines = [];
  if (ps.show_company_name) {
    companyLines.push(`<div class="shop-name">${escapeHtml(companyName)}</div>`);
  }
  if (ps.show_email && hasDisplayValue(brand.email)) {
    companyLines.push(`<div class="shop-meta">${escapeHtml(brand.email)}</div>`);
  }
  if (ps.show_phone && hasDisplayValue(brand.phone)) {
    companyLines.push(`<div class="shop-meta">${escapeHtml(brand.phone)}</div>`);
  }

  const invoiceLines = [];
  if (ps.show_address && hasDisplayValue(brand.address)) {
    invoiceLines.push(`<div class="shop-meta">${escapeHtml(brand.address)}</div>`);
  }
  if (ps.show_invoice_no) {
    invoiceLines.push(
      `<div class="meta-chip"><span class="meta-label">${escapeHtml(invoiceNumberPrefix)}</span> ${escapeHtml(d.invoiceNo)}</div>`
    );
  }
  if (ps.show_invoice_date) {
    invoiceLines.push(`<div class="meta-line">${escapeHtml(d.invoiceDate)}</div>`);
  }
  if (ps.show_payment_method && hasDisplayValue(d.paymentMethod)) {
    invoiceLines.push(`<div class="meta-line pay-method">${escapeHtml(d.paymentMethod)}</div>`);
  }

  const logoBlock = logoHtml ? `<div class="logo-block">${logoHtml}</div>` : '';
  const detailsRow =
    companyLines.length > 0 || invoiceLines.length > 0
      ? `<div class="details-row">
          <div class="details-left">${companyLines.join('')}</div>
          <div class="details-right">${invoiceLines.join('')}</div>
        </div>`
      : '';

  const currentUserName = String(d.currentUserName || d.cashier || '').trim();
  const currentUserBlock =
    ps.show_current_user && hasDisplayValue(currentUserName)
      ? `<div class="meta-line user-line">User: ${escapeHtml(currentUserName)}</div>`
      : '';

  const billToLines = [`<div class="bill-name">${escapeHtml(d.billTo.name)}</div>`];
  if (ps.show_customer_phone && hasDisplayValue(d.billTo.phone)) {
    billToLines.push(`<div class="bill-meta">${escapeHtml(d.billTo.phone)}</div>`);
  }
  if (ps.show_customer_email && hasDisplayValue(d.billTo.email)) {
    billToLines.push(`<div class="bill-meta">${escapeHtml(d.billTo.email)}</div>`);
  }

  const linesHtml = d.lines
    .map(
      (line, i) => `
      <tr class="${i % 2 === 1 ? 'line-alt' : ''}">
        <td>
          <div class="line-title">${i + 1}. ${escapeHtml(line.description)}</div>
          <div class="line-detail">
            <span>${escapeHtml(line.qtyLabel)} × ${escapeHtml(fmt(line.rate))}</span>
            <span class="line-amt">${escapeHtml(fmt(line.amount))}</span>
          </div>
        </td>
      </tr>`
    )
    .join('');

  const summaryHtml = [
    summaryRow('Subtotal', escapeHtml(fmt(d.summary.subTotal))),
    summaryRow('Tax', escapeHtml(fmt(d.summary.tax))),
    ps.show_discount
      ? summaryRow('Discount', escapeHtml(fmt(d.summary.discount)))
      : '',
    ps.show_shipping
      ? summaryRow('Shipping', escapeHtml(fmt(d.summary.shipping)))
      : '',
    `<div class="total-box">
      <span>TOTAL</span>
      <span>${escapeHtml(fmt(d.summary.total))}</span>
    </div>`,
    ps.show_gross_amount
      ? summaryRow('Gross', escapeHtml(fmt(d.grossAmount)), 'row-muted')
      : '',
    ps.show_payment_made
      ? summaryRow('Payment', escapeHtml(fmt(d.summary.paymentMade)), 'row-paid')
      : '',
    ps.show_balance_due
      ? summaryRow('Balance due', escapeHtml(fmt(d.summary.balanceDue)), 'row-due')
      : '',
  ];

  if (ps.show_change_return && sourceOrder) {
    if (hasDisplayValue(sourceOrder.amount_received)) {
      summaryHtml.push(
        summaryRow('Received', escapeHtml(fmt(sourceOrder.amount_received)), 'row-muted')
      );
    }
    if (hasDisplayValue(sourceOrder.change_given)) {
      summaryHtml.push(
        summaryRow('Change', escapeHtml(fmt(sourceOrder.change_given)), 'row-muted')
      );
    }
  }

  const qrBlock =
    ps.show_qrcode && qrDataUrl
      ? `<div class="qr-wrap"><img src="${qrDataUrl}" alt="QR" width="88" height="88" /><div class="qr-caption">Scan invoice</div></div>`
      : '';

  const title = `${documentTitlePrefix} #${escapeHtml(d.invoiceNo)}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${title}</title>
<style>
  /* Match common thermal roll sizes; content pinned to top (avoids Chrome centering blank). */
  @page { size: 80mm 210mm; margin: 0; }
  * { box-sizing: border-box; font-weight: 700; color: #000; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    border: 0;
    width: 80mm;
    background: #fff;
  }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .receipt-root {
    display: block;
    width: 76mm;
    max-width: 76mm;
    margin: 0;
    padding: 1mm 2mm 2mm;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 80mm !important;
      height: auto !important;
      min-height: 0 !important;
    }
    body {
      position: relative !important;
    }
    .receipt-root {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: auto !important;
      bottom: auto !important;
      width: 76mm !important;
      max-width: 76mm !important;
      margin: 0 !important;
      padding: 1mm 2mm 2mm !important;
      transform: none !important;
    }
  }
  .receipt-badge {
    text-align: center;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.22em;
    margin: 0 0 4px;
  }
  .logo-block {
    text-align: center;
    margin: 0 0 4px;
  }
  .logo-wrap { display: inline-block; }
  .logo {
    display: block;
    max-width: 64px;
    max-height: 64px;
    object-fit: contain;
    border-radius: 6px;
    margin: 0 auto;
  }
  .logo-fallback {
    width: 48px;
    height: 48px;
    margin: 0 auto;
    border-radius: 8px;
    background: #fff;
    border: 2px solid #000;
    font-size: 22px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .details-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .details-left {
    flex: 1 1 48%;
    text-align: left;
    min-width: 0;
  }
  .details-right {
    flex: 1 1 48%;
    text-align: right;
    min-width: 0;
  }
  .shop-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.02em;
    margin-bottom: 2px;
    line-height: 1.25;
  }
  .shop-meta { font-size: 10px; font-weight: 700; margin-top: 2px; line-height: 1.35; }
  .divider {
    border: none;
    border-top: 1px dashed #bbb;
    margin: 8px 0;
  }
  .divider-bold {
    border: none;
    border-top: 2px solid #111;
    margin: 8px 0;
  }
  .meta-block { text-align: center; margin-bottom: 8px; }
  .meta-chip {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 7px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid #000;
    margin-top: 2px;
    margin-bottom: 2px;
    max-width: 100%;
    word-break: break-word;
  }
  .meta-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .meta-line { font-size: 11px; font-weight: 700; margin-top: 2px; }
  .user-line { text-align: right; margin: 0; padding: 0; line-height: 1.2; }
  .divider-after-header {
    margin-bottom: 0;
  }
  .pay-method { font-weight: 800; }
  .section-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .bill-name { font-size: 13px; font-weight: 800; }
  .bill-meta { font-size: 10px; font-weight: 700; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td { padding: 5px 0; vertical-align: top; border-bottom: 1px dotted #ddd; }
  tr.line-alt td { background: #fafafa; }
  tr:last-child td { border-bottom: none; }
  .line-title { font-weight: 800; font-size: 12px; margin-bottom: 2px; }
  .line-detail {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    font-family: ui-monospace, 'Courier New', monospace;
  }
  .line-amt { font-weight: 800; }
  .row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 0;
  }
  .row span:last-child { font-weight: 800; font-family: ui-monospace, 'Courier New', monospace; }
  .row-muted span:last-child { font-weight: 700; }
  .row-paid span:last-child { font-weight: 800; }
  .row-due span:last-child { font-weight: 800; }
  .total-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0 4px;
    padding: 8px 10px;
    border: 2px solid #111;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 800;
  }
  .total-box span:last-child {
    font-family: ui-monospace, 'Courier New', monospace;
    font-weight: 800;
  }
  .qr-wrap { text-align: center; margin: 10px 0 6px; }
  .qr-caption { font-size: 9px; font-weight: 700; margin-top: 4px; }
  .foot {
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    margin-top: 10px;
    line-height: 1.45;
  }
  .foot-thanks {
    font-weight: 800;
    margin-top: 4px;
    font-size: 11px;
  }
  .foot-company {
    font-weight: 800;
    margin-top: 2px;
    font-size: 11px;
  }
  .foot-contact {
    font-weight: 700;
    margin-top: 8px;
    font-size: 10px;
  }
</style></head><body>
<div class="receipt-root">
  <div class="receipt-badge">RECEIPT</div>
  ${logoBlock}
  ${detailsRow}
  ${
    logoBlock || detailsRow
      ? `<hr class="divider${currentUserBlock ? ' divider-after-header' : ''}" />`
      : ''
  }
  ${currentUserBlock}
  <div class="section-label">Bill to</div>
  ${billToLines.join('')}
  <hr class="divider-bold" />
  <table>${linesHtml}</table>
  <hr class="divider" />
  ${summaryHtml.join('')}
  ${qrBlock}
  <div class="foot">
    ${d.terms ? `${escapeHtml(d.terms)}<br/>` : ''}
    <div class="foot-thanks">${escapeHtml(footerThanksLine)}</div>
    ${footerThanksCompany ? `<div class="foot-company">${escapeHtml(footerThanksCompany)}</div>` : ''}
    <div class="foot-contact">${escapeHtml(THERMAL_RECEIPT_SOFTWARE_CONTACT)}</div>
  </div>
</div>
  <script>
    (function () {
      function pinTop() {
        var root = document.querySelector('.receipt-root');
        if (!root) return;
        root.style.position = 'absolute';
        root.style.top = '0';
        root.style.left = '0';
        root.style.margin = '0';
        root.style.transform = 'none';
      }
      function fitThermalPage() {
        pinTop();
        var root = document.querySelector('.receipt-root');
        if (!root) return;
        var px = Math.ceil(Math.max(root.scrollHeight, root.offsetHeight));
        var mm = Math.min(210, Math.max(60, Math.ceil((px * 25.4) / 96) + 4));
        var style = document.getElementById('thermal-page-fit');
        if (!style) {
          style = document.createElement('style');
          style.id = 'thermal-page-fit';
          document.head.appendChild(style);
        }
        /* Prefer content-height page; Chrome may still use dialog paper size. */
        style.textContent =
          '@page{size:80mm ' + mm + 'mm;margin:0}' +
          '@media print{.receipt-root{position:absolute!important;top:0!important;left:0!important;margin:0!important;transform:none!important}}';
      }
      function run() {
        fitThermalPage();
        setTimeout(fitThermalPage, 80);
        setTimeout(fitThermalPage, 250);
      }
      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run);
      document.querySelectorAll('img').forEach(function (img) {
        if (!img.complete) img.addEventListener('load', fitThermalPage);
      });
    })();
  </script>
</body></html>`;
}

async function resolveQrDataUrl(data, options = {}) {
  if (options.qrDataUrl) return options.qrDataUrl;
  const ps = resolvePrinterSettings(options);
  if (!ps.show_qrcode) return '';
  const url = String(data?.publicUrl ?? '').trim();
  if (!url) return '';
  try {
    return await QRCode.toDataURL(url, { width: 88, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    return '';
  }
}

/**
 * Opens a new window with the thermal receipt and triggers the print dialog.
 * @param {ThermalReceiptData} data
 * @param {ThermalPrintOptions & { onBlocked?: () => void }} [options]
 * @returns {Promise<boolean>} true if a window was opened
 */
export async function openThermalReceiptPrint(data, options = {}) {
  if (!data || typeof data !== 'object') {
    console.warn('[ThermalReceiptPrint] openThermalReceiptPrint: `data` is required');
    return false;
  }

  const {
    windowFeatures = 'width=380,height=720',
    autoClose = true,
    revokeBlobUrl = true,
    printDelayMs = 400,
    fallbackPrintDelayMs = 1500,
    onBlocked,
  } = options;

  const qrDataUrl = await resolveQrDataUrl(data, options);
  const html = buildThermalReceiptHtml(data, { ...options, qrDataUrl });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const w = window.open(blobUrl, '_blank', windowFeatures);
  if (!w) {
    URL.revokeObjectURL(blobUrl);
    onBlocked?.();
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Allow pop-ups to print the thermal receipt.');
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
  const fitThenPrint = () => {
    try {
      const doc = w.document;
      const root = doc?.querySelector?.('.receipt-root');
      if (root) {
        root.style.position = 'absolute';
        root.style.top = '0';
        root.style.left = '0';
        root.style.margin = '0';
        root.style.transform = 'none';
        const px = Math.ceil(Math.max(root.scrollHeight, root.offsetHeight));
        const mm = Math.min(210, Math.max(60, Math.ceil((px * 25.4) / 96) + 4));
        let style = doc.getElementById('thermal-page-fit');
        if (!style) {
          style = doc.createElement('style');
          style.id = 'thermal-page-fit';
          doc.head.appendChild(style);
        }
        style.textContent =
          `@page{size:80mm ${mm}mm;margin:0}` +
          `@media print{.receipt-root{position:absolute!important;top:0!important;left:0!important;margin:0!important;transform:none!important}}`;
      }
    } catch (_) {
      /* cross-origin / closed */
    }
    try {
      w.focus();
      w.print();
    } catch (_) {
      /* ignore */
    }
  };

  const schedulePrint = () => {
    if (printScheduled) return;
    printScheduled = true;
    setTimeout(fitThenPrint, printDelayMs);
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
        }, 200);
      },
      { once: true }
    );
  } else {
    w.addEventListener('beforeunload', revoke, { once: true });
  }

  setTimeout(() => {
    if (w.closed) revoke();
  }, 120_000);

  return true;
}
