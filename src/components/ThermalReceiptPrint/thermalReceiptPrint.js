/**
 * @typedef {Object} ThermalReceiptLine
 * @property {string} description
 * @property {string} [qtyLabel] e.g. "5.00kg" or "2"
 * @property {number} rate
 * @property {number} amount line total
 */

/**
 * @typedef {Object} ThermalReceiptSummary
 * @property {number} subTotal
 * @property {number} tax
 * @property {number} discount
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
 * @property {{ name: string }} [billTo]
 * @property {ThermalReceiptLine[]} [lines]
 * @property {ThermalReceiptSummary} [summary]
 * @property {string} [terms]
 */

/**
 * @typedef {Object} ThermalPrintOptions
 * @property {string} [currencyLabel='PKR']
 * @property {string} [locale='en-PK']
 * @property {string} [windowFeatures='width=380,height=720']
 * @property {boolean} [autoClose=true] close window after print
 * @property {boolean} [revokeBlobUrl=true]
 * @property {number} [printDelayMs=400]
 * @property {number} [fallbackPrintDelayMs=1500]
 * @property {string} [footerThankYou='Thank you']
 * @property {string} [documentTitlePrefix='Receipt']
 * @property {string} [invoiceNumberPrefix='POS#'] shown before invoice number in header
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
    billTo: { name: billTo.name ?? '—' },
    terms: data.terms ?? '',
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
      total: Number(summary.total) || 0,
      paymentMade: Number(summary.paymentMade) || 0,
      balanceDue: Number(summary.balanceDue) || 0,
    },
  };
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
  const {
    currencyLabel = 'PKR',
    locale = 'en-PK',
    footerThankYou = 'Thank you',
    documentTitlePrefix = 'Receipt',
    invoiceNumberPrefix = 'POS#',
  } = options;

  const fmt = (n) => formatThermalMoney(n, { currencyLabel, locale });

  const linesHtml = d.lines
    .map(
      (line) => `
      <tr>
        <td style="padding:4px 0;border-bottom:1px dashed #000;font-size:11px;">
          <div style="font-weight:700;">${escapeHtml(line.description)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:3px;">
            <span>${escapeHtml(line.qtyLabel)} × ${escapeHtml(fmt(line.rate))}</span>
            <span>${escapeHtml(fmt(line.amount))}</span>
          </div>
        </td>
      </tr>`
    )
    .join('');

  const title = `${documentTitlePrefix} #${escapeHtml(d.invoiceNo)}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-monospace, 'Cascadia Mono', 'Courier New', monospace;
    font-size: 12px;
    padding: 6px 8px 12px;
    width: 72mm;
    max-width: 72mm;
    min-width: 260px;
    box-sizing: border-box;
    color: #000;
    background: #fff;
  }
  h1 { font-size: 13px; text-align: center; margin: 0 0 2px; letter-spacing: 0.02em; }
  .meta { text-align: center; font-size: 10px; margin-bottom: 8px; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
  .tot {
    display: flex; justify-content: space-between; font-weight: 700; font-size: 12px;
    margin-top: 8px; padding-top: 6px; border-top: 2px solid #000;
  }
  .foot { text-align: center; font-size: 10px; margin-top: 10px; }
</style></head><body>
  <h1>${escapeHtml(d.shopName)}</h1>
  <div class="meta">${escapeHtml(invoiceNumberPrefix)} ${escapeHtml(d.invoiceNo)}<br/>${escapeHtml(d.invoiceDate)}<br/>${escapeHtml(d.paymentMethod)} · ${escapeHtml(d.paymentStatus)}</div>
  <div class="row"><span>Bill to</span><span style="max-width:58%;text-align:right;">${escapeHtml(d.billTo.name)}</span></div>
  <div class="rule"></div>
  <table>${linesHtml}</table>
  <div class="row" style="margin-top:6px;"><span>Subtotal</span><span>${escapeHtml(fmt(d.summary.subTotal))}</span></div>
  <div class="row"><span>Tax</span><span>${escapeHtml(fmt(d.summary.tax))}</span></div>
  <div class="row"><span>Discount</span><span>${escapeHtml(fmt(d.summary.discount))}</span></div>
  <div class="tot"><span>TOTAL</span><span>${escapeHtml(fmt(d.summary.total))}</span></div>
  <div class="row" style="margin-top:6px;"><span>Payment</span><span>${escapeHtml(fmt(d.summary.paymentMade))}</span></div>
  <div class="row"><span>Balance due</span><span>${escapeHtml(fmt(d.summary.balanceDue))}</span></div>
  <div class="foot">${escapeHtml(d.terms)}<br/>${escapeHtml(footerThankYou)}</div>
</body></html>`;
}

/**
 * Opens a new window with the thermal receipt and triggers the print dialog.
 * @param {ThermalReceiptData} data
 * @param {ThermalPrintOptions & { onBlocked?: () => void }} [options]
 * @returns {boolean} true if a window was opened
 */
export function openThermalReceiptPrint(data, options = {}) {
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

  const html = buildThermalReceiptHtml(data, options);
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
