import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowsRotate, FaBarcode, FaPrint } from 'react-icons/fa6';
import {
  fetchDuplicateBarcodesRequest,
  generateUniqueProductBarcodeRequest,
} from '../../features/products/productsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../../components/NavIcon.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import ProductWarehouseStockModal from '../../components/product/ProductWarehouseStockModal.jsx';
import { toast } from '../../utils/toast.js';

const productRowId = (p) => String(p?._id || p?.id || '');

/** Same stock formatting as /products list. */
const formatProductStock = (stock) => {
  if (stock == null || !Number.isFinite(stock)) return '—';
  return Number(stock).toLocaleString();
};

const warehouseNameFromInventoryRow = (row) => {
  if (!row || typeof row !== 'object') return 'Warehouse';
  const w = row.warehouse_id ?? row.warehouseId;
  if (w && typeof w === 'object' && !Array.isArray(w)) {
    const n = w.name ?? w.warehouse_name ?? w.title ?? w.code;
    if (n != null && String(n).trim() !== '') return String(n).trim();
  }
  if (w != null && typeof w !== 'object') return String(w);
  const fallback = row.warehouse_name ?? row.warehouseName;
  return fallback != null && String(fallback).trim() !== '' ? String(fallback).trim() : 'Warehouse';
};

/** Per-warehouse qty from API `warehouse_inventory` (populated `warehouse_id`). */
const getWarehouseStockLines = (item) => {
  if (!item || typeof item !== 'object') return [];
  const inv = item.warehouse_inventory ?? item.warehouseInventory;
  if (!Array.isArray(inv) || inv.length === 0) return [];
  return inv.map((row, index) => ({
    key: String(row?._id ?? row?.id ?? `${warehouseNameFromInventoryRow(row)}-${index}`),
    name: warehouseNameFromInventoryRow(row),
    qty: Number(row?.quantity) || 0,
  }));
};

/** Total qty plus per-warehouse lines — same logic as /products. */
const getProductStockDisplay = (item) => {
  const lines = getWarehouseStockLines(item);
  if (lines.length > 0) {
    const warehouseTotal = lines.reduce((sum, line) => sum + line.qty, 0);
    return { total: warehouseTotal, lines };
  }

  const raw =
    item?.qty ??
    item?.stock ??
    item?.total_warehouse_qty ??
    item?.quantity ??
    item?.total_stock;
  if (raw == null || raw === '') return { total: null, lines: [] };
  const n = Number(raw);
  return { total: Number.isFinite(n) ? n : null, lines: [] };
};

/** Label print qty for barcode-print (1–200). */
const printQtyFromStock = (product) => {
  const { total } = getProductStockDisplay(product);
  if (total == null || !Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.min(200, Math.round(total)));
};

