import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import JsBarcode from 'jsbarcode';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

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

function businessLocation(product, user) {
  if (!product && !user) return '';
  return (
    product?.location_name ||
    product?.shop_name ||
    product?.store_name ||
    product?.branch_name ||
    product?.branch?.name ||
    user?.branch?.name ||
    user?.branch_name ||
    user?.company ||
    user?.organization ||
    ''
  );
}

function warehouseLine(product) {
  if (!product) return '';
  if (product.warehouse_name) return String(product.warehouse_name);
  const inv = product.warehouse_inventory;
  if (Array.isArray(inv) && inv.length > 0) {
    const row = inv[0];
    return String(row?.warehouse_name || row?.warehouse?.name || row?.name || '');
  }
  if (product.warehouse?.name) return String(product.warehouse.name);
  return String(product.warehouse || '');
}

function priceLine(product) {
  if (!product) return '';
  const raw = product.price ?? product.product_price ?? product.sale_price;
  if (raw === undefined || raw === null || raw === '') return '';
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return String(raw);
  return `$${n.toFixed(2)}`;
}

function productCodeLine(product) {
  if (!product) return '';
  return String(product.product_code || product.sku || '').trim();
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

function buildLabelLines(product, user, settings) {
  const {
    showProductName,
    showLocation,
    showWarehouse,
    showPrice,
    showProductCode,
    maxChars,
  } = settings;
  const lines = [];
  const pushBlock = (text) => {
    wrapToMaxChars(text, maxChars).forEach((ln) => lines.push(ln));
  };
  if (showProductName) pushBlock(productName(product));
  if (showLocation) pushBlock(businessLocation(product, user));
  if (showWarehouse) pushBlock(warehouseLine(product));
  if (showPrice) pushBlock(priceLine(product));
  if (showProductCode) pushBlock(productCodeLine(product));
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
  const navigate = useNavigate();
  const user = useSelector((state) => state.user?.user);
  const { canView } = usePermissions('product');

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
  const [showLocation, setShowLocation] = useState(true);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [showProductCode, setShowProductCode] = useState(true);
  const [maxChars, setMaxChars] = useState(50);

  const searchTimer = useRef(null);

  useEffect(() => {
    if (canView === false) {
      navigate('/dashboard');
    }
  }, [canView, navigate]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const loadProducts = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = { page: 1, limit: 500 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await fetchProductsRequest(params);
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
  }, [debouncedSearch]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(productId(p)) === String(selectedId)) || null,
    [products, selectedId]
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
      showLocation,
      showWarehouse,
      showPrice,
      showProductCode,
      maxChars,
    }),
    [
      showProductName,
      showLocation,
      showWarehouse,
      showPrice,
      showProductCode,
      maxChars,
    ]
  );

  const labelLines = useMemo(
    () =>
      selectedProduct
        ? buildLabelLines(selectedProduct, user, lineSettings)
        : [],
    [selectedProduct, user, lineSettings]
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
    <select className="form-control" value={value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')}>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );

  return (
    <div className="container-fluid py-4 px-0 barcode-print-page">
      <style>{`
        @media print {
          aside#sidenav-main,
          nav#navbarBlur,
          footer.footer,
          .min-height-300.bg-dark.position-absolute,
          .barcode-print-toolbar,
          .barcode-print-hint-card {
            display: none !important;
          }
          .barcode-print-page .card {
            box-shadow: none !important;
            border: none !important;
          }
          .barcode-print-label {
            border: 1px solid #ccc !important;
          }
          body {
            background: #fff !important;
          }
          main.main-content {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .bp-sheet {
            page-break-after: always;
            break-after: page;
          }
          .bp-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
        @page { margin: 10mm; size: auto; }
      `}</style>

      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header pb-0 barcode-print-toolbar">
              <h5 className="mb-0">Print barcodes</h5>
              <p className="text-sm text-muted mb-0">
                Configure print settings, preview the sheet layout, then print from this page or open a print-only
                window.
              </p>
            </div>
            <div className="card-body barcode-print-toolbar">
              {listError ? (
                <div className="alert alert-warning" role="alert">
                  {listError}
                </div>
              ) : null}

              <h6 className="text-sm text-uppercase text-muted font-weight-bold mb-3">Product</h6>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label">Search products</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filter list…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={listLoading}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Product</label>
                  <select
                    className="form-control"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={listLoading}
                  >
                    <option value="">— Select product —</option>
                    {products.map((p) => {
                      const id = productId(p);
                      const sku = p.sku || p.product_code || '';
                      return (
                        <option key={id} value={id}>
                          {productName(p)}
                          {sku ? ` (${sku})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {listLoading ? (
                    <p className="text-xs text-muted mt-1 mb-0">Loading products…</p>
                  ) : null}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Barcode type</label>
                  <select className="form-control" name="b_type" value={bType} onChange={(e) => setBType(e.target.value)}>
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
                  <span className="text-xs text-muted">Placed on sheets using rows × columns below.</span>
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

              <h6 className="text-sm text-uppercase text-muted font-weight-bold mb-3">Print settings</h6>
              <div className="row g-3 mb-2">
                <div className="col-6 col-md-3 col-lg-2">
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
                  <span className="text-xs text-muted">in inches</span>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
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
                  <span className="text-xs text-muted">in inches</span>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Label width</label>
                  <input
                    type="number"
                    className="form-control"
                    min={20}
                    max={250}
                    value={labelWidthMm}
                    onChange={(e) => setLabelWidthMm(e.target.value)}
                  />
                  <span className="text-xs text-muted">in MM</span>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Label height</label>
                  <input
                    type="number"
                    className="form-control"
                    min={15}
                    max={250}
                    value={labelHeightMm}
                    onChange={(e) => setLabelHeightMm(e.target.value)}
                  />
                  <span className="text-xs text-muted">in MM</span>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Total rows</label>
                  <select className="form-control" value={totalRows} onChange={(e) => setTotalRows(Number(e.target.value))}>
                    {ROW_COL_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Total cols</label>
                  <select className="form-control" value={totalCols} onChange={(e) => setTotalCols(Number(e.target.value))}>
                    {ROW_COL_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">BarCode width</label>
                  <input
                    type="number"
                    className="form-control"
                    min={10}
                    max={120}
                    value={barCodeWidthField}
                    onChange={(e) => setBarCodeWidthField(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">BarCode height</label>
                  <input
                    type="number"
                    className="form-control"
                    min={20}
                    max={120}
                    value={barCodeHeightField}
                    onChange={(e) => setBarCodeHeightField(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Font size</label>
                  <select className="form-control" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
                    {FONT_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} pt
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3 col-lg-2">
                  <label className="form-label">Max characters (each line)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={8}
                    max={120}
                    value={maxChars}
                    onChange={(e) => setMaxChars(e.target.value)}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6 col-md-4 col-lg-2">
                  <label className="form-label">Product name</label>
                  {yesNoSelect(showProductName, setShowProductName)}
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <label className="form-label">Business location</label>
                  {yesNoSelect(showLocation, setShowLocation)}
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <label className="form-label">Warehouse</label>
                  {yesNoSelect(showWarehouse, setShowWarehouse)}
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <label className="form-label">Price</label>
                  {yesNoSelect(showPrice, setShowPrice)}
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <label className="form-label">Product code</label>
                  {yesNoSelect(showProductCode, setShowProductCode)}
                </div>
              </div>

              {encodeHint && selectedProduct ? (
                <div className="alert alert-info mb-3 barcode-print-hint-card" role="status">
                  {encodeHint}
                </div>
              ) : null}

              <div className="d-flex flex-wrap gap-2 mt-2">
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
              </div>
            </div>

            <div className="card-body pt-0 border-top">
              <h6 className="text-sm text-muted mb-3">Preview (same layout as Print page)</h6>
              {!selectedProduct ? (
                <p className="text-sm text-muted mb-0">Select a product to preview labels.</p>
              ) : (
                <div id="barcode-print-sheets-root">
                  {sheetChunks.map((slotIndices, sheetIdx) => (
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
                        background: '#fafafa',
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodePrint;
