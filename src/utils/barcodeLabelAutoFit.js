/**
 * Derive font / barcode sizes so content fills a physical label.
 * @param {{ labelWidthMm: number, labelHeightMm: number, hasText?: boolean, showBarcodeNumber?: boolean }} opts
 */
export function computeLabelAutoFit(opts) {
  const lw = Math.max(20, Math.min(250, Number(opts.labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(opts.labelHeightMm) || 50));
  const hasText = Boolean(opts.hasText);
  const showBarcodeNumber = Boolean(opts.showBarcodeNumber);

  // Product text ~22% of label height.
  const fontSize = hasText
    ? Math.max(9, Math.min(28, Math.round(lh * 0.22)))
    : Math.max(8, Math.min(16, Math.round(lh * 0.14)));

  const textBlockMm = hasText ? Math.min(lh * 0.28, fontSize * 0.4 * 3) : 0;
  const numberReserveMm = showBarcodeNumber ? Math.min(7, lh * 0.12) : 0;
  const padMm = 2;
  const barcodeMaxHeightMm = Math.max(10, lh - textBlockMm - numberReserveMm - padMm);

  // Tall bars so when the PNG is scaled to label width it still looks thick.
  const barHeightPx = Math.max(
    40,
    Math.min(280, Math.round((barcodeMaxHeightMm / 25.4) * 96 * 1.15))
  );

  // Narrower modules → denser code → scales up larger on the sticker.
  const moduleWidth = Math.max(1, Math.min(3, Math.round(lw / 55) || 2));

  return {
    fontSize,
    barHeightPx,
    moduleWidth,
    barcodeMaxHeightMm: Math.round(barcodeMaxHeightMm * 100) / 100,
    textBlockMm: Math.round(textBlockMm * 100) / 100,
  };
}
