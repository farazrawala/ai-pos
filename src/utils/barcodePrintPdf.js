import JsBarcode from 'jsbarcode';
import { computeLabelAutoFit } from './barcodeLabelAutoFit.js';

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

function usedRowsForChunk(labelCount, cols, rows, sheetHeightMode) {
  const filledRows = Math.max(1, Math.ceil(labelCount / cols));
  if (sheetHeightMode === 'per-label' || sheetHeightMode === 'auto') return filledRows;
  return Math.min(rows, filledRows);
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
 * @returns {{ dataUrl: string, width: number, height: number }}
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
  const barH = Math.max(20, Math.min(160, Number(barCodeHeightField) || 40));
  const fs = Math.max(8, Math.min(24, Number(fontSize) || 11));
  JsBarcode(canvas, String(encodeValue), {
    format,
    displayValue: Boolean(showBarcodeNumber),
    width: modW,
    height: barH,
    fontSize: fs,
    margin: 2,
    background: '#ffffff',
    lineColor: '#000000',
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width || 1,
    height: canvas.height || 1,
  };
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
    sheetHeightMode = 'per-label',
    sheetHeightAuto = undefined,
    sheetWidthAuto = false,
    sheetWidthIn = 6.3,
    sheetHeightIn = 2,
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
    autoFitLabel = true,
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

  const c = Math.max(1, Math.min(12, Number(cols) || 1));
  const r = Math.max(1, Math.min(12, Number(rows) || 1));
  const count = Math.min(200, Math.max(1, Number(totalLabels) || 1));
  const lw = Math.max(20, Math.min(250, Number(labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(labelHeightMm) || 50));
  const hasText = (Array.isArray(labelLines) ? labelLines : []).some((ln) => String(ln || '').trim());
  const fitted = computeLabelAutoFit({
    labelWidthMm: lw,
    labelHeightMm: lh,
    hasText,
    showBarcodeNumber,
  });
  const useAuto = autoFitLabel !== false;
  const effectiveFontSize = useAuto
    ? Math.max(14, Math.min(36, Math.round((fitted.fontSizeMm || 3.5) * 4.2)))
    : fontSize;
  const effectiveBarWidth = useAuto ? fitted.moduleWidth * 10 : barCodeWidthField;
  const effectiveBarHeight = useAuto ? fitted.barHeightPx : barCodeHeightField;
  const textTop = useAuto ? 0.5 : Math.max(0, Math.min(30, Number(textMarginTopMm) || 0));
  const barcodeTop = useAuto ? 0.3 : Math.max(0, Math.min(30, Number(barcodeMarginTopMm) || 0));

  const barcode = renderBarcodePngDataUrl({
    encodeValue,
    format,
    barCodeWidthField: effectiveBarWidth,
    barCodeHeightField: effectiveBarHeight,
    fontSize: effectiveFontSize,
    showBarcodeNumber,
  });
  const barcodePng = barcode.dataUrl;
  const barcodeNativeRatio = barcode.height / Math.max(1, barcode.width);
  const gH = Math.max(0, Number(gapH) || 0);
  const gV = Math.max(0, Number(gapV) || 0);
  const mTop = Math.max(0, Number(marginTop) || 0);
  const mLeft = Math.max(0, Number(marginLeft) || 0);
  const mBottom = Math.max(0, Number(marginBottom) || 0);
  const mode =
    sheetHeightMode === 'per-label' || sheetHeightMode === 'auto' || sheetHeightMode === 'fixed'
      ? sheetHeightMode
      : sheetHeightAuto === false
        ? 'fixed'
        : sheetHeightAuto === true
          ? 'auto'
          : 'per-label';
  const layoutCols = mode === 'per-label' ? 1 : c;
  const contentW = roundMm(mLeft + layoutCols * lw + Math.max(0, layoutCols - 1) * gH);
  // UI passes resolved sheetWidthMm; fall back to auto content width or fixed inches.
  const pageW = Math.max(
    20,
    mode === 'per-label'
      ? roundMm(Number(sheetWidthMm) > 0 ? Number(sheetWidthMm) : lw)
      : Number(sheetWidthMm) > 0
        ? roundMm(Number(sheetWidthMm))
        : sheetWidthAuto
          ? contentW
          : inchesToMm(sheetWidthIn)
  );
  const slotsPerSheet = r * c;
  const indices = Array.from({ length: count }, (_, i) => i);
  const sheets =
    mode === 'per-label'
      ? chunk(indices, 1)
      : mode === 'auto'
        ? [indices]
        : chunk(indices, slotsPerSheet);
  const fs = Math.max(8, Math.min(24, Number(effectiveFontSize) || 11));
  // Approximate px→mm for text: ~0.35mm per CSS px at 96dpi
  const textLineMm = Math.max(2.5, fs * 0.32);

  let pdf = null;

  sheets.forEach((slotIndices) => {
    const usedRows = usedRowsForChunk(slotIndices.length, layoutCols, r, mode);
    const pageH =
      mode === 'fixed'
        ? Math.max(15, inchesToMm(sheetHeightIn))
        : mode === 'per-label'
          ? roundMm(lh)
          : roundMm(mTop + sheetContentHeightMm(usedRows, lh, gV) + mBottom);
    // Match orientation to size so jsPDF does not swap width/height.
    const orientation = pageW > pageH ? 'landscape' : 'portrait';

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
      const col = i % layoutCols;
      const row = Math.floor(i / layoutCols);
      const x = mode === 'per-label' ? 0 : mLeft + col * (lw + gH);
      const y = mode === 'per-label' ? 0 : mTop + row * (lh + gV);

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
      const pad = useAuto ? 0.8 : 1.5;
      const imgTop = textBottom + barcodeTop;
      const imgMaxW = Math.max(8, lw - pad * 2);
      const imgMaxH = Math.max(6, y + lh - pad - imgTop);
      let imgW;
      let imgH;
      if (useAuto) {
        // Stretch to fill remaining label area (matches on-screen auto-fit).
        imgW = imgMaxW;
        imgH = imgMaxH;
      } else {
        imgW = imgMaxW;
        imgH = imgW * barcodeNativeRatio;
        if (imgH > imgMaxH) {
          imgH = imgMaxH;
          imgW = Math.min(imgMaxW, imgH / Math.max(0.05, barcodeNativeRatio));
        }
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
