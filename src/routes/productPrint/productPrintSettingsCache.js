const STORAGE_KEY = 'posProductPrintSettings';

export const DEFAULT_PRODUCT_PRINT_SETTINGS = {
  priceSuffix: 'RS KG',
  discountPercent: '10',
  totalCols: 4,
  totalRows: 3,
  pageFormat: 'a4',
  orientation: 'portrait',
  sheetWidthIn: 8.27,
  sheetHeightIn: 11.69,
  labelGapMm: 2,
  sheetMarginMm: 4,
  fontSize: 14,
  showRegularPrice: true,
  showDiscountedPrice: true,
  categoryFilterId: '',
};

const VALID_PAGE_FORMATS = new Set(['a4', 'letter', 'legal', 'custom']);
const VALID_ORIENTATIONS = new Set(['portrait', 'landscape']);

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Load cached label/page settings from localStorage. */
export function loadProductPrintSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_PRODUCT_PRINT_SETTINGS };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRODUCT_PRINT_SETTINGS };

    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_PRODUCT_PRINT_SETTINGS };

    const pageFormat = VALID_PAGE_FORMATS.has(saved.pageFormat)
      ? saved.pageFormat
      : DEFAULT_PRODUCT_PRINT_SETTINGS.pageFormat;
    const orientation = VALID_ORIENTATIONS.has(saved.orientation)
      ? saved.orientation
      : DEFAULT_PRODUCT_PRINT_SETTINGS.orientation;

    return {
      priceSuffix:
        saved.priceSuffix != null
          ? String(saved.priceSuffix)
          : DEFAULT_PRODUCT_PRINT_SETTINGS.priceSuffix,
      discountPercent:
        saved.discountPercent != null
          ? String(saved.discountPercent)
          : DEFAULT_PRODUCT_PRINT_SETTINGS.discountPercent,
      totalCols: Math.min(
        6,
        Math.max(1, Math.round(toNumber(saved.totalCols, DEFAULT_PRODUCT_PRINT_SETTINGS.totalCols)))
      ),
      totalRows: Math.min(
        6,
        Math.max(1, Math.round(toNumber(saved.totalRows, DEFAULT_PRODUCT_PRINT_SETTINGS.totalRows)))
      ),
      pageFormat,
      orientation,
      sheetWidthIn: toNumber(saved.sheetWidthIn, DEFAULT_PRODUCT_PRINT_SETTINGS.sheetWidthIn),
      sheetHeightIn: toNumber(saved.sheetHeightIn, DEFAULT_PRODUCT_PRINT_SETTINGS.sheetHeightIn),
      labelGapMm: Math.max(0, toNumber(saved.labelGapMm, DEFAULT_PRODUCT_PRINT_SETTINGS.labelGapMm)),
      sheetMarginMm: Math.max(
        0,
        toNumber(saved.sheetMarginMm, DEFAULT_PRODUCT_PRINT_SETTINGS.sheetMarginMm)
      ),
      fontSize: toNumber(saved.fontSize, DEFAULT_PRODUCT_PRINT_SETTINGS.fontSize),
      showRegularPrice:
        saved.showRegularPrice !== undefined
          ? Boolean(saved.showRegularPrice)
          : DEFAULT_PRODUCT_PRINT_SETTINGS.showRegularPrice,
      showDiscountedPrice:
        saved.showDiscountedPrice !== undefined
          ? Boolean(saved.showDiscountedPrice)
          : DEFAULT_PRODUCT_PRINT_SETTINGS.showDiscountedPrice,
      categoryFilterId:
        saved.categoryFilterId != null
          ? String(saved.categoryFilterId)
          : DEFAULT_PRODUCT_PRINT_SETTINGS.categoryFilterId,
    };
  } catch {
    return { ...DEFAULT_PRODUCT_PRINT_SETTINGS };
  }
}

/** Persist label/page settings to localStorage. */
export function saveProductPrintSettings(settings) {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}
