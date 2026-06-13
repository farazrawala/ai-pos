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
  const lines = [];
  for (let i = 0; i < t.length; i += m) {
    lines.push(t.slice(i, i + m));
  }
  return lines;
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

function BarcodeLabelCell({
  encodeValue,
  format,
  barCodeWidthField,
  barCodeHeightField,
  fontSize,
  lines,
  labelWidthMm,
  labelHeightMm,
  index,
}) {
  const svgRef = useRef(null);
  const [err, setErr] = useState(null);
  const modW = jsBarcodeWidthFromUi(barCodeWidthField);
  const barH = Math.max(20, Math.min(120, Number(barCodeHeightField) || 40));
  const fs = Math.max(8, Math.min(24, Number(fontSize) || 11));

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
        displayValue: true,
        width: modW,
        height: barH,
        fontSize: fs,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setErr(null);
    } catch (e) {
      setErr(e?.message || 'Could not build this barcode');
    }
  }, [encodeValue, format, modW, barH, fs, index]);

  return (
    <div
      className="barcode-print-label d-flex flex-column align-items-center justify-content-start p-1"
      style={{
        width: `${labelWidthMm}mm`,
        height: `${labelHeightMm}mm`,
        boxSizing: 'border-box',
        border: '1px solid #dee2e6',
        pageBreakInside: 'avoid',
        overflow: 'hidden',
      }}
    >
      {lines.length > 0 ? (
        <div
          className="text-center text-dark w-100 px-1"
          style={{ fontSize: `${fs}px`, lineHeight: 1.2, flexShrink: 0 }}
        >
          {lines.map((ln, li) => (
            <div key={li} style={{ wordBreak: 'break-word' }}>
              {ln}
            </div>
          ))}
        </div>
      ) : null}
      {err ? (
        <div className="text-danger text-center small px-1">{err}</div>
      ) : (
        <svg ref={svgRef} className="barcode-print-svg" style={{ maxWidth: '100%', height: 'auto' }} />
      )}
    </div>
  );
}

