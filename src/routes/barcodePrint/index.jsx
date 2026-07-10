import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import JsBarcode from 'jsbarcode';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import {
  getCompanyIdFromUser,
  fetchCompanyById,
  patchCompanyBarcodeSettings,
  extractBarcodeSettingsFromCompanyBody,
  normalizeIncomingBarcodeSettings,
  buildBarcodeSettingsPayload,
} from '../../features/company/companyAPI.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { downloadBarcodeLabelsPdf } from '../../utils/barcodePrintPdf.js';
import { computeLabelAutoFit } from '../../utils/barcodeLabelAutoFit.js';
import './barcode-print-module.css';

const B_TYPES = [
  { value: '1', format: 'EAN13', label: 'EAN-13' },
  { value: '2', format: 'CODE128', label: 'CODE-128' },
  { value: '3', format: 'CODE39', label: 'CODE-39' },
  { value: '4', format: 'EAN5', label: 'EAN-5' },
  { value: '5', format: 'EAN8', label: 'EAN-8' },
  { value: '6', format: 'UPC', label: 'UPC-A' },
  { value: '7', format: 'UPCE', label: 'UPC-E' },
];

const ROW_COL_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20];

const productId = (p) => p?._id || p?.id || p?.product_id;

const productName = (p) => p?.name || p?.product_name || 'Product';

const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');

function priceLine(product) {
  if (!product) return '';
  const raw = product.price ?? product.product_price ?? product.sale_price;
  if (raw === undefined || raw === null || raw === '') return '';
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return String(raw);
  return `$${n.toFixed(2)}`;
}

