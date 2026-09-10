import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import ListDataTable from '../list/ListDataTable.jsx';
import ListSortableTh from '../list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import { orderStatusBadgeClass } from './orderStatusBadge.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import { pickCompanyLogoUrl } from '../../features/company/companyAPI.js';
import {
  buildOrderItemByOriginCompanyQuery,
  fetchOrderItemsByOriginCompanyRequest,
  ORDER_ITEM_BY_ORIGIN_COMPANY_PATH,
} from '../../features/orders/ordersAPI.js';
import { buildApiUrl } from '../../config/apiConfig.js';

const COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'order_no', label: 'Order no', alwaysVisible: true },
  { key: 'product', label: 'Product' },
  { key: 'destination_company', label: 'Destination' },
  { key: 'qty', label: 'Qty' },
  { key: 'status', label: 'Status' },
  { key: 'dates', label: 'Created / Updated' },
];

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function pickRefId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  const rec = asRecord(value);
  if (!rec) return '';
  return String(rec._id ?? rec.id ?? '').trim();
}

function companyDisplayName(value) {
  const rec = asRecord(value);
  if (!rec) return '';
  return String(rec.company_name ?? rec.companyName ?? rec.name ?? '').trim();
}

function productDisplayName(row) {
  const product = asRecord(row?.product_id);
  const fromProduct = product
    ? String(product.product_name ?? product.productName ?? product.name ?? '').trim()
    : '';
  return fromProduct || String(row?.name ?? '').trim();
}

function orderNoFromRow(row) {
  const order = asRecord(row?.order_id);
  if (order) {
    const no = String(order.order_no ?? order.orderNo ?? '').trim();
    if (no) return no;
  }
  return '';
}

function orderStatusFromRow(row) {
  const order = asRecord(row?.order_id);
  return String(order?.order_status ?? order?.orderStatus ?? '').trim();
}

function CompanyCell({ company }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const name = companyDisplayName(company) || '—';
  const logoUrl = pickCompanyLogoUrl(asRecord(company));
  const showLogo = Boolean(logoUrl) && !logoFailed;
  return (
    <span
      className="d-inline-flex align-items-center gap-2"
      title={name === '—' ? undefined : name}
      aria-label={name}
    >
      {showLogo ? (
        <span className="list-origin-logo-wrap flex-shrink-0">
          <img
            src={logoUrl}
            alt=""
            className="list-origin-logo"
            onError={() => setLogoFailed(true)}
          />
        </span>
      ) : null}
      <span className="list-cell-name-wrap">{name}</span>
    </span>
  );
}

function buildSourceEntry({ url, status, durationMs = null, error = null }) {
  return {
    key: 'origin-company-order-items',
    label: 'Bigcommerce orders (origin company)',
    url,
    status,
    durationMs,
    error,
  };
}

/**
 * Vendor view of marketplace line items (`GET order_item/by-origin-company`).
 */
