import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllProductsForExportRequest } from '../../features/products/productsAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import {
  loadProductPrintSettings,
  saveProductPrintSettings,
} from './productPrintSettingsCache.js';
import './product-print-module.css';

const ROW_COL_OPTIONS = Array.from({ length: 6 }, (_, i) => i + 1);
const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24];

/** Page formats — portrait width × height (inches). */
const PAGE_FORMAT_OPTIONS = [
  { value: 'a4', label: 'A4', cssName: 'A4', widthIn: 8.27, heightIn: 11.69 },
  { value: 'letter', label: 'Letter', cssName: 'letter', widthIn: 8.5, heightIn: 11 },
  { value: 'legal', label: 'Legal', cssName: 'legal', widthIn: 8.5, heightIn: 14 },
  { value: 'custom', label: 'Custom', cssName: null, widthIn: null, heightIn: null },
];

const ORIENTATION_OPTIONS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

const PAGE_FORMAT_BY_VALUE = Object.fromEntries(PAGE_FORMAT_OPTIONS.map((o) => [o.value, o]));

const dimsForFormat = (formatKey, orientation) => {
  const fmt = PAGE_FORMAT_BY_VALUE[formatKey];
  if (!fmt?.widthIn || !fmt?.heightIn) return null;
  if (orientation === 'landscape') {
    return { widthIn: fmt.heightIn, heightIn: fmt.widthIn };
  }
  return { widthIn: fmt.widthIn, heightIn: fmt.heightIn };
};

const cssPageSizeFor = (formatKey, orientation) => {
  if (formatKey === 'custom') return null;
  const cssName = PAGE_FORMAT_BY_VALUE[formatKey]?.cssName;
  return cssName ? `${cssName} ${orientation}` : null;
};

const productId = (p) => String(p?._id ?? p?.id ?? p?.product_id ?? '');
const productName = (p) => p?.name || p?.product_name || 'Product';

const categoryOptionValue = (c) => String(c?._id ?? c?.id ?? '');
const categoryOptionLabel = (c) => {
  const name = c?.name ?? c?.category_name ?? '';
  return name ? String(name) : categoryOptionValue(c) || 'Category';
};

