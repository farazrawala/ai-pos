/**
 * Derive font / barcode sizes so content fills a physical label.
 * @param {{ labelWidthMm: number, labelHeightMm: number, hasText?: boolean, showBarcodeNumber?: boolean }} opts
 */
export function computeLabelAutoFit(opts) {
  const lw = Math.max(20, Math.min(250, Number(opts.labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(opts.labelHeightMm) || 50));
  const hasText = Boolean(opts.hasText);
  const showBarcodeNumber = Boolean(opts.showBarcodeNumber);

  // ~18% of label height for product text; clamp for tiny/huge stickers.
  const fontSize = hasText
    ? Math.max(8, Math.min(20, Math.round(lh * 0.2)))
    : Math.max(8, Math.min(14, Math.round(lh * 0.14)));

  // Reserve space for up to 3 text lines (mm ≈ px * 0.35 at 96dpi).
  const textBlockMm = hasText ? Math.min(lh * 0.32, fontSize * 0.38 * 3) : 0;
  const numberReserveMm = showBarcodeNumber ? Math.min(6, lh * 0.1) : 0;
  const padMm = 2.5;
  const barcodeMaxHeightMm = Math.max(8, lh - textBlockMm - numberReserveMm - padMm);

  // JsBarcode bar height in px — tall enough that width-scaled SVG fills the area.
  const barHeightPx = Math.max(
    28,
    Math.min(220, Math.round((barcodeMaxHeightMm / 25.4) * 96))
  );

  // Module width: thicker bars on wider labels (still scannable when scaled).
  const moduleWidth = Math.max(1, Math.min(5, Math.round(lw / 28)));

  return {
    fontSize,
    barHeightPx,
    moduleWidth,
    barcodeMaxHeightMm: Math.round(barcodeMaxHeightMm * 100) / 100,
    textBlockMm: Math.round(textBlockMm * 100) / 100,
  };
}