const PRINT_DOC_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; font-family: system-ui, sans-serif; }
  .bp-sheet { page-break-after: always; break-after: page; }
  .bp-sheet:last-child { page-break-after: auto; break-after: auto; }
  .barcode-print-label { border: 1px solid #ccc !important; }
`;

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
  const [sheetHeightIn, setSheetHeightIn] = useState(2);
  const [labelWidthMm, setLabelWidthMm] = useState(80);
  const [labelHeightMm, setLabelHeightMm] = useState(50);
  const [totalRows, setTotalRows] = useState(1);
  const [totalCols, setTotalCols] = useState(2);
  const [barCodeWidthField, setBarCodeWidthField] = useState(50);
  const [barCodeHeightField, setBarCodeHeightField] = useState(30);
  const [fontSize, setFontSize] = useState(11);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [maxChars, setMaxChars] = useState(50);

  const [settingsLoadError, setSettingsLoadError] = useState('');
  const [settingsSaveError, setSettingsSaveError] = useState('');
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

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
        if (norm.sheetHeightIn !== undefined) applyStr(norm.sheetHeightIn, setSheetHeightIn);
        if (norm.labelWidthMm !== undefined) applyStr(norm.labelWidthMm, setLabelWidthMm);
        if (norm.labelHeightMm !== undefined) applyStr(norm.labelHeightMm, setLabelHeightMm);
        if (norm.totalRows !== undefined) applyNum(norm.totalRows, setTotalRows, 1);
        if (norm.totalCols !== undefined) applyNum(norm.totalCols, setTotalCols, 1);
        if (norm.barCodeWidthField !== undefined) applyStr(norm.barCodeWidthField, setBarCodeWidthField);
        if (norm.barCodeHeightField !== undefined) applyStr(norm.barCodeHeightField, setBarCodeHeightField);
        if (norm.fontSize !== undefined) applyNum(norm.fontSize, setFontSize, 11);
        if (norm.maxChars !== undefined) applyStr(norm.maxChars, setMaxChars);
        applyBool(norm.showProductName, setShowProductName);
        applyBool(norm.showPrice, setShowPrice);
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
    return chunk(indices, slotsPerSheet);
  }, [totalLabels, slotsPerSheet]);

  const swIn = Math.max(1, Math.min(24, Number(sheetWidthIn) || 6.3));
  const shIn = Math.max(0.5, Math.min(36, Number(sheetHeightIn) || 2));
  const lw = Math.max(20, Math.min(250, Number(labelWidthMm) || 80));
  const lh = Math.max(15, Math.min(250, Number(labelHeightMm) || 50));

  const previewScale = useMemo(() => {
    const sheetPxW = swIn * 96;
    const maxW = 400;
    return sheetPxW > maxW ? maxW / sheetPxW : 1;
  }, [swIn]);

  const formatLabel = useMemo(
    () => B_TYPES.find((t) => t.value === bType)?.label || 'CODE-128',
    [bType]
  );

  const renderLabelSheets = (chunks) =>
    chunks.map((slotIndices, sheetIdx) => (
      <div
        key={sheetIdx}
        className="bp-sheet mb-3"
        style={{
          width: `${swIn}in`,
          minHeight: `${shIn}in`,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${lw}mm)`,
          gridTemplateRows: `repeat(${rows}, ${lh}mm)`,
          gap: 0,
          alignContent: 'start',
          justifyContent: 'start',
          border: '1px dashed #adb5bd',
          background: '#fff',
        }}
      >
        {slotIndices.map((labelIdx) => (
          <BarcodeLabelCell
            key={`${sheetIdx}-${labelIdx}-${selectedId}-${format}-${encodeValue}`}
            index={labelIdx}
            encodeValue={encodeValue}
            format={format}
            barCodeWidthField={barCodeWidthField}
            barCodeHeightField={barCodeHeightField}
            fontSize={fontSize}
            lines={labelLines}
            labelWidthMm={lw}
            labelHeightMm={lh}
          />
        ))}
      </div>
    ));

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
        sheetHeightIn: Number(sheetHeightIn) || 2,
        labelWidthMm: Number(labelWidthMm) || 80,
        labelHeightMm: Number(labelHeightMm) || 50,
        totalRows: Number(totalRows) || 1,
        totalCols: Number(totalCols) || 1,
        barCodeWidthField: Number(barCodeWidthField) || 50,
        barCodeHeightField: Number(barCodeHeightField) || 30,
        fontSize: Number(fontSize) || 11,
        showProductName,
        showLocation: false,
        showWarehouse: false,
        showPrice,
        showProductCode: false,
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
      <style>${PRINT_DOC_STYLES}</style></head><body>${root.innerHTML}</body></html>`;
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

  const yesNoSelect = (value, onChange) => (
    <select className="form-select" value={value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')}>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );

  return (
    <div className="container-fluid py-4 px-3 px-lg-4 barcode-print-page">
      <div className="row">
        <div className="col-12">
          <div className="card shadow-sm barcode-print-main-card">
            <div className="card-header pb-3 barcode-print-toolbar">
              <h5 className="mb-1">Print barcodes</h5>
              <p className="text-sm text-muted mb-0">
                Configure labels on the left; the preview updates live on the right. Save settings to your company or
                print when ready.
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
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={24}
                          step={0.01}
                          value={sheetWidthIn}
                          onChange={(e) => setSheetWidthIn(e.target.value)}
                        />
                        <span className="barcode-print-field-hint">inches</span>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Sheet height</label>
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
                    </div>
                  </section>

                  <section className="barcode-print-section">
                    <h6 className="barcode-print-section-title">Barcode appearance</h6>
                    <div className="row g-3">
                      <div className="col-6 col-md-3">
                        <label className="form-label">Bar width</label>
                        <input
                          type="number"
                          className="form-control"
                          min={10}
                          max={120}
                          value={barCodeWidthField}
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
                          onChange={(e) => setBarCodeHeightField(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Font size</label>
                        <select
                          className="form-select"
                          value={fontSize}
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
                    </div>
                  </section>

                  {encodeHint && selectedProduct ? (
                    <div className="alert alert-info py-2 mb-3 barcode-print-hint-card" role="status">
                      {encodeHint}
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
                            {swIn}×{shIn} in sheet
                          </span>
                          <span className="barcode-print-preview-chip">
                            {rows}×{cols} grid
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
