import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { FaXmark } from 'react-icons/fa6';
import JsBarcode from 'jsbarcode';
import {
  fetchProductActiveRequest,
  fetchProductByIdRequest,
} from '../../features/products/productsAPI.js';
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

function unwrapProductRecord(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body.product && typeof body.product === 'object') return body.product;
  if (body._id || body.id || body.product_name || body.name) return body;
  return null;
}

/** Parse `?product_ids=a,b&qty=2,1` (or `products=a:2,b:1`) into [{ id, qty }]. */
function parseBarcodePrintQuery(searchParams) {
  if (!searchParams) return [];

  const productsParam = String(searchParams.get('products') || '').trim();
  if (productsParam) {
    return productsParam
      .split(',')
      .map((part) => {
        const [idRaw, qtyRaw] = String(part).split(':');
        const id = String(idRaw || '').trim();
        if (!id) return null;
        const qtyNum = parseFloat(String(qtyRaw ?? '1').trim());
        const qty =
          Number.isFinite(qtyNum) && qtyNum > 0 ? Math.min(200, Math.max(1, Math.round(qtyNum))) : 1;
        return { id, qty };
      })
      .filter(Boolean);
  }

  const idsRaw = String(
    searchParams.get('product_ids') || searchParams.get('product_id') || ''
  ).trim();
  if (!idsRaw) return [];

  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const qtyRaw = String(searchParams.get('qty') || searchParams.get('qtys') || '').trim();
  const qtys = qtyRaw
    ? qtyRaw.split(',').map((s) => {
        const n = parseFloat(String(s).trim());
        return Number.isFinite(n) && n > 0 ? Math.min(200, Math.max(1, Math.round(n))) : 1;
      })
    : [];

  return ids.map((id, index) => ({
    id,
    qty: qtys[index] != null ? qtys[index] : 1,
  }));
}

