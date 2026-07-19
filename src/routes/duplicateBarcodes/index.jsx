import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowsRotate } from 'react-icons/fa6';
import { fetchDuplicateBarcodesRequest } from '../../features/products/productsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../../components/NavIcon.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';

const productRowId = (p) => String(p?._id || p?.id || '');

const DuplicateBarcodes = () => {
  useRequireModuleAccess('products');
  const { canView, canEdit } = usePermissions('products');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [duplicateBarcodeCount, setDuplicateBarcodeCount] = useState(0);
  const [duplicateProductCount, setDuplicateProductCount] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDuplicateBarcodesRequest();
      const rows = Array.isArray(result.data) ? result.data : [];
      setGroups(rows);
      setDuplicateBarcodeCount(result.duplicate_barcode_count || rows.length);
      setDuplicateProductCount(
        result.duplicate_product_count ||
          rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0)
      );
      setExpanded(new Set(rows.map((row) => String(row.barcode || '')).filter(Boolean)));
    } catch (err) {
      setGroups([]);
      setDuplicateBarcodeCount(0);
      setDuplicateProductCount(0);
      setError(err?.message || 'Failed to load duplicate barcodes');
    } finally {
      setLoading(false);
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
                    onClick={loadDuplicates}
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
                  <button type="button" className="btn btn-sm btn-primary mb-0" onClick={loadDuplicates}>
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
                                        <th>Type</th>
                                        <th>Status</th>
                                        {canEdit ? <th className="text-end">Actions</th> : null}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {products.map((product) => {
                                        const id = productRowId(product);
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
                                            <td className="text-sm">
                                              {product.product_type || '—'}
                                            </td>
                                            <td className="text-sm text-capitalize">
                                              {product.status || '—'}
                                            </td>
                                            {canEdit ? (
                                              <td className="text-end">
                                                {id ? (
                                                  <Link
                                                    to={`/products/edit/${id}`}
                                                    className="btn btn-link btn-sm p-0 mb-0"
                                                  >
                                                    Edit
                                                  </Link>
                                                ) : (
                                                  <span className="text-muted">—</span>
                                                )}
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
    </div>
  );
};

export default DuplicateBarcodes;
