/**
 * Derive font / barcode sizes so content fills a physical label.
 * @param {{ labelWidthMm: number, labelHeightMm: number, hasText?: boolean, showBarcodeNumber?: boolean }} opts
 */
export function computeLabelAutoFit(opts) {
  const lw = Math.max(20, Math.min(250, Number(opts.labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(opts.labelHeightMm) || 50));
  const hasText = Boolean(opts.hasText);
  const showBarcodeNumber = Boolean(opts.showBarcodeNumber);

  // Font in mm so print size tracks the sticker (px stays tiny on thermal printers).
  const fontSizeMm = hasText
    ? Math.max(2.8, Math.min(7, Math.round(lh * 0.14 * 10) / 10))
    : Math.max(2.2, Math.min(4, Math.round(lh * 0.1 * 10) / 10));

  // Rough px equivalent for JsBarcode human-readable digits only.
  const fontSize = Math.max(10, Math.min(28, Math.round(fontSizeMm * 3.8)));

  const textBlockMm = hasText ? Math.min(lh * 0.34, fontSizeMm * 1.25 * 3) : 0;
  const numberReserveMm = showBarcodeNumber ? Math.min(6, lh * 0.1) : 0;
  const padMm = 1.5;
  const barcodeMaxHeightMm = Math.max(12, lh - textBlockMm - numberReserveMm - padMm);

  const barHeightPx = Math.max(
    48,
    Math.min(300, Math.round((barcodeMaxHeightMm / 25.4) * 96))
  );

  const moduleWidth = Math.max(1, Math.min(3, Math.round(lw / 50) || 2));

  return {
    fontSize,
    fontSizeMm,
    barHeightPx,
    moduleWidth,
    barcodeMaxHeightMm: Math.round(barcodeMaxHeightMm * 100) / 100,
    textBlockMm: Math.round(textBlockMm * 100) / 100,
  };
}