function resolveBarcodeTypeFromQuery(searchParams) {
  const raw = String(
    searchParams?.get('bType') || searchParams?.get('format') || searchParams?.get('barcode_type') || ''
  )
    .trim()
    .toUpperCase();
  if (!raw) return '2'; // default CODE-128 when importing from PO
  if (raw === '2' || raw === 'CODE128' || raw === 'CODE-128') return '2';
  const byValue = B_TYPES.find((t) => t.value === raw || t.format === raw);
  return byValue?.value || '2';
}

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
  .barcode-print-label-text {
    width: 100% !important;
    text-align: center !important;
  }
  .barcode-print-label-barcode,
  .barcode-print-svg {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    /* Do NOT force height:auto — that keeps the PNG at tiny pixel size in print. */
    object-fit: fill !important;
    object-position: center center !important;
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
  .barcode-print-label-barcode,
  .barcode-print-svg {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    object-fit: fill !important;
  }
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
  const [imgUrl, setImgUrl] = useState('');
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

  // Always fill the label box; manual bar W/H only change barcode density/aspect.
  const modW = autoFitLabel ? fitted.moduleWidth : jsBarcodeWidthFromUi(barCodeWidthField);
  const barH = autoFitLabel
    ? fitted.barHeightPx
    : Math.max(40, Math.min(280, Number(barCodeHeightField) || 40));
  const fsPx = autoFitLabel
    ? fitted.fontSize
    : Math.max(8, Math.min(28, Number(fontSize) || 11));
  const fsMm = autoFitLabel
    ? fitted.fontSizeMm
    : Math.max(2, Math.min(6, (Number(fontSize) || 11) * 0.28));
  const textTop = autoFitLabel ? 0.5 : Math.max(0, Math.min(30, Number(textMarginTopMm) || 0));
  const barcodeTop = autoFitLabel ? 0.3 : Math.max(0, Math.min(30, Number(barcodeMarginTopMm) || 0));
  const sidePad = autoFitLabel ? 0.8 : 1.5;
  const textMaxHeightMm = autoFitLabel
    ? fitted.textBlockMm
    : Math.max(4, fsMm * 1.25 * Math.min(maxTextLines, Math.max(1, displayText ? displayText.split('\n').length : 1)));
  // Remaining label height for the barcode image (explicit mm — % heights fail in print).
  const barcodeAreaMm = Math.max(
    10,
    Number(labelHeightMm) - textTop - barcodeTop - (hasText ? textMaxHeightMm : 0) - 1.5
  );
  const barcodeHeightMm = autoFitLabel ? fitted.barcodeMaxHeightMm : barcodeAreaMm;
  const barcodeObjectFit = autoFitLabel ? 'fill' : 'contain';

  useLayoutEffect(() => {
    if (!encodeValue) {
      setImgUrl('');
      setErr('Nothing to encode');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, encodeValue, {
        format,
        displayValue: Boolean(showBarcodeNumber),
        width: modW,
        height: barH,
        fontSize: Math.max(10, Math.min(22, fsPx)),
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setImgUrl(canvas.toDataURL('image/png'));
      setErr(null);
    } catch (e) {
      setImgUrl('');
      setErr(e?.message || 'Could not build this barcode');
    }
  }, [encodeValue, format, modW, barH, fsPx, showBarcodeNumber, index]);

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
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        paddingTop: `${textTop}mm`,
        paddingLeft: `${sidePad}mm`,
        paddingRight: `${sidePad}mm`,
        paddingBottom: '0.8mm',
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
            fontSize: `${fsMm}mm`,
            lineHeight: 1.2,
            fontWeight: 700,
            flex: '0 0 auto',
            overflow: 'hidden',
            maxHeight: `${textMaxHeightMm}mm`,
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-line',
          }}
        >
          {displayText}
        </div>
      ) : null}
      {err ? (
        <div
          className="barcode-print-label-barcode text-danger text-center small"
          style={{ marginTop: `${barcodeTop}mm`, width: '100%' }}
        >
          {err}
        </div>
      ) : imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          className="barcode-print-svg barcode-print-label-barcode"
          style={{
            display: 'block',
            width: '100%',
            height: `${barcodeHeightMm}mm`,
            maxWidth: '100%',
            marginTop: `${barcodeTop}mm`,
            objectFit: barcodeObjectFit,
            objectPosition: 'center center',
            flex: '0 0 auto',
            imageRendering: 'pixelated',
          }}
        />
      ) : null}
    </div>
  );
}