const parsePrice = (value) => {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const formatPriceLabel = (value, priceSuffix) => {
  const n = parsePrice(value);
  if (n == null) return '—';
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  const suffix = String(priceSuffix || '').trim();
  return suffix ? `${amount}/- ${suffix}` : `${amount}/-`;
};

const getRegularPrice = (product) => product?.price ?? product?.product_price ?? product?.sale_price;

const applyDiscountPercent = (regularPrice, discountPercent) => {
  const regular = parsePrice(regularPrice);
  if (regular == null) return null;
  const pct = Number(String(discountPercent ?? '').replace(/,/g, ''));
  if (!Number.isFinite(pct) || pct <= 0) return regular;
  if (pct >= 100) return 0;
  const discounted = regular * (1 - pct / 100);
  return Math.round(discounted * 100) / 100;
};

const getDiscountedPrice = (product, discountPercent) =>
  applyDiscountPercent(getRegularPrice(product), discountPercent);

const printDocStylesBase = `
  body { margin: 0; padding: 0; }
  .pp-sheet {
    box-sizing: border-box;
    background: #fff;
    page-break-after: always;
    break-after: page;
  }
  .pp-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .pp-label-grid {
    display: grid;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  .pp-price-label {
    box-sizing: border-box;
    border: 1px solid #333;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    padding: 0.35rem 0.25rem 0.3rem;
    font-family: 'Times New Roman', Times, serif;
    overflow: hidden;
  }
  .pp-price-label__name {
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.15;
    width: 100%;
    word-break: break-word;
  }
  .pp-price-label__prices {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.15rem 0;
  }
  .pp-price-label__row-label {
    line-height: 1.15;
  }
  .pp-price-label__row-label--regular,
  .pp-price-label__row-value--regular {
    font-weight: 400;
  }
  .pp-price-label__row-label--discounted,
  .pp-price-label__row-value--discounted {
    font-weight: 700;
  }
  .pp-price-label__row-value {
    line-height: 1.15;
    margin-bottom: 0.2rem;
  }
`;

function buildPrintDocStyles({ cssSize, widthIn, heightIn }) {
  const pageRule = cssSize
    ? `@page { size: ${cssSize}; margin: 0; }`
    : `@page { size: ${widthIn}in ${heightIn}in; margin: 0; }`;
  return `${pageRule}${printDocStylesBase}`;
}

function PriceLabel({
  product,
  priceSuffix,
  discountPercent,
  fontSize,
  showRegular,
  showDiscounted,
}) {
  const name = String(productName(product)).toUpperCase();
  const regular = formatPriceLabel(getRegularPrice(product), priceSuffix);
  const discounted = formatPriceLabel(getDiscountedPrice(product, discountPercent), priceSuffix);
  const fs = Math.max(10, Number(fontSize) || 14);
  const priceLabelFs = Math.round(fs * 1.08);
  const priceValueFs = Math.round(fs * 1.45);

  return (
    <div className="pp-price-label" style={{ fontSize: `${fs}px` }}>
      <div className="pp-price-label__name">{name}</div>
      <div className="pp-price-label__prices">
        {showRegular ? (
          <>
            <div
              className="pp-price-label__row-label pp-price-label__row-label--regular"
              style={{ fontSize: `${priceLabelFs}px`, fontWeight: 400 }}
            >
              Regular Price
            </div>
            <div
              className="pp-price-label__row-value pp-price-label__row-value--regular"
              style={{ fontSize: `${priceValueFs}px`, fontWeight: 400 }}
            >
              {regular}
            </div>
          </>
        ) : null}
        {showDiscounted ? (
          <>
            <div
              className="pp-price-label__row-label pp-price-label__row-label--discounted"
              style={{ fontSize: `${priceLabelFs}px`, fontWeight: 700 }}
            >
              Discounted Price
            </div>
            <div
              className="pp-price-label__row-value pp-price-label__row-value--discounted"
              style={{ fontSize: `${priceValueFs}px`, fontWeight: 700 }}
            >
              {discounted}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

let initialProductPrintSettings;
const getInitialProductPrintSettings = () => {
  if (!initialProductPrintSettings) {
    initialProductPrintSettings = loadProductPrintSettings();
  }
  return initialProductPrintSettings;
};

const ProductPrint = () => {
  useRequireModuleAccess('products');

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoryFilterId, setCategoryFilterId] = useState(
    () => getInitialProductPrintSettings().categoryFilterId
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [priceSuffix, setPriceSuffix] = useState(() => getInitialProductPrintSettings().priceSuffix);
  const [discountPercent, setDiscountPercent] = useState(
    () => getInitialProductPrintSettings().discountPercent
  );
  const [totalCols, setTotalCols] = useState(() => getInitialProductPrintSettings().totalCols);
  const [totalRows, setTotalRows] = useState(() => getInitialProductPrintSettings().totalRows);
  const [pageFormat, setPageFormat] = useState(() => getInitialProductPrintSettings().pageFormat);
  const [orientation, setOrientation] = useState(() => getInitialProductPrintSettings().orientation);
  const [sheetWidthIn, setSheetWidthIn] = useState(
    () => getInitialProductPrintSettings().sheetWidthIn
  );
  const [sheetHeightIn, setSheetHeightIn] = useState(
    () => getInitialProductPrintSettings().sheetHeightIn
  );
  const [labelGapMm, setLabelGapMm] = useState(() => getInitialProductPrintSettings().labelGapMm);
  const [sheetMarginMm, setSheetMarginMm] = useState(
    () => getInitialProductPrintSettings().sheetMarginMm
  );
  const [fontSize, setFontSize] = useState(() => getInitialProductPrintSettings().fontSize);
  const [showRegularPrice, setShowRegularPrice] = useState(
    () => getInitialProductPrintSettings().showRegularPrice
  );
  const [showDiscountedPrice, setShowDiscountedPrice] = useState(
    () => getInitialProductPrintSettings().showDiscountedPrice
  );

  useEffect(() => {
    saveProductPrintSettings({
      priceSuffix,
      discountPercent,
      totalCols,
      totalRows,
      pageFormat,
      orientation,
      sheetWidthIn,
      sheetHeightIn,
      labelGapMm,
      sheetMarginMm,
      fontSize,
      showRegularPrice,
      showDiscountedPrice,
      categoryFilterId,
    });
  }, [
    priceSuffix,
    discountPercent,
    totalCols,
    totalRows,
    pageFormat,
    orientation,
    sheetWidthIn,
    sheetHeightIn,
    labelGapMm,
    sheetMarginMm,
    fontSize,
    showRegularPrice,
    showDiscountedPrice,
    categoryFilterId,
  ]);

  useEffect(() => {
    if (pageFormat === 'custom') return;
    const dims = dimsForFormat(pageFormat, orientation);
    if (dims) {
      setSheetWidthIn(dims.widthIn);
      setSheetHeightIn(dims.heightIn);
    }
  }, [pageFormat, orientation]);

  const loadProducts = useCallback(async (categoryId = categoryFilterId) => {
    setListLoading(true);
    setListError(null);
    try {
      const params = {};
      if (categoryId) params.category_id = categoryId;
      const rows = await fetchAllProductsForExportRequest(params);
      rows.sort((a, b) =>
        String(productName(a)).localeCompare(String(productName(b)), undefined, { sensitivity: 'base' })
      );
      setProducts(rows);
    } catch (e) {
      setListError(e?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setListLoading(false);
    }
  }, [categoryFilterId]);

  useEffect(() => {
    let cancelled = false;
    setCategoriesStatus('loading');
    fetchCategoriesRequest({ page: 1, limit: 1000, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (cancelled) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
        setCategoriesStatus('succeeded');
      })
      .catch((err) => {
        console.error('[Product print] Failed to load categories', err);
        if (!cancelled) {
          setCategories([]);
          setCategoriesStatus('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadProducts(categoryFilterId);
  }, [categoryFilterId, loadProducts]);

  const handleCategoryChange = (value) => {
    setCategoryFilterId(value);
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const haystack = [
        productName(p),
        p?.sku,
        p?.barcode,
        p?.product_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(productId(p))),
    [products, selectedIds]
  );

  const labelsPerSheet = Math.max(1, totalCols * totalRows);

  const printSheets = useMemo(() => {
    const pages = chunkArray(selectedProducts, labelsPerSheet);
    return pages.map((pageProducts, sheetIdx) => {
      const slots = Array.from({ length: labelsPerSheet }, (_, i) => pageProducts[i] ?? null);
      return { sheetIdx, slots };
    });
  }, [selectedProducts, labelsPerSheet]);

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(productId(p)));

  const toggleProduct = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach((p) => next.delete(productId(p)));
      } else {
        filteredProducts.forEach((p) => next.add(productId(p)));
      }
      return next;
    });
  };

  const selectAllProducts = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      products.forEach((p) => {
        const id = productId(p);
        if (id) next.add(id);
      });
      return next;
    });
  };

  const selectAllInCategory = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredProducts.forEach((p) => {
        const id = productId(p);
        if (id) next.add(id);
      });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const isCustomPageSize = pageFormat === 'custom';
  const printCssPageSize = cssPageSizeFor(pageFormat, orientation);

  const handlePageFormatChange = (value) => {
    setPageFormat(value);
    if (value !== 'custom') {
      const dims = dimsForFormat(value, orientation);
      if (dims) {
        setSheetWidthIn(dims.widthIn);
        setSheetHeightIn(dims.heightIn);
      }
    }
  };

  const handleOrientationChange = (value) => {
    setOrientation(value);
    if (pageFormat === 'custom') {
      const nextW = sheetHeightIn;
      const nextH = sheetWidthIn;
      setSheetWidthIn(nextW);
      setSheetHeightIn(nextH);
    }
  };

  const handleSheetWidthChange = (value) => {
    setSheetWidthIn(Number(value) || 11.69);
  };

  const handleSheetHeightChange = (value) => {
    setSheetHeightIn(Number(value) || 8.27);
  };

  const sheetStyle = {
    width: `${sheetWidthIn}in`,
    height: `${sheetHeightIn}in`,
    padding: `${sheetMarginMm}mm`,
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
    gridTemplateRows: `repeat(${totalRows}, 1fr)`,
    gap: `${labelGapMm}mm`,
    width: '100%',
    height: '100%',
  };

  const renderSheet = (sheet, keyPrefix = '') => (
    <div key={`${keyPrefix}sheet-${sheet.sheetIdx}`} className="pp-sheet" style={sheetStyle}>
      <div className="pp-label-grid" style={gridStyle}>
        {sheet.slots.map((product, slotIdx) => (
          <div key={`${keyPrefix}${sheet.sheetIdx}-${slotIdx}`}>
            {product ? (
              <PriceLabel
                product={product}
                priceSuffix={priceSuffix}
                discountPercent={discountPercent}
                fontSize={fontSize}
                showRegular={showRegularPrice}
                showDiscounted={showDiscountedPrice}
              />
            ) : (
              <div className="pp-price-label" style={{ visibility: 'hidden', fontSize: `${fontSize}px` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const handlePrint = () => {
    if (!selectedProducts.length) return;
    const root = document.getElementById('product-print-sheets-root');
    if (!root) return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Product price labels');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Product labels</title>
      <style>${buildPrintDocStyles({
        cssSize: printCssPageSize,
        widthIn: sheetWidthIn,
        heightIn: sheetHeightIn,
      })}</style></head><body>${root.innerHTML}</body></html>`;
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
    if (win?.document?.readyState === 'complete') runPrint();
    else if (win) {
      win.onload = runPrint;
      setTimeout(runPrint, 500);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-lg-4 product-print-page">
      <div className="row">
        <div className="col-12">
          <div className="card shadow-sm product-print-main-card">
            <div className="card-header pb-3 product-print-toolbar">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h5 className="mb-0">Product print</h5>
                  <p className="text-sm text-muted mb-0">
                    Select products and print price labels (regular &amp; discounted).
                  </p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary mb-0"
                    onClick={() => loadProducts(categoryFilterId)}
                    disabled={listLoading}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mb-0"
                    onClick={handlePrint}
                    disabled={!selectedProducts.length}
                  >
                    Print {selectedProducts.length ? `(${selectedProducts.length})` : ''}
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body product-print-toolbar">
              <div className="row g-4">
                <div className="col-lg-5 product-print-picker-col">
                  <section className="product-print-section">
                    <h6 className="product-print-section-title">Select products</h6>
                    <div className="mb-2">
                      <label className="form-label mb-1" htmlFor="pp-category-filter">
                        Category
                      </label>
                      <select
                        id="pp-category-filter"
                        className="form-select form-select-sm"
                        value={categoryFilterId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        disabled={listLoading || categoriesStatus === 'loading'}
                      >
                        <option value="">All categories</option>
                        {categories.map((cat) => (
                          <option key={categoryOptionValue(cat)} value={categoryOptionValue(cat)}>
                            {categoryOptionLabel(cat)}
                          </option>
                        ))}
                      </select>
                      {categoriesStatus === 'failed' ? (
                        <div className="form-text text-danger">Could not load categories.</div>
                      ) : null}
                    </div>
                    <div className="input-group input-group-sm mb-2">
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search by name, SKU, barcode…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary mb-0"
                        onClick={toggleAllFiltered}
                        disabled={!filteredProducts.length}
                      >
                        {allFilteredSelected ? 'Deselect filtered' : 'Select filtered'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary mb-0"
                        onClick={selectAllInCategory}
                        disabled={!filteredProducts.length}
                      >
                        {categoryFilterId ? 'Select category' : 'Select shown'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary mb-0"
                        onClick={selectAllProducts}
                        disabled={!products.length}
                      >
                        Select all loaded
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mb-0"
                        onClick={clearSelection}
                        disabled={!selectedIds.size}
                      >
                        Clear
                      </button>
                      <span className="text-sm text-muted align-self-center">
                        {selectedIds.size} selected · {products.length} loaded
                        {categoryFilterId ? ' in category' : ''}
                      </span>
                    </div>

                    {listLoading ? (
                      <p className="text-sm text-muted mb-0">Loading products…</p>
                    ) : listError ? (
                      <p className="text-sm text-danger mb-0">{listError}</p>
                    ) : (
                      <div className="product-print-picker">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th style={{ width: 36 }}>
                                <input
                                  type="checkbox"
                                  className="form-check-input m-0"
                                  checked={allFilteredSelected}
                                  onChange={toggleAllFiltered}
                                  aria-label="Select all filtered products"
                                />
                              </th>
                              <th>Name</th>
                              <th className="text-end">Regular</th>
                              <th className="text-end">Discounted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProducts.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center text-muted py-3">
                                  No products found
                                </td>
                              </tr>
                            ) : (
                              filteredProducts.map((p) => {
                                const id = productId(p);
                                const checked = selectedIds.has(id);
                                return (
                                  <tr key={id} className={checked ? 'table-primary' : undefined}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        className="form-check-input m-0"
                                        checked={checked}
                                        onChange={() => toggleProduct(id)}
                                        aria-label={`Select ${productName(p)}`}
                                      />
                                    </td>
                                    <td className="text-sm">{productName(p)}</td>
                                    <td className="text-sm text-end text-nowrap">
                                      {formatPriceLabel(getRegularPrice(p), priceSuffix)}
                                    </td>
                                    <td className="text-sm text-end text-nowrap">
                                      {formatPriceLabel(getDiscountedPrice(p, discountPercent), priceSuffix)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>

                <div className="col-lg-7 product-print-settings-col">
                  <section className="product-print-section">
                    <h6 className="product-print-section-title">Label settings</h6>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="pp-price-suffix">
                          Price suffix
                        </label>
                        <input
                          id="pp-price-suffix"
                          type="text"
                          className="form-control form-control-sm"
                          value={priceSuffix}
                          onChange={(e) => setPriceSuffix(e.target.value)}
                          placeholder="e.g. RS KG"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label" htmlFor="pp-discount-pct">
                          Discount %
                        </label>
                        <input
                          id="pp-discount-pct"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="form-control form-control-sm"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          placeholder="e.g. 10"
                        />
                        <div className="form-text">Applied to regular price</div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="pp-page-format">
                          Page size
                        </label>
                        <select
                          id="pp-page-format"
                          className="form-select form-select-sm"
                          value={pageFormat}
                          onChange={(e) => handlePageFormatChange(e.target.value)}
                        >
                          {PAGE_FORMAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label" htmlFor="pp-orientation">
                          Orientation
                        </label>
                        <select
                          id="pp-orientation"
                          className="form-select form-select-sm"
                          value={orientation}
                          onChange={(e) => handleOrientationChange(e.target.value)}
                        >
                          {ORIENTATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {!isCustomPageSize ? (
                          <div className="form-text">
                            {sheetWidthIn}&quot; × {sheetHeightIn}&quot;
                          </div>
                        ) : null}
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label" htmlFor="pp-cols">
                          Columns
                        </label>
                        <select
                          id="pp-cols"
                          className="form-select form-select-sm"
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
                        <label className="form-label" htmlFor="pp-rows">
                          Rows
                        </label>
                        <select
                          id="pp-rows"
                          className="form-select form-select-sm"
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
                        <label className="form-label" htmlFor="pp-font">
                          Font size
                        </label>
                        <select
                          id="pp-font"
                          className="form-select form-select-sm"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                        >
                          {FONT_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}px
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label" htmlFor="pp-gap">
                          Label gap (mm)
                        </label>
                        <input
                          id="pp-gap"
                          type="number"
                          min="0"
                          step="0.5"
                          className="form-control form-control-sm"
                          value={labelGapMm}
                          onChange={(e) => setLabelGapMm(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label" htmlFor="pp-sheet-w">
                          Sheet width (in)
                        </label>
                        <input
                          id="pp-sheet-w"
                          type="number"
                          min="4"
                          step="0.01"
                          className="form-control form-control-sm"
                          value={sheetWidthIn}
                          onChange={(e) => handleSheetWidthChange(e.target.value)}
                          disabled={!isCustomPageSize}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label" htmlFor="pp-sheet-h">
                          Sheet height (in)
                        </label>
                        <input
                          id="pp-sheet-h"
                          type="number"
                          min="4"
                          step="0.01"
                          className="form-control form-control-sm"
                          value={sheetHeightIn}
                          onChange={(e) => handleSheetHeightChange(e.target.value)}
                          disabled={!isCustomPageSize}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label" htmlFor="pp-margin">
                          Sheet margin (mm)
                        </label>
                        <input
                          id="pp-margin"
                          type="number"
                          min="0"
                          step="0.5"
                          className="form-control form-control-sm"
                          value={sheetMarginMm}
                          onChange={(e) => setSheetMarginMm(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check form-check-inline">
                          <input
                            id="pp-show-regular"
                            type="checkbox"
                            className="form-check-input"
                            checked={showRegularPrice}
                            onChange={(e) => setShowRegularPrice(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="pp-show-regular">
                            Show regular price
                          </label>
                        </div>
                        <div className="form-check form-check-inline">
                          <input
                            id="pp-show-discounted"
                            type="checkbox"
                            className="form-check-input"
                            checked={showDiscountedPrice}
                            onChange={(e) => setShowDiscountedPrice(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="pp-show-discounted">
                            Show discounted price
                          </label>
                        </div>
                        <div className="form-text">
                          Regular price uses <code>price</code>. Discounted price = regular minus{' '}
                          {discountPercent || '0'}% discount.
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="product-print-preview-panel" aria-label="Label preview">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Preview</h6>
                      <span className="text-xs text-muted">
                        {labelsPerSheet} labels/page · {printSheets.length} page
                        {printSheets.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="product-print-preview-viewport">
                      {!selectedProducts.length ? (
                        <p className="text-sm text-muted text-center py-4 mb-0">
                          Select one or more products to preview labels.
                        </p>
                      ) : (
                        printSheets.slice(0, 1).map((sheet) => renderSheet(sheet, 'preview-'))
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            </div>

            <div className="product-print-print-area">
              <div id="product-print-sheets-root">
                {printSheets.map((sheet) => renderSheet(sheet, 'print-'))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPrint;