const DuplicateBarcodes = () => {
  useRequireModuleAccess('products');
  const navigate = useNavigate();
  const { canView, canEdit } = usePermissions('products');
  const { canView: canViewBarcodePrint } = usePermissions('barcode-print');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [duplicateBarcodeCount, setDuplicateBarcodeCount] = useState(0);
  const [duplicateProductCount, setDuplicateProductCount] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [generatingIds, setGeneratingIds] = useState(() => new Set());
  const [warehouseStockTarget, setWarehouseStockTarget] = useState(null);

  const showActions = canEdit || canViewBarcodePrint;

  const loadDuplicates = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fetchDuplicateBarcodesRequest();
      const rows = Array.isArray(result.data) ? result.data : [];
      setGroups(rows);
      setDuplicateBarcodeCount(result.duplicate_barcode_count || rows.length);
      setDuplicateProductCount(
        result.duplicate_product_count ||
          rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
      );
      setExpanded((prev) => {
        if (prev.size > 0) {
          const next = new Set();
          for (const row of rows) {
            const key = String(row.barcode || '');
            if (key && prev.has(key)) next.add(key);
          }
          return next.size > 0
            ? next
            : new Set(rows.map((r) => String(r.barcode || '')).filter(Boolean));
        }
        return new Set(rows.map((row) => String(row.barcode || '')).filter(Boolean));
      });
    } catch (err) {
      setGroups([]);
      setDuplicateBarcodeCount(0);
      setDuplicateProductCount(0);
      setError(err?.message || 'Failed to load duplicate barcodes');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    loadDuplicates();
  }, [canView, loadDuplicates]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => {
      const barcode = String(group.barcode || '').toLowerCase();
      if (barcode.includes(q)) return true;
      const products = Array.isArray(group.products) ? group.products : [];
      return products.some((p) => {
        const hay = [
          p.product_name,
          p.product_code,
          p.sku,
          p.barcode,
          p.status,
          p.product_type,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
    });
  }, [groups, search]);

  const toggleGroup = (barcode) => {
    const key = String(barcode || '');
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openWarehouseStock = (product) => {
    const id = productRowId(product);
    if (!id) return;
    setWarehouseStockTarget({
      productId: id,
      productName: product.product_name || product.name || 'Product',
    });
  };

  const handleGenerateBarcode = async (product) => {
    const id = productRowId(product);
    if (!id || generatingIds.has(id)) return;

    setGeneratingIds((prev) => new Set(prev).add(id));
    try {
      const result = await generateUniqueProductBarcodeRequest(id);
      const code = String(result?.data?.barcode ?? '').trim();
      if (!code) {
        throw new Error(result?.message || 'Failed to generate unique barcode');
      }
      toast.success(result?.message || `Barcode assigned: ${code}`);
      await loadDuplicates({ quiet: true });
    } catch (err) {
      toast.error(err?.message || 'Failed to generate barcode');
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /** Open barcode-print with this product and its stock as label qty. */
  const handlePrintBarcode = (product) => {
    const id = productRowId(product);
    if (!id) return;
    const qty = printQtyFromStock(product);
    const params = new URLSearchParams();
    params.set('product_ids', id);
    params.set('qty', String(qty));
    params.set('bType', '2'); // CODE-128
    navigate(`/barcode-print?${params.toString()}`);
  };

  if (!canView) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning mb-0">You do not have permission to view products.</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <div className="card mb-4">
            <div className="card-header pb-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <h6 className="mb-1">Duplicate barcodes</h6>
                  <p className="text-sm text-secondary mb-0">
                    Products in your company that share the same barcode
                  </p>
                </div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                    <span className="input-group-text text-body">
                      <SearchInputIcon />
                    </span>
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Search barcode or product…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      disabled={loading}
                      aria-label="Search duplicate barcodes"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mb-0"
                    onClick={() => loadDuplicates()}
                    disabled={loading}
                    title="Refresh"
                  >
                    <NavIcon icon={FaArrowsRotate} className="me-1" size={14} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-3 mt-3">
                <div className="text-sm">
                  <span className="text-secondary">Duplicate barcodes:</span>{' '}
                  <strong>{duplicateBarcodeCount}</strong>
                </div>
                <div className="text-sm">
                  <span className="text-secondary">Affected products:</span>{' '}
                  <strong>{duplicateProductCount}</strong>
                </div>
              </div>
            </div>

            <div className="card-body pt-0 px-0 pb-0">
              {loading ? (
                <div className="p-4 text-center text-secondary">Loading duplicate barcodes…</div>
              ) : null}

              {!loading && error ? (
                <div className="p-4">
                  <div className="alert alert-danger mb-3">{error}</div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mb-0"
                    onClick={() => loadDuplicates()}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {!loading && !error && filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-secondary">
                  {groups.length === 0
                    ? 'No duplicate barcodes found.'
                    : 'No duplicates match your search.'}
                </div>
              ) : null}

              {!loading && !error && filteredGroups.length > 0 ? (
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        <th>Barcode</th>
                        <th className="text-center">Products</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map((group, index) => {
                        const barcode = String(group.barcode || '');
                        const count = Number(group.count) || 0;
                        const products = Array.isArray(group.products) ? group.products : [];
                        const isOpen = expanded.has(barcode);

                        return (
                          <tr key={barcode || index}>
                            <td className="text-center text-sm">{index + 1}</td>
                            <td>
                              <code className="text-sm">{barcode || '—'}</code>
                            </td>
                            <td className="text-center">
                              <span className="badge badge-sm bg-gradient-warning">{count}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 mb-0"
                                onClick={() => toggleGroup(barcode)}
                              >
                                {isOpen ? 'Hide products' : 'Show products'}
                              </button>
                              {isOpen ? (
                                <div className="table-responsive mt-2">
                                  <table className="table table-sm mb-0">
                                    <thead>
                                      <tr>
                                        <th>Name</th>
                                        <th>Code</th>
                                        <th>SKU</th>
                                        <th className="text-end list-col-stock">Stock</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        {showActions ? (
                                          <th className="text-end">Actions</th>
                                        ) : null}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {products.map((product) => {
                                        const id = productRowId(product);
                                        const { total: stockTotal, lines: warehouseLines } =
                                          getProductStockDisplay(product);
                                        const generating = id && generatingIds.has(id);
                                        const labelQty = printQtyFromStock(product);
                                        return (
                                          <tr key={id || `${barcode}-${product.sku}`}>
                                            <td className="text-sm">
                                              {product.product_name || '—'}
                                            </td>
                                            <td className="text-sm">
                                              {product.product_code || '—'}
                                            </td>
                                            <td className="text-sm font-monospace">
                                              {product.sku || '—'}
                                            </td>
                                            <td className="text-sm text-end list-col-stock">
                                              <button
                                                type="button"
                                                className="btn btn-link btn-sm p-0 mb-0 text-dark font-weight-bold text-decoration-none list-stock-total"
                                                title="View stock by warehouse"
                                                onClick={() => openWarehouseStock(product)}
                                                disabled={!id}
                                              >
                                                {formatProductStock(stockTotal)}
                                              </button>
                                              {warehouseLines.length > 0 ? (
                                                <div className="list-stock-warehouses">
                                                  {warehouseLines.slice(0, 2).map((line) => (
                                                    <button
                                                      key={line.key}
                                                      type="button"
                                                      className="btn btn-link btn-sm p-0 mb-0 text-muted text-xxs text-decoration-none list-cell-truncate-sm d-block w-100 text-end"
                                                      title={`${line.name}: ${formatProductStock(line.qty)}`}
                                                      onClick={() => openWarehouseStock(product)}
                                                    >
                                                      {line.name}: {formatProductStock(line.qty)}
                                                    </button>
                                                  ))}
                                                  {warehouseLines.length > 2 ? (
                                                    <button
                                                      type="button"
                                                      className="btn btn-link btn-sm p-0 mb-0 text-primary text-xxs text-decoration-none"
                                                      onClick={() => openWarehouseStock(product)}
                                                    >
                                                      +{warehouseLines.length - 2} more
                                                    </button>
                                                  ) : null}
                                                </div>
                                              ) : null}
                                            </td>
                                            <td className="text-sm">
                                              {product.product_type || '—'}
                                            </td>
                                            <td className="text-sm text-capitalize">
                                              {product.status || '—'}
                                            </td>
                                            {showActions ? (
                                              <td className="text-end">
                                                <div className="d-inline-flex flex-wrap align-items-center justify-content-end gap-2">
                                                  {canViewBarcodePrint && id ? (
                                                    <button
                                                      type="button"
                                                      className="btn btn-sm btn-outline-success mb-0 d-inline-flex align-items-center"
                                                      onClick={() => handlePrintBarcode(product)}
                                                      title={`Open barcode print for this product (${labelQty} label${labelQty === 1 ? '' : 's'})`}
                                                    >
                                                      <FaPrint className="me-1" size={14} />
                                                      Print barcode
                                                    </button>
                                                  ) : null}
                                                  {canEdit && id ? (
                                                    <button
                                                      type="button"
                                                      className="btn btn-sm btn-outline-primary mb-0 d-inline-flex align-items-center"
                                                      onClick={() => handleGenerateBarcode(product)}
                                                      disabled={generating}
                                                      title="Assign a new unique barcode to this product"
                                                    >
                                                      {generating ? (
                                                        <span
                                                          className="spinner-border spinner-border-sm me-1"
                                                          role="status"
                                                          aria-hidden="true"
                                                        />
                                                      ) : (
                                                        <FaBarcode className="me-1" size={14} />
                                                      )}
                                                      New barcode
                                                    </button>
                                                  ) : null}
                                                  {canEdit && id ? (
                                                    <Link
                                                      to={`/products/edit/${id}`}
                                                      className="btn btn-link btn-sm p-0 mb-0"
                                                    >
                                                      Edit
                                                    </Link>
                                                  ) : null}
                                                </div>
                                              </td>
                                            ) : null}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ProductWarehouseStockModal
        open={Boolean(warehouseStockTarget)}
        onClose={() => setWarehouseStockTarget(null)}
        productId={warehouseStockTarget?.productId}
        productName={warehouseStockTarget?.productName}
      />
    </div>
  );
};

export default DuplicateBarcodes;