const BarcodePrint = () => {
  useRequireModuleAccess('barcode-print');
  const [searchParams, setSearchParams] = useSearchParams();
  const userSlice = useSelector((state) => state.user);
  const user = userSlice?.user;

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [products, setProducts] = useState([]);
  /** @type {[{ key: string, product: object, qty: number, overrideText: string }]} */
  const [printItems, setPrintItems] = useState([]);
  const [draftId, setDraftId] = useState('');
  const [draftProductCache, setDraftProductCache] = useState(null);
  const [draftQty, setDraftQty] = useState(1);
  const [draftOverride, setDraftOverride] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const productSearchSeqRef = useRef(0);
  const printItemKeyRef = useRef(0);
  const urlImportDoneRef = useRef(false);
  const [urlImportStatus, setUrlImportStatus] = useState('idle'); // idle | loading | done | failed
  const [urlImportError, setUrlImportError] = useState('');
  const [bType, setBType] = useState('2');

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

  const loadProducts = useCallback(async (search = '') => {
    const seq = ++productSearchSeqRef.current;
    setListLoading(true);
    setListError(null);
    try {
      const q = String(search || '').trim();
      const res = await fetchProductActiveRequest({
        ...(q ? { search: q } : {}),
        page: 1,
        limit: q ? 50 : 100,
      });
      if (seq !== productSearchSeqRef.current) return;
      const rows = Array.isArray(res.data) ? res.data : [];
      rows.sort((a, b) =>
        String(productName(a)).localeCompare(String(productName(b)), undefined, {
          sensitivity: 'base',
        })
      );
      setProducts(rows);
    } catch (e) {
      if (seq !== productSearchSeqRef.current) return;
      setListError(e?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      if (seq === productSearchSeqRef.current) setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = productSearchQuery.trim();
    const delay = q ? 350 : 0;
    const t = setTimeout(() => {
      loadProducts(q);
    }, delay);
    return () => clearTimeout(t);
  }, [productSearchQuery, loadProducts]);

  // Auto-load products from URL: ?product_ids=id1,id2&qty=2,1&bType=2
  useEffect(() => {
    if (urlImportDoneRef.current) return;
    const entries = parseBarcodePrintQuery(searchParams);
    if (!entries.length) return;

    let cancelled = false;
    const importBType = resolveBarcodeTypeFromQuery(searchParams);
    setBType(importBType);
    setUrlImportStatus('loading');
    setUrlImportError('');

    (async () => {
      const results = await Promise.all(
        entries.map(async (entry) => {
          try {
            const body = await fetchProductByIdRequest(entry.id);
            const product = unwrapProductRecord(body);
            if (!product) return { ok: false, id: entry.id };
            return { ok: true, entry, product };
          } catch {
            return { ok: false, id: entry.id };
          }
        })
      );

      // Strict Mode remounts cancel the first run — do not mark done until a live run finishes.
      if (cancelled) return;

      const nextItems = [];
      const failures = [];
      for (const result of results) {
        if (!result.ok) {
          failures.push(result.id);
          continue;
        }
        printItemKeyRef.current += 1;
        nextItems.push({
          key: `pi-${printItemKeyRef.current}`,
          product: result.product,
          qty: result.entry.qty,
          overrideText: '',
        });
      }

      urlImportDoneRef.current = true;
      setBType(importBType);

      if (nextItems.length) {
        setPrintItems(nextItems);
        setUrlImportStatus('done');
      } else {
        setUrlImportStatus('failed');
        setUrlImportError('Could not load products from the URL.');
      }

      if (failures.length) {
        setUrlImportError(
          nextItems.length
            ? `Loaded ${nextItems.length} product(s). Could not load: ${failures.join(', ')}`
            : `Could not load products: ${failures.join(', ')}`
        );
      }

      // Drop one-shot import params so refresh does not re-import / wipe edits.
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          [
            'product_ids',
            'product_id',
            'qty',
            'qtys',
            'products',
            'bType',
            'format',
            'barcode_type',
          ].forEach((key) => nextParams.delete(key));
          return nextParams;
        },
        { replace: true }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

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

        if (norm.bType !== undefined && !urlImportDoneRef.current) {
          applyStr(norm.bType, setBType);
        }
        if (norm.labelCount !== undefined) {
          const n = Number(norm.labelCount);
          if (Number.isFinite(n) && n >= 1) setDraftQty(Math.min(200, Math.max(1, Math.round(n))));
        }
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

  const draftProduct = useMemo(() => {
    const fromList = products.find((p) => String(productId(p)) === String(draftId));
    if (fromList) return fromList;
    if (
      draftProductCache &&
      String(productId(draftProductCache)) === String(draftId)
    ) {
      return draftProductCache;
    }
    return null;
  }, [products, draftId, draftProductCache]);

  const productOptions = useMemo(() => {
    const map = new Map();
    const push = (p) => {
      if (!p) return;
      const id = String(productId(p) || '').trim();
      if (!id || map.has(id)) return;
      const sku = String(p.sku || p.product_code || p.barcode || '').trim();
      const parts = [sku, p.barcode ? `Barcode: ${p.barcode}` : ''].filter(Boolean);
      map.set(id, {
        value: id,
        label: productName(p),
        subLabel: parts.length ? parts.join(' · ') : undefined,
      });
    };
    products.forEach(push);
    push(draftProductCache);
    printItems.forEach((item) => push(item.product));
    return Array.from(map.values());
  }, [products, draftProductCache, printItems]);

  const handleDraftProductChange = useCallback(
    (nextId) => {
      setDraftId(nextId);
      const found =
        products.find((p) => String(productId(p)) === String(nextId)) || null;
      setDraftProductCache(found);
    },
    [products]
  );

  const format = useMemo(() => {
    const row = B_TYPES.find((t) => t.value === bType);
    return row?.format || 'CODE128';
  }, [bType]);

  const lineSettings = useMemo(
    () => ({
      showProductName,
      showPrice,
      maxChars,
    }),
    [showProductName, showPrice, maxChars]
  );

  const resolvedPrintItems = useMemo(
    () =>
      printItems.map((item) => {
        const resolved = resolveEncodeValue(
          item.product,
          format,
          String(item.overrideText || '').trim()
        );
        return {
          ...item,
          encodeValue: resolved.value,
          encodeHint: resolved.hint,
          labelLines: buildLabelLines(item.product, lineSettings),
        };
      }),
    [printItems, format, lineSettings]
  );

  const labelSlots = useMemo(() => {
    const slots = [];
    for (const item of resolvedPrintItems) {
      const qty = Math.max(1, Math.min(200, Number(item.qty) || 1));
      for (let i = 0; i < qty; i += 1) {
        if (slots.length >= 200) break;
        slots.push({
          key: `${item.key}-${i}`,
          productId: String(productId(item.product) || item.key),
          productName: productName(item.product),
          encodeValue: item.encodeValue,
          labelLines: item.labelLines,
        });
      }
      if (slots.length >= 200) break;
    }
    return slots;
  }, [resolvedPrintItems]);

  const totalLabels = labelSlots.length;
  const canPrint =
    printItems.length > 0 &&
    totalLabels > 0 &&
    resolvedPrintItems.every((item) => Boolean(item.encodeValue));
  const encodeHint = resolvedPrintItems.find((item) => item.encodeHint && !item.encodeValue)
    ?.encodeHint;

  const handleAddPrintItem = useCallback(() => {
    if (!draftProduct) return;
    const id = String(productId(draftProduct) || '').trim();
    if (!id) return;
    const addQty = Math.max(1, Math.min(200, Number(draftQty) || 1));
    const override = String(draftOverride || '').trim();

    setPrintItems((prev) => {
      const used = prev.reduce((sum, it) => sum + Math.max(1, Number(it.qty) || 1), 0);
      const remaining = Math.max(0, 200 - used);
      if (remaining <= 0) return prev;

      const existingIdx = prev.findIndex(
        (it) =>
          String(productId(it.product)) === id &&
          String(it.overrideText || '').trim() === override
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const current = next[existingIdx];
        const currentQty = Math.max(1, Number(current.qty) || 1);
        const bump = Math.min(addQty, remaining);
        next[existingIdx] = { ...current, qty: Math.min(200, currentQty + bump) };
        return next;
      }

      const qty = Math.min(addQty, remaining);
      printItemKeyRef.current += 1;
      return [
        ...prev,
        {
          key: `pi-${printItemKeyRef.current}`,
          product: draftProduct,
          qty,
          overrideText: override,
        },
      ];
    });

    setDraftId('');
    setDraftProductCache(null);
    setDraftQty(1);
    setDraftOverride('');
  }, [draftProduct, draftQty, draftOverride]);

  const handleUpdatePrintItemQty = useCallback((key, nextQty) => {
    const qty = Math.max(1, Math.min(200, Number(nextQty) || 1));
    setPrintItems((prev) => {
      const without = prev.filter((it) => it.key !== key);
      const usedElsewhere = without.reduce(
        (sum, it) => sum + Math.max(1, Number(it.qty) || 1),
        0
      );
      const capped = Math.min(qty, Math.max(1, 200 - usedElsewhere));
      return prev.map((it) => (it.key === key ? { ...it, qty: capped } : it));
    });
  }, []);

  const handleRemovePrintItem = useCallback((key) => {
    setPrintItems((prev) => prev.filter((it) => it.key !== key));
  }, []);

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
          {slotIndices.map((labelIdx) => {
            const slot = labelSlots[labelIdx];
            if (!slot) return null;
            return (
              <BarcodeLabelCell
                key={`${sheetIdx}-${slot.key}-${format}-${slot.encodeValue}-${showBarcodeNumber}`}
                index={labelIdx}
                encodeValue={slot.encodeValue}
                format={format}
                barCodeWidthField={barCodeWidthField}
                barCodeHeightField={barCodeHeightField}
                fontSize={fontSize}
                lines={slot.labelLines}
                labelWidthMm={lw}
                labelHeightMm={lh}
                showBarcodeNumber={showBarcodeNumber}
                textMarginTopMm={textTopMargin}
                barcodeMarginTopMm={barcodeTopMargin}
                autoFitLabel={autoFitLabel}
              />
            );
          })}
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
        labelCount: totalLabels > 0 ? totalLabels : Math.max(1, Number(draftQty) || 1),
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
    if (!canPrint) return;
    window.print();
  };

  const handlePrintPage = () => {
    if (!canPrint) return;
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
    if (!canPrint || pdfExporting) return;
    setPdfError('');
    setPdfExporting(true);
    try {
      const fileLabel =
        printItems.length === 1
          ? productName(printItems[0].product)
          : printItems.length > 1
            ? `barcodes-${printItems.length}-products`
            : 'barcodes';
      await downloadBarcodeLabelsPdf({
        labels: labelSlots.map((slot) => ({
          encodeValue: slot.encodeValue,
          labelLines: slot.labelLines,
        })),
        format,
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
        productName: fileLabel,
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
                    <h6 className="barcode-print-section-title">Products</h6>
                    {urlImportStatus === 'loading' ? (
                      <div className="alert alert-info py-2 mb-3" role="status">
                        Loading products from purchase order…
                      </div>
                    ) : null}
                    {urlImportError ? (
                      <div
                        className={`alert py-2 mb-3 ${urlImportStatus === 'failed' ? 'alert-warning' : 'alert-info'}`}
                        role="status"
                      >
                        {urlImportError}
                      </div>
                    ) : null}
                    <div className="row g-3 align-items-end">
                      <div className="col-md-6">
                        <label className="form-label">Product</label>
                        <SearchableSelect
                          options={productOptions}
                          value={draftId}
                          placeholder="Search and select product…"
                          disabled={false}
                          loading={listLoading}
                          filterLocally={false}
                          selectedLabel={
                            draftProduct ? productName(draftProduct) : ''
                          }
                          onQueryChange={setProductSearchQuery}
                          onChange={handleDraftProductChange}
                        />
                        {listLoading ? (
                          <span className="barcode-print-field-hint">Searching products…</span>
                        ) : (
                          <span className="barcode-print-field-hint">
                            Type to search by name, SKU, or barcode
                          </span>
                        )}
                      </div>
                      <div className="col-6 col-md-2">
                        <label className="form-label">Qty</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={200}
                          value={draftQty}
                          onChange={(e) => setDraftQty(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-2">
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
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={handleAddPrintItem}
                          disabled={!draftProduct || totalLabels >= 200}
                        >
                          Add
                        </button>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Custom encode text (optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Overrides barcode / SKU / product code for this product when filled"
                          value={draftOverride}
                          onChange={(e) => setDraftOverride(e.target.value)}
                        />
                      </div>
                    </div>

                    {printItems.length > 0 ? (
                      <div className="barcode-print-queue mt-3">
                        <div className="barcode-print-queue-head">
                          <span>Queued products</span>
                          <span>
                            {printItems.length} product{printItems.length !== 1 ? 's' : ''} ·{' '}
                            {totalLabels} label{totalLabels !== 1 ? 's' : ''}
                            {totalLabels >= 200 ? ' (max 200)' : ''}
                          </span>
                        </div>
                        <ul className="barcode-print-queue-list">
                          {resolvedPrintItems.map((item) => (
                            <li key={item.key} className="barcode-print-queue-item">
                              <div className="barcode-print-queue-name">
                                <span className="barcode-print-queue-title">
                                  {productName(item.product)}
                                </span>
                                {item.overrideText ? (
                                  <span className="barcode-print-field-hint">
                                    Custom: {item.overrideText}
                                  </span>
                                ) : null}
                                {!item.encodeValue && item.encodeHint ? (
                                  <span className="text-danger small d-block">{item.encodeHint}</span>
                                ) : null}
                              </div>
                              <div className="barcode-print-queue-controls">
                                <label className="visually-hidden" htmlFor={`bp-qty-${item.key}`}>
                                  Quantity for {productName(item.product)}
                                </label>
                                <input
                                  id={`bp-qty-${item.key}`}
                                  type="number"
                                  className="form-control form-control-sm barcode-print-queue-qty"
                                  min={1}
                                  max={200}
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleUpdatePrintItemQty(item.key, e.target.value)
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleRemovePrintItem(item.key)}
                                  title="Remove product"
                                  aria-label={`Remove ${productName(item.product)}`}
                                >
                                  <FaXmark aria-hidden="true" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="barcode-print-field-hint mt-3 mb-0">
                        Add one or more products with quantities to print multiple barcodes.
                      </p>
                    )}
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
                        <span className="barcode-print-field-hint">
                          mm — must match physical sticker (measure with ruler)
                        </span>
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
                      {lw > 100 || lh > 60 ? (
                        <div className="col-12">
                          <div className="alert alert-warning py-2 px-3 mb-0 text-sm" role="status">
                            Label is set to <strong>{lw}×{lh} mm</strong>, but most sticker rolls are
                            about 40–80 mm wide. If the print looks tiny, measure the sticker and set
                            these to the real size (wrong size makes the printer shrink everything).
                          </div>
                        </div>
                      ) : null}
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
                          Scales text and barcode to fill the label. Turn this on — bar width/height alone do not enlarge the print.
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
                        <span className="barcode-print-field-hint">density only, not print size</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Bar height</label>
                        <input
                          type="number"
                          className="form-control"
                          min={20}
                          max={280}
                          value={barCodeHeightField}
                          disabled={autoFitLabel}
                          onChange={(e) => setBarCodeHeightField(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">aspect only when auto-fit is off</span>
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

                  {encodeHint && printItems.length > 0 ? (
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
                      disabled={!canPrint}
                    >
                      <i className="fas fa-print me-2" aria-hidden="true"></i>
                      Print
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={handlePrintPage}
                      disabled={!canPrint}
                      title="Opens a print dialog using only the label sheets (no sidebar)"
                    >
                      <i className="fas fa-file-alt me-2" aria-hidden="true"></i>
                      Print page
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleDownloadPdf}
                      disabled={!canPrint || pdfExporting}
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
                        Updates when you change products, size, or layout settings
                      </p>
                      {printItems.length > 0 ? (
                        <div className="barcode-print-preview-meta">
                          <span className="barcode-print-preview-chip">
                            {printItems.length} product{printItems.length !== 1 ? 's' : ''}
                          </span>
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
                                ? `${Math.ceil(Math.max(1, totalLabels) / cols)}×${cols} grid`
                                : `${rows}×${cols} grid`}
                          </span>
                          <span className="barcode-print-preview-chip">
                            {totalLabels} label{totalLabels !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="barcode-print-preview-viewport">
                      {printItems.length === 0 ? (
                        <div className="barcode-print-preview-empty">
                          <div className="barcode-print-preview-empty-icon">
                            <i className="fas fa-barcode" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-weight-bold text-dark mb-1">No products added</p>
                          <p className="text-xs mb-0">
                            Add products with quantities to preview barcode labels here.
                          </p>
                        </div>
                      ) : !canPrint ? (
                        <div className="barcode-print-preview-empty">
                          <p className="text-sm font-weight-bold text-dark mb-1">Cannot encode barcode</p>
                          <p className="text-xs mb-0">
                            {encodeHint || 'Check product codes or use custom encode text.'}
                          </p>
                        </div>
                      ) : (
                        <div
                          className="barcode-print-preview-scale-wrap"
                          style={{
                            transform: `scale(${previewScale})`,
                            width: `${swIn}in`,
                          }}
                        >
                          {renderLabelSheets(sheetChunks)}
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            </div>

            <div className="barcode-print-print-area d-none">
              <div id="barcode-print-sheets-root">
                {canPrint ? renderLabelSheets(sheetChunks) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrint;
