import JsBarcode from 'jsbarcode';

function roundMm(mm) {
  return Math.round(mm * 100) / 100;
}

function inchesToMm(inches) {
  const n = Number(inches);
  if (!Number.isFinite(n)) return 0;
  return roundMm(n * 25.4);
}

function jsBarcodeWidthFromUi(barCodeWidthField) {
  const n = Number(barCodeWidthField);
  if (!Number.isFinite(n) || n <= 0) return 2;
  return Math.max(1, Math.min(6, Math.round(n / 10)));
}

function sheetContentHeightMm(usedRows, labelHeightMm, gapVerticalMm) {
  const rows = Math.max(1, usedRows);
  const lh = Math.max(1, labelHeightMm);
  const gap = Math.max(0, gapVerticalMm);
  return rows * lh + Math.max(0, rows - 1) * gap;
}

function usedRowsForChunk(labelCount, cols, rows, sheetHeightAuto) {
  const filledRows = Math.max(1, Math.ceil(labelCount / cols));
  return sheetHeightAuto ? filledRows : Math.min(rows, filledRows);
}

function chunk(arr, size) {
  if (size <= 0) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function safeFilenamePart(value) {
  return String(value || 'barcodes')
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'barcodes';
}

/**
 * Render one barcode to a PNG data URL (canvas).
 * @returns {string}
 */
export function renderBarcodePngDataUrl({
  encodeValue,
  format,
  barCodeWidthField,
  barCodeHeightField,
  fontSize,
  showBarcodeNumber,
}) {
  const canvas = document.createElement('canvas');
  const modW = jsBarcodeWidthFromUi(barCodeWidthField);
  const barH = Math.max(20, Math.min(120, Number(barCodeHeightField) || 40));
  const fs = Math.max(8, Math.min(24, Number(fontSize) || 11));
  JsBarcode(canvas, String(encodeValue), {
    format,
    displayValue: Boolean(showBarcodeNumber),
    width: modW,
    height: barH,
    fontSize: fs,
    margin: 4,
    background: '#ffffff',
    lineColor: '#000000',
  });
  return canvas.toDataURL('image/png');
}

/**
 * Download barcode label sheets as a PDF matching the print layout.
 * @param {object} opts
 */
export async function downloadBarcodeLabelsPdf(opts) {
  const {
    encodeValue,
    format,
    labelLines = [],
    totalLabels = 1,
    cols = 1,
    rows = 1,
    sheetHeightAuto = true,
    sheetWidthAuto = false,
    sheetWidthIn = 6.3,
    sheetWidthMm = null,
    labelWidthMm = 80,
    labelHeightMm = 50,
    gapH = 0,
    gapV = 0,
    marginTop = 0,
    marginLeft = 0,
    marginBottom = 0,
    textMarginTopMm = 0,
    barcodeMarginTopMm = 0,
    barCodeWidthField = 50,
    barCodeHeightField = 30,
    fontSize = 11,
    showBarcodeNumber = true,
    productName = 'barcodes',
  } = opts;

  if (!encodeValue) {
    throw new Error('Nothing to encode for PDF');
  }

  const { jsPDF } = await import('jspdf');
  const barcodePng = renderBarcodePngDataUrl({
    encodeValue,
    format,
    barCodeWidthField,
    barCodeHeightField,
    fontSize,
    showBarcodeNumber,
  });

  const c = Math.max(1, Math.min(12, Number(cols) || 1));
  const r = Math.max(1, Math.min(12, Number(rows) || 1));
  const count = Math.min(200, Math.max(1, Number(totalLabels) || 1));
  const lw = Math.max(20, Math.min(250, Number(labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(labelHeightMm) || 50));
  const gH = Math.max(0, Number(gapH) || 0);
  const gV = Math.max(0, Number(gapV) || 0);
  const mTop = Math.max(0, Number(marginTop) || 0);
  const mLeft = Math.max(0, Number(marginLeft) || 0);
  const mBottom = Math.max(0, Number(marginBottom) || 0);
  const textTop = Math.max(0, Math.min(30, Number(textMarginTopMm) || 0));
  const barcodeTop = Math.max(0, Math.min(30, Number(barcodeMarginTopMm) || 0));
  const contentW = roundMm(mLeft + c * lw + Math.max(0, c - 1) * gH);
  // UI passes resolved sheetWidthMm; fall back to auto content width or fixed inches.
  const pageW = Math.max(
    20,
    Number(sheetWidthMm) > 0
      ? roundMm(Number(sheetWidthMm))
      : sheetWidthAuto
        ? contentW
        : inchesToMm(sheetWidthIn)
  );
  const slotsPerSheet = r * c;
  const indices = Array.from({ length: count }, (_, i) => i);
  const sheets = sheetHeightAuto ? [indices] : chunk(indices, slotsPerSheet);
  const fs = Math.max(8, Math.min(24, Number(fontSize) || 11));
  // Approximate px→mm for text: ~0.35mm per CSS px at 96dpi
  const textLineMm = Math.max(2.5, fs * 0.32);

  let pdf = null;

  sheets.forEach((slotIndices, sheetIdx) => {
    const usedRows = usedRowsForChunk(slotIndices.length, c, r, sheetHeightAuto);
    const pageH = roundMm(mTop + sheetContentHeightMm(usedRows, lh, gV) + mBottom);
    const orientation = pageW >= pageH ? 'l' : 'p';

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: [pageW, pageH],
        compress: true,
      });
    } else {
      pdf.addPage([pageW, pageH], orientation);
    }

    slotIndices.forEach((labelIdx, i) => {
      const col = i % c;
      const row = Math.floor(i / c);
      const x = mLeft + col * (lw + gH);
      const y = mTop + row * (lh + gV);

      pdf.setDrawColor(200);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, lw, lh);

      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(fs);

      // One wrap pass only — do NOT also pass maxWidth to pdf.text (that double-wraps
      // and stacks lines on top of each other).
      const textBlock = (Array.isArray(labelLines) ? labelLines : [])
        .map((ln) => String(ln || '').trim())
        .filter(Boolean)
        .join(' ');
      const wrapped = textBlock
        ? pdf.splitTextToSize(textBlock, Math.max(10, lw - 4)).slice(0, 3)
        : [];

      let textY = y + textTop + textLineMm;
      for (const line of wrapped) {
        pdf.text(String(line), x + lw / 2, textY, { align: 'center' });
        textY += textLineMm;
      }

      const textBottom = wrapped.length ? textY - textLineMm * 0.15 : y + textTop;
      const pad = 1.5;
      const imgTop = textBottom + barcodeTop;
      const imgMaxW = Math.max(8, lw - pad * 2);
      const imgMaxH = Math.max(6, y + lh - pad - imgTop);
      // Fit barcode inside remaining label space (keeps huge bar-height settings from overflowing).
      const nativeRatio = 0.42;
      let imgW = imgMaxW;
      let imgH = imgW * nativeRatio;
      if (imgH > imgMaxH) {
        imgH = imgMaxH;
        imgW = Math.min(imgMaxW, imgH / nativeRatio);
      }
      const imgX = x + (lw - imgW) / 2;
      const imgY = imgTop;

      try {
        if (imgMaxH >= 4) {
          pdf.addImage(barcodePng, 'PNG', imgX, imgY, imgW, imgH);
        }
      } catch {
        // Skip image if encoding fails for this page; keep label box + text.
      }

      // Silence unused labelIdx lint in some configs
      void labelIdx;
    });
  });

  if (!pdf) {
    throw new Error('Could not build PDF');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeFilenamePart(productName)}-barcodes-${stamp}.pdf`;
  pdf.save(filename);
  return filename;
}
