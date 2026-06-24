import { Link } from 'react-router-dom';
import { FaTriangleExclamation } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import { withBase } from '../../config/appBase.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { useLowStockProducts } from '../../hooks/useLowStockProducts.js';

function formatQty(value) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toLocaleString();
}

function statusBadge(status) {
  if (status === 'out') {
    return <span className="badge badge-sm bg-gradient-danger">Out of stock</span>;
  }
  return <span className="badge badge-sm bg-gradient-warning">Low stock</span>;
}

export default function LowStockAlertsTable() {
  const { loading, items, total, error } = useLowStockProducts();

  return (
    <div className="card h-100">
      <div className="card-header pb-0 pt-3 bg-transparent d-flex align-items-start justify-content-between gap-3">
        <div>
          <h6 className="text-capitalize mb-0">Low stock alerts</h6>
          <p className="text-sm mb-0 text-secondary">
            Products at or below their alert quantity
          </p>
        </div>
        {!loading && !error && total > 0 ? (
          <span className="badge bg-gradient-danger">
            {total} alert{total === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <div className="card-body px-0 pb-2 pt-3">
        <div className="table-responsive">
          <table className="table align-items-center mb-0">
            <thead>
              <tr>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 ps-4">
                  Product
                </th>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Code
                </th>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 text-center">
                  On hand
                </th>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 text-center">
                  Alert
                </th>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 text-center">
                  Shortage
                </th>
                <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 text-center pe-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-secondary text-sm">
                    Loading alerts…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-danger text-sm">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-secondary text-sm">
                    No low stock alerts. All tracked products are above their alert levels.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const imageUrl = row.image ? resolveCategoryMediaUrl(row.image) : '';

                  return (
                    <tr key={row.alertId || row.id || row.name}>
                      <td className="ps-4">
                        <div className="d-flex align-items-center gap-2">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={row.name}
                              className="list-product-thumb"
                              onError={(e) => {
                                e.currentTarget.src = withBase('/assets/img/default.jpg');
                              }}
                            />
                          ) : (
                            <div className="list-product-thumb list-product-thumb--empty flex-shrink-0">
                              <NavIcon
                                icon={FaTriangleExclamation}
                                className={row.status === 'out' ? 'text-danger' : 'text-warning'}
                                size={14}
                              />
                            </div>
                          )}
                          {row.id ? (
                            <Link
                              to={`/products/edit/${row.id}`}
                              className="text-sm font-weight-bold mb-0 text-dark"
                            >
                              {row.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-weight-bold mb-0">{row.name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-secondary font-monospace">
                          {row.code || row.sku || '—'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`text-sm font-weight-bold ${
                            row.status === 'out' ? 'text-danger' : 'text-warning'
                          }`}
                        >
                          {formatQty(row.stock)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="text-sm text-secondary">{formatQty(row.alertQty)}</span>
                      </td>
                      <td className="text-center">
                        <span className="text-sm font-weight-bold text-danger">
                          {formatQty(row.shortage)}
                        </span>
                      </td>
                      <td className="text-center pe-4">{statusBadge(row.status)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error ? (
          <div className="px-4 pt-2">
            <Link to="/products" className="text-sm text-primary font-weight-bold">
              View all products
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