function wrapToMaxChars(text, maxChars) {
  const t = String(text ?? '').trim();
  if (!t) return [];
  const m = Math.max(8, Math.min(120, Number(maxChars) || 50));
  if (t.length <= m) return [t];

  const lines = [];
  let remaining = t;
  while (remaining.length > 0) {
    if (remaining.length <= m) {
      lines.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(' ', m);
    if (cut < Math.floor(m * 0.4)) cut = m;
    lines.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  return lines.filter(Boolean);
}

function buildLabelLines(product, settings) {
  const { showProductName, showPrice, maxChars } = settings;
  const lines = [];
  const pushBlock = (text) => {
    wrapToMaxChars(text, maxChars).forEach((ln) => lines.push(ln));
  };
  if (showProductName) pushBlock(productName(product));
  if (showPrice) pushBlock(priceLine(product));
  return lines;
}

/**
 * Build the string passed to JsBarcode for the selected symbology.
 * Returns { value, hint } where hint is optional UI guidance.
 */
function resolveEncodeValue(product, formatUpper, overrideTrimmed) {
  if (overrideTrimmed) {
    return { value: overrideTrimmed, hint: null };
  }
  if (!product) {
    return { value: '', hint: null };
  }

  const barcode = String(product.barcode ?? '').trim();
  const sku = String(product.sku ?? '').trim();
  const code = String(product.product_code ?? '').trim();
  const digitPool = digitsOnly(`${barcode}${sku}${code}`);

  if (formatUpper === 'CODE128') {
    const v = barcode || sku || code;
    if (!v) {
      return {
        value: '',
        hint: 'Add a barcode, SKU, or product code on the product, or enter custom text below.',
      };
    }
    return { value: v, hint: null };
  }

  if (formatUpper === 'CODE39') {
    const raw = (barcode || sku || code).toUpperCase();
    const v = raw.replace(/[^0-9A-Z\-. $/+%]/g, '');
    if (!v) {
      return {
        value: '',
        hint: 'CODE-39 needs letters, digits, space, or $ % + - . / in the product codes.',
      };
    }
    return { value: v, hint: null };
  }

  if (formatUpper === 'EAN13') {
    if (digitPool.length >= 12) {
      return { value: digitPool.slice(0, 12), hint: null };
    }
    return {
      value: '',
      hint: 'EAN-13 needs at least 12 digits from barcode/SKU/code, or use CODE-128, or enter 12 digits below.',
    };
  }

  if (formatUpper === 'EAN8') {
    if (digitPool.length >= 7) {
      return { value: digitPool.slice(0, 7), hint: null };
    }
    return {
      value: '',
      hint: 'EAN-8 needs at least 7 digits from barcode/SKU/code, or use CODE-128, or enter 7 digits below.',
    };
  }

  if (formatUpper === 'EAN5') {
    if (digitPool.length >= 5) {
      return { value: digitPool.slice(0, 5), hint: null };
    }
    return {
      value: '',
      hint: 'EAN-5 needs 5 digits from barcode/SKU/code, or enter 5 digits below.',
    };
  }

  if (formatUpper === 'UPC') {
    if (digitPool.length >= 11) {
      return { value: digitPool.slice(0, 11), hint: null };
    }
    return {
      value: '',
      hint: 'UPC-A needs at least 11 digits from barcode/SKU/code, or use CODE-128, or enter 11 digits below.',
    };
  }

  if (formatUpper === 'UPCE') {
    if (digitPool.length >= 6) {
      const six = digitPool.slice(0, 6);
      const eight = digitPool.slice(0, 8);
      if (eight.length === 8 && /^[01]/.test(eight)) {
        return { value: eight, hint: null };
      }
      return { value: six, hint: null };
    }
    return {
      value: '',
      hint: 'UPC-E needs at least 6 digits from barcode/SKU/code, or try UPC-A / CODE-128.',
    };
  }

  return { value: barcode || sku || code, hint: null };
}

function jsBarcodeWidthFromUi(barCodeWidthField) {
  const n = Number(barCodeWidthField);
  if (!Number.isFinite(n) || n <= 0) return 2;
  return Math.max(1, Math.min(6, Math.round(n / 10)));
}

function chunk(arr, size) {
  if (size <= 0) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Label grid content height for one sheet (mm). */
function sheetContentHeightMm(usedRows, labelHeightMm, gapVerticalMm) {
  const rows = Math.max(1, usedRows);
  const lh = Math.max(1, labelHeightMm);
  const gap = Math.max(0, gapVerticalMm);
  return rows * lh + Math.max(0, rows - 1) * gap;
}

/** Label grid content width (mm), including left margin. */
function sheetContentWidthMm(cols, labelWidthMm, gapHorizontalMm, marginLeft) {
  const c = Math.max(1, cols);
  const lw = Math.max(1, labelWidthMm);
  const gap = Math.max(0, gapHorizontalMm);
  const ml = Math.max(0, marginLeft);
  return ml + c * lw + Math.max(0, c - 1) * gap;
}

function usedRowsForChunk(labelCount, cols, rows, sheetHeightMode) {
  const filledRows = Math.max(1, Math.ceil(labelCount / cols));
  if (sheetHeightMode === 'per-label' || sheetHeightMode === 'auto') return filledRows;
  return Math.min(rows, filledRows);
}

function roundMm(mm) {
  return Math.round(mm * 100) / 100;
}

function inchesToMm(inches) {
  const n = Number(inches);
  if (!Number.isFinite(n)) return 0;
  return roundMm(n * 25.4);
}

/** @page size: exact sheet width × height (no portrait/landscape keyword — that swaps sides). */
function atPageSizeRule(widthMm, heightMm) {
  const w = roundMm(widthMm);
  const h = roundMm(heightMm);
  return `margin: 0; size: ${w}mm ${h}mm`;
}

function printPageName(heightMm) {
  return `bp-h-${String(roundMm(heightMm)).replace('.', '_')}`;
}

function buildPrintDocStyles({ sheetWidthMm, sheetHeightsMm, rollMode }) {
  const unique = [...new Set(sheetHeightsMm.map((h) => roundMm(h)))];
  const wMm = Math.max(20, roundMm(sheetWidthMm));

  // One shared @page size whenever every sheet is the same height.
  // Named @page is poorly supported in Chrome/Edge and often yields a blank first
  // label + tiny scaled content on thermal printers.
  if (unique.length === 1) {
    const h = unique[0];
    const multiPage = !rollMode;
    return `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${wMm}mm;
    ${rollMode ? `height: ${h}mm; max-height: ${h}mm;` : ''}
    max-width: ${wMm}mm;
    overflow: hidden;
    background: #fff;
    font-family: system-ui, sans-serif;
  }
  @page { ${atPageSizeRule(wMm, h)}; }
  .bp-sheet {
    width: ${wMm}mm !important;
    height: ${h}mm !important;
    max-width: ${wMm}mm !important;
    max-height: ${h}mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden;
    ${
      multiPage
        ? `page-break-after: always; break-after: page;`
        : `page-break-before: avoid; page-break-after: avoid; break-before: avoid; break-after: avoid;`
    }
    break-inside: avoid;
  }
  .bp-sheet:last-child { page-break-after: auto; break-after: auto; }
  .barcode-print-label {
    border: none !important;
    width: ${wMm}mm !important;
    height: ${h}mm !important;
    max-width: ${wMm}mm !important;
    max-height: ${h}mm !important;
    display: flex !important;
    flex-direction: column !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .barcode-print-label-barcode {
    width: 100% !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
  }
  .barcode-print-svg {
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
  }
`;
  }

  const pageRules = unique
    .map((h) => `@page ${printPageName(h)} { ${atPageSizeRule(wMm, h)}; }`)
    .join('\n');
  const pageAssign = unique
    .map((h) => `.bp-sheet[data-print-h="${h}"] { page: ${printPageName(h)}; }`)
    .join('\n');
  return `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; font-family: system-ui, sans-serif; }
  .bp-sheet {
    page-break-after: always;
    break-after: page;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden;
    width: ${wMm}mm !important;
  }
  .bp-sheet:last-child { page-break-after: auto; break-after: auto; }
  .barcode-print-label { border: 1px solid #ccc !important; }
  .barcode-print-label-barcode { width: 100% !important; flex: 1 1 auto !important; min-height: 0 !important; }
  .barcode-print-svg { width: 100% !important; max-width: 100% !important; height: 100% !important; max-height: 100% !important; }
  ${pageRules}
  ${pageAssign}
`;
}

/** Screen-safe: only applies during print (never shrinks the live app layout). */
function wrapPrintMedia(css) {
  return `@media print {\n${css}\n}`;
}

function BarcodeLabelCell({
  encodeValue,
  format,
  barCodeWidthField,
  barCodeHeightField,
  fontSize,
  lines,
  labelWidthMm,
  labelHeightMm,
  showBarcodeNumber,
  textMarginTopMm = 0,
  barcodeMarginTopMm = 0,
  autoFitLabel = true,
  index,
}) {
  const svgRef = useRef(null);
  const [err, setErr] = useState(null);
  const maxTextLines = 3;
  const displayText = (Array.isArray(lines) ? lines : []).slice(0, maxTextLines).join('\n');
  const hasText = Boolean(displayText);

  const fitted = useMemo(
    () =>
      computeLabelAutoFit({
        labelWidthMm,
        labelHeightMm,
        hasText,
        showBarcodeNumber,
      }),
    [labelWidthMm, labelHeightMm, hasText, showBarcodeNumber]
  );

  const modW = autoFitLabel ? fitted.moduleWidth : jsBarcodeWidthFromUi(barCodeWidthField);
  const barH = autoFitLabel
    ? fitted.barHeightPx
    : Math.max(20, Math.min(160, Number(barCodeHeightField) || 40));
  const fs = autoFitLabel
    ? fitted.fontSize
    : Math.max(8, Math.min(24, Number(fontSize) || 11));
  const textTop = autoFitLabel ? 0.8 : Math.max(0, Math.min(30, Number(textMarginTopMm) || 0));
  const barcodeTop = autoFitLabel ? 0.6 : Math.max(0, Math.min(30, Number(barcodeMarginTopMm) || 0));
  const lineHeightPx = Math.round(fs * 1.25);
  const textMaxHeightPx = lineHeightPx * Math.min(maxTextLines, Math.max(1, displayText ? displayText.split('\n').length : 1));
  const barcodeMaxHeightMm = autoFitLabel
    ? fitted.barcodeMaxHeightMm
    : Math.max(
        8,
        Number(labelHeightMm) - textTop - barcodeTop - (hasText ? fs * 0.45 * 3 : 2) - 3
      );

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.innerHTML = '';
    if (!encodeValue) {
      setErr('Nothing to encode');
      return;
    }
    try {
      JsBarcode(el, encodeValue, {
        format,
        displayValue: Boolean(showBarcodeNumber),
        width: modW,
        height: barH,
        fontSize: Math.max(10, Math.min(18, fs)),
        margin: 1,
        background: '#ffffff',
        lineColor: '#000000',
      });
      // Ensure SVG scales to the label box (JsBarcode sets fixed px width/height).
      el.removeAttribute('width');
      el.removeAttribute('height');
      el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      el.style.width = '100%';
      el.style.height = '100%';
      setErr(null);
    } catch (e) {
      setErr(e?.message || 'Could not build this barcode');
    }
  }, [encodeValue, format, modW, barH, fs, showBarcodeNumber, index]);

  return (
    <div
      className="barcode-print-label"
      style={{
        width: `${labelWidthMm}mm`,
        height: `${labelHeightMm}mm`,
        boxSizing: 'border-box',
        border: '1px solid #dee2e6',
        pageBreakInside: 'avoid',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: autoFitLabel ? 'space-between' : 'center',
        paddingTop: `${textTop}mm`,
        paddingLeft: '1.5mm',
        paddingRight: '1.5mm',
        paddingBottom: '1.2mm',
        background: '#fff',
      }}
    >
      {displayText ? (
        <div
          className="barcode-print-label-text"
          style={{
            width: '100%',
            textAlign: 'center',
            color: '#111',
            fontSize: `${fs}px`,
            lineHeight: `${lineHeightPx}px`,
            fontWeight: 600,
            flex: '0 0 auto',
            overflow: 'hidden',
            maxHeight: autoFitLabel ? `${fitted.textBlockMm}mm` : `${textMaxHeightPx}px`,
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-line',
          }}
        >
          {displayText}
        </div>
      ) : (
        <div style={{ flex: '0 0 auto', height: 0 }} />
      )}
      {err ? (
        <div
          className="barcode-print-label-barcode text-danger text-center small"
          style={{ marginTop: `${barcodeTop}mm`, width: '100%', flex: '1 1 auto' }}
        >
          {err}
        </div>
      ) : (
        <div
          className="barcode-print-label-barcode"
          style={{
            marginTop: `${barcodeTop}mm`,
            width: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            maxHeight: `${barcodeMaxHeightMm}mm`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            ref={svgRef}
            className="barcode-print-svg"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        </div>
      )}
    </div>
  );
}

const BarcodePrint = () => {
  useRequireModuleAccess('barcode-print');
  const userSlice = useSelector((state) => state.user);
  const user = userSlice?.user;

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [bType, setBType] = useState('1');
  const [labelCount, setLabelCount] = useState(1);
  const [overrideText, setOverrideText] = useState('');

  /** Sheet size on screen and in print (CSS `in`). ~160×50 mm ≈ 6.3×2.0 in. */
  const [sheetWidthIn, setSheetWidthIn] = useState(6.3);
  const [sheetWidthAuto, setSheetWidthAuto] = useState(true);
  /** per-label = label printer (1 page each); auto = continuous roll; fixed = sheet inches */
  const [sheetHeightMode, setSheetHeightMode] = useState('per-label');
  const [sheetHeightIn, setSheetHeightIn] = useState(2);
  const [labelWidthMm, setLabelWidthMm] = useState(80);
  const [labelHeightMm, setLabelHeightMm] = useState(50);
  const [totalRows, setTotalRows] = useState(1);
  const [totalCols, setTotalCols] = useState(2);
  const [labelGapHorizontalMm, setLabelGapHorizontalMm] = useState(0);
  const [labelGapVerticalMm, setLabelGapVerticalMm] = useState(0);
  const [sheetMarginTopMm, setSheetMarginTopMm] = useState(0);
  const [sheetMarginLeftMm, setSheetMarginLeftMm] = useState(0);
  const [sheetMarginBottomMm, setSheetMarginBottomMm] = useState(0);
  const [textMarginTopMm, setTextMarginTopMm] = useState(0);
  const [barcodeMarginTopMm, setBarcodeMarginTopMm] = useState(0);
  const [autoFitLabel, setAutoFitLabel] = useState(true);
  const [barCodeWidthField, setBarCodeWidthField] = useState(50);
  const [barCodeHeightField, setBarCodeHeightField] = useState(30);
  const [fontSize, setFontSize] = useState(11);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeNumber, setShowBarcodeNumber] = useState(true);
  const [maxChars, setMaxChars] = useState(50);

  const [settingsLoadError, setSettingsLoadError] = useState('');
  const [settingsSaveError, setSettingsSaveError] = useState('');
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const companyId = useMemo(() => {
    const merged =
      user && typeof user === 'object'
        ? { ...user, company_id: user.company_id ?? userSlice?.company_id }
        : userSlice?.company_id != null
          ? { company_id: userSlice.company_id }
          : null;
    return getCompanyIdFromUser(merged);
  }, [user, userSlice?.company_id]);

  const loadProducts = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetchProductsRequest({ page: 1, limit: 2000 });
      const rows = Array.isArray(res.data) ? res.data : [];
      rows.sort((a, b) =>
        String(productName(a)).localeCompare(String(productName(b)), undefined, {
          sensitivity: 'base',
        })
      );
      setProducts(rows);
    } catch (e) {
      setListError(e?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!companyId) {
      setSettingsLoadError('');
      return;
    }
    let cancelled = false;
    setSettingsLoadError('');
    (async () => {
      try {
        const body = await fetchCompanyById(companyId);
        if (cancelled) return;
        const raw = extractBarcodeSettingsFromCompanyBody(body);
        const norm = normalizeIncomingBarcodeSettings(raw);
        if (!norm) return;

        const applyBool = (v, setter) => {
          if (v === undefined) return;
          if (v === 'yes' || v === true || v === 1 || v === '1') setter(true);
          else if (v === 'no' || v === false || v === 0 || v === '0') setter(false);
          else setter(Boolean(v));
        };
        const applyNum = (v, setter, fallback) => {
          if (v === undefined) return;
          const n = Number(v);
          if (Number.isFinite(n)) setter(n);
          else if (fallback !== undefined) setter(fallback);
        };
        const applyStr = (v, setter) => {
          if (v === undefined) return;
          setter(String(v));
        };

        if (norm.bType !== undefined) applyStr(norm.bType, setBType);
        if (norm.labelCount !== undefined) applyStr(norm.labelCount, setLabelCount);
        if (norm.sheetWidthIn !== undefined) applyStr(norm.sheetWidthIn, setSheetWidthIn);
        applyBool(norm.sheetWidthAuto, setSheetWidthAuto);
        if (norm.sheetHeightMode === 'per-label' || norm.sheetHeightMode === 'auto' || norm.sheetHeightMode === 'fixed') {
          setSheetHeightMode(norm.sheetHeightMode);
        } else if (norm.sheetHeightAuto === false || norm.sheetHeightAuto === 'no' || norm.sheetHeightAuto === 0) {
          setSheetHeightMode('fixed');
        }
        // Legacy "auto" continuous roll often breaks sticker printers — prefer one label/page.
        if (norm.sheetHeightIn !== undefined) applyStr(norm.sheetHeightIn, setSheetHeightIn);
        if (norm.labelWidthMm !== undefined) applyStr(norm.labelWidthMm, setLabelWidthMm);
        if (norm.labelHeightMm !== undefined) applyStr(norm.labelHeightMm, setLabelHeightMm);
        if (norm.totalRows !== undefined) applyNum(norm.totalRows, setTotalRows, 1);
        if (norm.totalCols !== undefined) applyNum(norm.totalCols, setTotalCols, 1);
        if (norm.labelGapHorizontalMm !== undefined) {
          applyNum(norm.labelGapHorizontalMm, setLabelGapHorizontalMm, 0);
        }
        if (norm.labelGapVerticalMm !== undefined) {
          applyNum(norm.labelGapVerticalMm, setLabelGapVerticalMm, 0);
        }
        if (norm.sheetMarginTopMm !== undefined) {
          applyNum(norm.sheetMarginTopMm, setSheetMarginTopMm, 0);
        }
        if (norm.sheetMarginLeftMm !== undefined) {
          applyNum(norm.sheetMarginLeftMm, setSheetMarginLeftMm, 0);
        }
        if (norm.sheetMarginBottomMm !== undefined) {
          applyNum(norm.sheetMarginBottomMm, setSheetMarginBottomMm, 0);
        }
        if (norm.textMarginTopMm !== undefined) {
          applyNum(norm.textMarginTopMm, setTextMarginTopMm, 0);
        }
        if (norm.barcodeMarginTopMm !== undefined) {
          applyNum(norm.barcodeMarginTopMm, setBarcodeMarginTopMm, 0);
        }
        applyBool(norm.autoFitLabel, setAutoFitLabel);
        if (norm.barCodeWidthField !== undefined) applyStr(norm.barCodeWidthField, setBarCodeWidthField);
        if (norm.barCodeHeightField !== undefined) applyStr(norm.barCodeHeightField, setBarCodeHeightField);
        if (norm.fontSize !== undefined) applyNum(norm.fontSize, setFontSize, 11);
        if (norm.maxChars !== undefined) applyStr(norm.maxChars, setMaxChars);
        applyBool(norm.showProductName, setShowProductName);
        applyBool(norm.showPrice, setShowPrice);
        applyBool(norm.showBarcodeNumber, setShowBarcodeNumber);
      } catch (e) {
        if (!cancelled) {
          setSettingsLoadError(e?.message || 'Could not load company barcode settings');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(productId(p)) === String(selectedId)) || null,
    [products, selectedId]
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const id = String(productId(p));
        const sku = String(p.sku || p.product_code || p.barcode || '').trim();
        const parts = [sku, p.barcode ? `Barcode: ${p.barcode}` : ''].filter(Boolean);
        return {
          value: id,
          label: productName(p),
          subLabel: parts.length ? parts.join(' · ') : undefined,
        };
      }),
    [products]
  );

  const format = useMemo(() => {
    const row = B_TYPES.find((t) => t.value === bType);
    return row?.format || 'CODE128';
  }, [bType]);

  const { value: encodeValue, hint: encodeHint } = useMemo(
    () => resolveEncodeValue(selectedProduct, format, overrideText.trim()),
    [selectedProduct, format, overrideText]
  );

  const lineSettings = useMemo(
    () => ({
      showProductName,
      showPrice,
      maxChars,
    }),
    [showProductName, showPrice, maxChars]
  );

  const labelLines = useMemo(
    () =>
      selectedProduct
        ? buildLabelLines(selectedProduct, lineSettings)
        : [],
    [selectedProduct, lineSettings]
  );

  const totalLabels = Math.min(200, Math.max(1, Number(labelCount) || 1));
  const rows = Math.min(12, Math.max(1, Number(totalRows) || 1));
  const cols = Math.min(12, Math.max(1, Number(totalCols) || 1));
  const slotsPerSheet = rows * cols;

  const sheetChunks = useMemo(() => {
    const indices = Array.from({ length: totalLabels }, (_, i) => i);
    // Label printer: one sticker = one page at label size (avoids 90° rotate/shrink).
    if (sheetHeightMode === 'per-label') return chunk(indices, 1);
    // Continuous roll: one tall sheet for all labels.
    if (sheetHeightMode === 'auto') return [indices];
    return chunk(indices, slotsPerSheet);
  }, [totalLabels, slotsPerSheet, sheetHeightMode]);

  const swIn = Math.max(1, Math.min(24, Number(sheetWidthIn) || 6.3));
  const shIn = Math.max(0.5, Math.min(36, Number(sheetHeightIn) || 2));
  const lw = Math.max(20, Math.min(250, Number(labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(labelHeightMm) || 50));
  const gapH = Math.max(0, Math.min(20, Number(labelGapHorizontalMm) || 0));
  const gapV = Math.max(0, Math.min(20, Number(labelGapVerticalMm) || 0));
  const marginTop = Math.max(0, Math.min(50, Number(sheetMarginTopMm) || 0));
  const marginLeft = Math.max(0, Math.min(50, Number(sheetMarginLeftMm) || 0));
  const marginBottom = Math.max(0, Math.min(50, Number(sheetMarginBottomMm) || 0));
  const textTopMargin = Math.max(0, Math.min(30, Number(textMarginTopMm) || 0));
  const barcodeTopMargin = Math.max(0, Math.min(30, Number(barcodeMarginTopMm) || 0));
  const sheetContentWidth = roundMm(sheetContentWidthMm(cols, lw, gapH, marginLeft));
  // Label printer: page must match sticker exactly — sheet margins inflate the page and
  // cause the driver to shrink content (tiny band + blank first label).
  const printMarginTop = sheetHeightMode === 'per-label' ? 0 : marginTop;
  const printMarginLeft = sheetHeightMode === 'per-label' ? 0 : marginLeft;
  const printMarginBottom = sheetHeightMode === 'per-label' ? 0 : marginBottom;
  /** Page/sheet width used for preview, print, and PDF. */
  const sheetPrintWidthMm =
    sheetHeightMode === 'per-label'
      ? roundMm(Math.max(20, lw))
      : sheetWidthAuto
        ? Math.max(20, sheetContentWidth)
        : Math.max(20, inchesToMm(swIn));
  const layoutCols = sheetHeightMode === 'per-label' ? 1 : cols;

  const previewScale = useMemo(() => {
    const sheetPxW = (sheetPrintWidthMm / 25.4) * 96;
    const maxW = 400;
    return sheetPxW > maxW ? maxW / sheetPxW : 1;
  }, [sheetPrintWidthMm]);

  const formatLabel = useMemo(
    () => B_TYPES.find((t) => t.value === bType)?.label || 'CODE-128',
    [bType]
  );

  const sheetPrintHeightsMm = useMemo(
    () =>
      sheetChunks.map((chunkItems) => {
        if (sheetHeightMode === 'fixed') return Math.max(15, inchesToMm(shIn));
        if (sheetHeightMode === 'per-label') return roundMm(lh);
        const usedRows = usedRowsForChunk(chunkItems.length, layoutCols, rows, sheetHeightMode);
        return roundMm(printMarginTop + sheetContentHeightMm(usedRows, lh, gapV) + printMarginBottom);
      }),
    [sheetChunks, layoutCols, rows, sheetHeightMode, printMarginTop, printMarginBottom, lh, gapV, shIn]
  );

  const printDocStyles = useMemo(
    () =>
      buildPrintDocStyles({
        sheetWidthMm: sheetPrintWidthMm,
        sheetHeightsMm: sheetPrintHeightsMm,
        rollMode: sheetHeightMode === 'auto',
      }),
    [sheetPrintWidthMm, sheetPrintHeightsMm, sheetHeightMode]
  );

  const printMediaStyles = useMemo(() => wrapPrintMedia(printDocStyles), [printDocStyles]);

  const renderLabelSheets = (chunks) =>
    chunks.map((slotIndices, sheetIdx) => {
      const usedRows = usedRowsForChunk(slotIndices.length, layoutCols, rows, sheetHeightMode);
      const sheetHeightMm =
        sheetPrintHeightsMm[sheetIdx] ??
        roundMm(printMarginTop + sheetContentHeightMm(usedRows, lh, gapV) + printMarginBottom);
      return (
        <div
          key={sheetIdx}
          className="bp-sheet mb-3"
          data-print-h={sheetHeightMm}
          style={{
            width: `${sheetPrintWidthMm}mm`,
            boxSizing: 'border-box',
            height: `${sheetHeightMm}mm`,
            minHeight: 'unset',
            maxHeight: `${sheetHeightMm}mm`,
            paddingTop: `${printMarginTop}mm`,
            paddingLeft: `${printMarginLeft}mm`,
            paddingBottom: `${printMarginBottom}mm`,
            display: 'grid',
            gridTemplateColumns: `repeat(${layoutCols}, ${lw}mm)`,
            gridTemplateRows: `repeat(${usedRows}, ${lh}mm)`,
            columnGap: `${gapH}mm`,
            rowGap: `${gapV}mm`,
            alignContent: 'start',
            justifyContent: 'start',
            border: '1px dashed #adb5bd',
            background: '#fff',
          }}
        >
          {slotIndices.map((labelIdx) => (
            <BarcodeLabelCell
              key={`${sheetIdx}-${labelIdx}-${selectedId}-${format}-${encodeValue}-${showBarcodeNumber}`}
              index={labelIdx}
              encodeValue={encodeValue}
              format={format}
              barCodeWidthField={barCodeWidthField}
              barCodeHeightField={barCodeHeightField}
              fontSize={fontSize}
              lines={labelLines}
              labelWidthMm={lw}
              labelHeightMm={lh}
              showBarcodeNumber={showBarcodeNumber}
              textMarginTopMm={textTopMargin}
              barcodeMarginTopMm={barcodeTopMargin}
              autoFitLabel={autoFitLabel}
            />
          ))}
        </div>
      );
    });

  const handleSaveSettings = async () => {
    setSettingsSaveError('');
    setSettingsSaveMessage('');
    if (!companyId) {
      setSettingsSaveError('Your account is not linked to a company, so settings cannot be saved.');
      return;
    }
    setSettingsSaving(true);
    try {
      const payload = buildBarcodeSettingsPayload({
        bType,
        labelCount: Number(labelCount) || 1,
        sheetWidthIn: Number(sheetWidthIn) || 6.3,
        sheetWidthAuto,
        sheetHeightMode,
        sheetHeightIn: Number(sheetHeightIn) || 2,
        labelWidthMm: Number(labelWidthMm) || 80,
        labelHeightMm: Number(labelHeightMm) || 50,
        totalRows: Number(totalRows) || 1,
        totalCols: Number(totalCols) || 1,
        labelGapHorizontalMm: gapH,
        labelGapVerticalMm: gapV,
        sheetMarginTopMm: marginTop,
        sheetMarginLeftMm: marginLeft,
        sheetMarginBottomMm: marginBottom,
        textMarginTopMm: textTopMargin,
        barcodeMarginTopMm: barcodeTopMargin,
        autoFitLabel,
        barCodeWidthField: Number(barCodeWidthField) || 50,
        barCodeHeightField: Number(barCodeHeightField) || 30,
        fontSize: Number(fontSize) || 11,
        showProductName,
        showLocation: false,
        showWarehouse: false,
        showPrice,
        showProductCode: false,
        showBarcodeNumber,
        maxChars: Number(maxChars) || 50,
      });
      await patchCompanyBarcodeSettings(companyId, payload);
      setSettingsSaveMessage('Barcode print settings saved for your company.');
    } catch (e) {
      setSettingsSaveError(e?.message || 'Save failed');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedProduct || !encodeValue) return;
    window.print();
  };

  const handlePrintPage = () => {
    if (!selectedProduct || !encodeValue) return;
    const root = document.getElementById('barcode-print-sheets-root');
    if (!root) return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Barcode print');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Barcodes</title>
      <style>${printDocStyles}</style></head><body>${root.innerHTML}</body></html>`;
    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const runPrint = () => {
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
      setTimeout(cleanup, 500);
    };

    if (win?.document?.readyState === 'complete') {
      runPrint();
    } else if (win) {
      win.onload = runPrint;
      setTimeout(runPrint, 500);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedProduct || !encodeValue || pdfExporting) return;
    setPdfError('');
    setPdfExporting(true);
    try {
      await downloadBarcodeLabelsPdf({
        encodeValue,
        format,
        labelLines,
        totalLabels,
        cols,
        rows,
        sheetHeightMode,
        sheetWidthAuto,
        sheetWidthIn: swIn,
        sheetWidthMm: sheetPrintWidthMm,
        labelWidthMm: lw,
        labelHeightMm: lh,
        gapH,
        gapV,
        marginTop: printMarginTop,
        marginLeft: printMarginLeft,
        marginBottom: printMarginBottom,
        textMarginTopMm: textTopMargin,
        barcodeMarginTopMm: barcodeTopMargin,
        autoFitLabel,
        barCodeWidthField,
        barCodeHeightField,
        fontSize,
        showBarcodeNumber,
        productName: productName(selectedProduct),
      });
    } catch (e) {
      setPdfError(e?.message || 'Could not create PDF');
    } finally {
      setPdfExporting(false);
    }
  };

  const yesNoSelect = (value, onChange) => (
    <select className="form-select" value={value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')}>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );

  return (
    <div
      className={`container-fluid py-4 px-3 px-lg-4 barcode-print-page${sheetHeightMode === 'auto' ? ' bp-roll-print' : ''}`}
    >
      <style>{printMediaStyles}</style>
      <div className="row">
        <div className="col-12">
          <div className="card shadow-sm barcode-print-main-card">
            <div className="card-header pb-3 barcode-print-toolbar">
              <h5 className="mb-1">Print barcodes</h5>
              <p className="text-sm text-muted mb-0">
                Configure labels on the left; the preview updates live on the right. Save settings to your company,
                print, or download a PDF when ready.
              </p>
            </div>

            <div className="card-body barcode-print-toolbar">
              {settingsLoadError ? (
                <div className="alert alert-warning py-2 mb-3" role="status">
                  {settingsLoadError}
                </div>
              ) : null}
              {settingsSaveError ? (
                <div className="alert alert-danger py-2 mb-3" role="alert">
                  {settingsSaveError}
                </div>
              ) : null}
              {settingsSaveMessage ? (
                <div className="alert alert-success py-2 mb-3" role="status">
                  {settingsSaveMessage}
                </div>
              ) : null}
              {listError ? (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  {listError}
                </div>
              ) : null}

              <div className="row g-4 align-items-start">
                <div className="col-lg-7 barcode-print-settings-col">
                  <section className="barcode-print-section">
                    <h6 className="barcode-print-section-title">Product</h6>
                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label">Product</label>
                        <SearchableSelect
                          options={productOptions}
                          value={selectedId}
                          placeholder="Search and select product…"
                          disabled={listLoading}
                          onChange={setSelectedId}
                        />
                        {listLoading ? (
                          <span className="barcode-print-field-hint">Loading products…</span>
                        ) : null}
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Barcode type</label>
                        <select
                          className="form-select"
                          name="b_type"
                          value={bType}
                          onChange={(e) => setBType(e.target.value)}
                        >
                          {B_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Total labels</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={200}
                          value={labelCount}
                          onChange={(e) => setLabelCount(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">Rows × columns below</span>
                      </div>
                      <div className="col-md-8">
                        <label className="form-label">Custom encode text (optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Overrides barcode / SKU / product code when filled"
                          value={overrideText}
                          onChange={(e) => setOverrideText(e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="barcode-print-section">
                    <h6 className="barcode-print-section-title">Sheet &amp; label size</h6>
                    <div className="row g-3">
                      <div className="col-6 col-md-3">
                        <label className="form-label">Sheet width</label>
                        <select
                          className="form-select"
                          value={sheetWidthAuto ? 'auto' : 'fixed'}
                          onChange={(e) => setSheetWidthAuto(e.target.value === 'auto')}
                        >
                          <option value="auto">Auto (fit labels)</option>
                          <option value="fixed">Fixed (inches)</option>
                        </select>
                        <span className="barcode-print-field-hint">
                          {sheetWidthAuto
                            ? `Page width = ${sheetPrintWidthMm} mm (labels + left margin)`
                            : 'Set fixed width below'}
                        </span>
                      </div>
                      {!sheetWidthAuto ? (
                        <div className="col-6 col-md-3">
                          <label className="form-label">Fixed width</label>
                          <input
                            type="number"
                            className="form-control"
                            min={1}
                            max={24}
                            step={0.01}
                            value={sheetWidthIn}
                            onChange={(e) => setSheetWidthIn(e.target.value)}
                          />
                          <span className="barcode-print-field-hint">
                            inches · label area ≈ {sheetContentWidth} mm
                          </span>
                        </div>
                      ) : null}
                      <div className="col-6 col-md-3">
                        <label className="form-label">Sheet height</label>
                        <select
                          className="form-select"
                          value={sheetHeightMode}
                          onChange={(e) => setSheetHeightMode(e.target.value)}
                        >
                          <option value="per-label">One label per page (label printer)</option>
                          <option value="auto">Auto (continuous roll)</option>
                          <option value="fixed">Fixed (inches)</option>
                        </select>
                        <span className="barcode-print-field-hint">
                          {sheetHeightMode === 'per-label'
                            ? `Each page = ${lw}×${lh} mm (sheet margins ignored — match printer label size)`
                            : sheetHeightMode === 'auto'
                              ? 'One tall page for all labels (desktop/PDF roll)'
                              : 'Set fixed height below'}
                        </span>
                      </div>
                      {sheetHeightMode === 'fixed' ? (
                        <div className="col-6 col-md-3">
                          <label className="form-label">Fixed height</label>
                          <input
                            type="number"
                            className="form-control"
                            min={0.5}
                            max={36}
                            step={0.01}
                            value={sheetHeightIn}
                            onChange={(e) => setSheetHeightIn(e.target.value)}
                          />
                          <span className="barcode-print-field-hint">inches</span>
                        </div>
                      ) : null}
                      <div className="col-6 col-md-3">
                        <label className="form-label">Label width</label>
                        <input
                          type="number"
                          className="form-control"
                          min={20}
                          max={250}
                          value={labelWidthMm}
                          onChange={(e) => setLabelWidthMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Label height</label>
                        <input
                          type="number"
                          className="form-control"
                          min={15}
                          max={250}
                          value={labelHeightMm}
                          onChange={(e) => setLabelHeightMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Rows</label>
                        <select
                          className="form-select"
                          value={totalRows}
                          onChange={(e) => setTotalRows(Number(e.target.value))}
                        >
                          {ROW_COL_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Columns</label>
                        <select
                          className="form-select"
                          value={totalCols}
                          onChange={(e) => setTotalCols(Number(e.target.value))}
                        >
                          {ROW_COL_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Horizontal gap</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={20}
                          step={0.5}
                          value={labelGapHorizontalMm}
                          onChange={(e) => setLabelGapHorizontalMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm between columns</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Vertical gap</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={20}
                          step={0.5}
                          value={labelGapVerticalMm}
                          onChange={(e) => setLabelGapVerticalMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm between rows</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Top margin</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={50}
                          step={0.5}
                          value={sheetMarginTopMm}
                          onChange={(e) => setSheetMarginTopMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm from sheet top</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Left margin</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={50}
                          step={0.5}
                          value={sheetMarginLeftMm}
                          onChange={(e) => setSheetMarginLeftMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm from sheet left</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Bottom padding</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={50}
                          step={0.5}
                          value={sheetMarginBottomMm}
                          onChange={(e) => setSheetMarginBottomMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">
                          mm below last row (prevents cut-off)
                        </span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Margin above text</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={30}
                          step={0.5}
                          value={textMarginTopMm}
                          onChange={(e) => setTextMarginTopMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm inside each label, above name/price</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Margin above barcode</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          max={30}
                          step={0.5}
                          value={barcodeMarginTopMm}
                          onChange={(e) => setBarcodeMarginTopMm(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">mm between text and barcode</span>
                      </div>
                    </div>
                  </section>

                  <section className="barcode-print-section">
                    <h6 className="barcode-print-section-title">Barcode appearance</h6>
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="bp-auto-fit-label"
                            checked={autoFitLabel}
                            onChange={(e) => setAutoFitLabel(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="bp-auto-fit-label">
                            Auto fit to label
                          </label>
                        </div>
                        <span className="barcode-print-field-hint d-block">
                          Scales text and barcode to fill the label size (recommended for sticker printers)
                        </span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Bar width</label>
                        <input
                          type="number"
                          className="form-control"
                          min={10}
                          max={120}
                          value={barCodeWidthField}
                          disabled={autoFitLabel}
                          onChange={(e) => setBarCodeWidthField(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Bar height</label>
                        <input
                          type="number"
                          className="form-control"
                          min={20}
                          max={120}
                          value={barCodeHeightField}
                          disabled={autoFitLabel}
                          onChange={(e) => setBarCodeHeightField(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Font size</label>
                        <select
                          className="form-select"
                          value={fontSize}
                          disabled={autoFitLabel}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                        >
                          {FONT_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n} pt
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Max chars / line</label>
                        <input
                          type="number"
                          className="form-control"
                          min={8}
                          max={120}
                          value={maxChars}
                          onChange={(e) => setMaxChars(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Product name</label>
                        {yesNoSelect(showProductName, setShowProductName)}
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Price</label>
                        {yesNoSelect(showPrice, setShowPrice)}
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Barcode number</label>
                        {yesNoSelect(showBarcodeNumber, setShowBarcodeNumber)}
                      </div>
                    </div>
                  </section>

                  {encodeHint && selectedProduct ? (
                    <div className="alert alert-info py-2 mb-3 barcode-print-hint-card" role="status">
                      {encodeHint}
                    </div>
                  ) : null}

                  {pdfError ? (
                    <div className="alert alert-danger py-2 mb-3" role="alert">
                      {pdfError}
                    </div>
                  ) : null}

                  <div className="barcode-print-actions">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handlePrint}
                      disabled={!selectedProduct || !encodeValue}
                    >
                      <i className="fas fa-print me-2" aria-hidden="true"></i>
                      Print
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={handlePrintPage}
                      disabled={!selectedProduct || !encodeValue}
                      title="Opens a print dialog using only the label sheets (no sidebar)"
                    >
                      <i className="fas fa-file-alt me-2" aria-hidden="true"></i>
                      Print page
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleDownloadPdf}
                      disabled={!selectedProduct || !encodeValue || pdfExporting}
                      title="Download label sheets as a PDF file"
                    >
                      {pdfExporting ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Creating PDF…
                        </>
                      ) : (
                        <>
                          <i className="fas fa-file-pdf me-2" aria-hidden="true"></i>
                          Download PDF
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveSettings}
                      disabled={!companyId || settingsSaving}
                    >
                      {settingsSaving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Saving…
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-2" aria-hidden="true"></i>
                          Save settings
                        </>
                      )}
                    </button>
                    {!companyId ? (
                      <span className="text-xs text-muted">
                        Save requires a company on your profile.
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="col-lg-5">
                  <aside className="barcode-print-preview-panel" aria-label="Live barcode preview">
                    <div className="barcode-print-preview-header">
                      <h6 className="mb-0">Live preview</h6>
                      <p className="text-xs text-muted mb-0">
                        Updates when you change product, size, or layout settings
                      </p>
                      {selectedProduct ? (
                        <div className="barcode-print-preview-meta">
                          <span className="barcode-print-preview-chip">{productName(selectedProduct)}</span>
                          <span className="barcode-print-preview-chip">{formatLabel}</span>
                          <span className="barcode-print-preview-chip">
                            {lw}×{lh} mm
                          </span>
                          <span className="barcode-print-preview-chip">
                            {sheetWidthAuto
                              ? `${sheetPrintWidthMm} mm`
                              : `${swIn} in`}
                            ×
                            {sheetHeightMode === 'per-label'
                              ? `${sheetPrintHeightsMm[0] ?? lh} mm`
                              : sheetHeightMode === 'auto'
                                ? 'auto'
                                : `${shIn} in`}{' '}
                            sheet
                          </span>
                          <span className="barcode-print-preview-chip">
                            {sheetHeightMode === 'per-label'
                              ? '1 label / page'
                              : sheetHeightMode === 'auto'
                                ? `${Math.ceil(totalLabels / cols)}×${cols} grid`
                                : `${rows}×${cols} grid`}
                          </span>
                          <span className="barcode-print-preview-chip">
                            {totalLabels} label{totalLabels !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="barcode-print-preview-viewport">
                      {!selectedProduct ? (
                        <div className="barcode-print-preview-empty">
                          <div className="barcode-print-preview-empty-icon">
                            <i className="fas fa-barcode" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-weight-bold text-dark mb-1">No product selected</p>
                          <p className="text-xs mb-0">Choose a product to preview barcode labels here.</p>
                        </div>
                      ) : !encodeValue ? (
                        <div className="barcode-print-preview-empty">
                          <p className="text-sm font-weight-bold text-dark mb-1">Cannot encode barcode</p>
                          <p className="text-xs mb-0">{encodeHint || 'Check product codes or use custom encode text.'}</p>
                        </div>
                      ) : (
                        <div
                          className="barcode-print-preview-scale-wrap"
                          style={{
                            transform: `scale(${previewScale})`,
                            width: `${swIn}in`,
                          }}
                        >
                          {renderLabelSheets(sheetChunks.slice(0, 3))}
                          {sheetChunks.length > 3 ? (
                            <p className="text-xs text-muted mt-2 mb-0">
                              + {sheetChunks.length - 3} more sheet{sheetChunks.length - 3 !== 1 ? 's' : ''} in print
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            </div>

            <div className="barcode-print-print-area d-none">
              <div id="barcode-print-sheets-root">
                {selectedProduct && encodeValue ? renderLabelSheets(sheetChunks) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrint;