export default function OriginCompanyOrderItemsList({ search = '', onApiSourceChange }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [reloadKey, setReloadKey] = useState(0);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    'origin-company-order-items',
    COLUMNS
  );

  const searchTerm = String(search || '').trim();

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: searchTerm,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    }),
    [page, limit, searchTerm, sort.sortBy, sort.sortOrder]
  );

  const requestUrl = useMemo(() => {
    const { query } = buildOrderItemByOriginCompanyQuery(queryParams);
    const qs = query.toString();
    return buildApiUrl(`${ORDER_ITEM_BY_ORIGIN_COMPANY_PATH}${qs ? `?${qs}` : ''}`);
  }, [queryParams]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      onApiSourceChange?.(buildSourceEntry({ url: requestUrl, status: 'loading' }));
      const started = performance.now();
      try {
        const result = await fetchOrderItemsByOriginCompanyRequest(queryParams);
        if (cancelled) return;
        const data = Array.isArray(result?.data) ? result.data : [];
        const nextTotal = Number(result?.total) || 0;
        const nextLimit = Number(result?.limit) || limit;
        const nextTotalPages =
          Number(result?.totalPages) ||
          (nextLimit > 0 ? Math.ceil(nextTotal / nextLimit) : 0);
        setRows(data);
        setTotal(nextTotal);
        setTotalPages(nextTotalPages);
        setStatus('succeeded');
        onApiSourceChange?.(
          buildSourceEntry({
            url: requestUrl,
            status: 'success',
            durationMs: Math.round(performance.now() - started),
          })
        );
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || 'Failed to load origin company order items.';
        setRows([]);
        setTotal(0);
        setTotalPages(0);
        setError(message);
        setStatus('failed');
        onApiSourceChange?.(
          buildSourceEntry({
            url: requestUrl,
            status: 'error',
            durationMs: Math.round(performance.now() - started),
            error: message,
          })
        );
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent setter is stable
  }, [queryParams, requestUrl, reloadKey]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = useCallback((column, isDoubleClick = false) => {
    if (isDoubleClick) {
      setSort({ sortBy: 'createdAt', sortOrder: 'desc' });
      setPage(1);
      return;
    }
    setSort((prev) => {
      if (prev.sortBy === column) {
        return { sortBy: column, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: column, sortOrder: 'desc' };
    });
    setPage(1);
  }, []);

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh
      column={column}
      label={label}
      sort={sort}
      onSort={handleSort}
      className={`text-center ${className}`.trim()}
    />
  );

  const loading = status === 'loading' || status === 'idle';
  const pagination = { page, limit, total, totalPages };

  return (
    <div>
      <div className="d-flex justify-content-end px-3 pb-2">
        <ColumnVisibilityMenu
          columns={COLUMNS}
          isVisible={isVisible}
          onToggle={toggle}
          onReset={reset}
          id="originCompanyOrderItemsColumnMenu"
        />
      </div>
      <ListDataTable
        className="list-data-table--origin-company-order-items"
        loading={loading}
        loadingLabel="Loading Bigcommerce orders…"
        error={error}
        errorPrefix="Error loading Bigcommerce orders"
        onRetry={() => setReloadKey((n) => n + 1)}
        pagination={pagination}
        onPageChange={(nextPage) => {
          if (nextPage >= 1 && nextPage <= Math.max(totalPages, 1)) setPage(nextPage);
        }}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
        selectId="origin-company-order-items-page-size"
        showPagination={!loading && !error && total > 0}
      >
        <table className="table align-items-center mb-0">
          <thead>
            <tr>
              <th className="text-center list-col-sno">#</th>
              {isVisible('order_no') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Order no
                </th>
              ) : null}
              {isVisible('product') ? sortableTh('name', 'Product', 'list-col-name-wrap') : null}
              {isVisible('destination_company') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Destination
                </th>
              ) : null}
              {isVisible('qty') ? sortableTh('qty', 'Qty', 'list-col-amount') : null}
              {isVisible('status') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Status
                </th>
              ) : null}
              {isVisible('dates') ? sortableTh('createdAt', 'Created / Updated', 'list-col-date') : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCount} className="text-center text-muted py-5">
                  No Bigcommerce orders found. Try adjusting your search.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const seriesNumber = (page - 1) * limit + index + 1;
                const key = pickRefId(row) || `origin-item-${index}`;
                const orderNo = orderNoFromRow(row) || '—';
                const productName = productDisplayName(row) || '—';
                const statusVal = orderStatusFromRow(row);
                const created = row?.createdAt ?? row?.created_at;
                const updated = row?.updatedAt ?? row?.updated_at;
                return (
                  <tr key={key}>
                    <td className="text-center text-muted text-sm">{seriesNumber}</td>
                    {isVisible('order_no') ? (
                      <td className="text-sm font-weight-bold text-dark">{orderNo}</td>
                    ) : null}
                    {isVisible('product') ? (
                      <td className="text-sm list-col-name-wrap">
                        <div className="list-cell-name-wrap" title={productName}>
                          {productName}
                        </div>
                      </td>
                    ) : null}
                    {isVisible('destination_company') ? (
                      <td className="text-sm text-center">
                        <CompanyCell company={row?.company_id ?? row?.companyId} />
                      </td>
                    ) : null}
                    {isVisible('qty') ? (
                      <td className="text-sm text-center">{row?.qty ?? '—'}</td>
                    ) : null}
                    {isVisible('status') ? (
                      <td className="text-center">
                        {statusVal ? (
                          <span className={orderStatusBadgeClass(statusVal)}>
                            {formatOrderStatusOptionLabel(statusVal)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ) : null}
                    {isVisible('dates') ? (
                      <td className="text-sm list-col-date">
                        {created || updated ? (
                          <div className="oms-dates-cell">
                            <div
                              className="text-nowrap"
                              title={
                                created ? moment(created).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                            </div>
                            <div
                              className="oms-dates-cell__updated text-nowrap"
                              title={
                                updated ? moment(updated).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {updated ? `Updated ${moment(updated).fromNow()}` : '—'}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ListDataTable>
    </div>
  );
}
