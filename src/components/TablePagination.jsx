import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';

/** Page numbers with ellipsis when the range is not contiguous. */
export function buildVisiblePages(current, total, siblingCount = 1) {
  if (total <= 1) return [1];

  const pages = new Set([1, total]);
  for (let i = current - siblingCount; i <= current + siblingCount; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * List page pagination toolbar (entries selector + icon prev/next + page numbers).
 */
const TablePagination = ({
  pagination,
  onPageChange,
  onLimitChange,
  hidden = false,
  className = '',
  selectId = 'table-page-size',
}) => {
  if (hidden || !pagination?.total) return null;

  const { page, limit, total } = pagination;
  const totalPages = Math.max(
    1,
    pagination.totalPages || Math.ceil(total / Math.max(limit, 1))
  );
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  const visiblePages = buildVisiblePages(page, totalPages);

  return (
    <div className={`list-table-toolbar ${className}`.trim()}>
      <div className="list-table-toolbar-entries">
        <label className="list-table-toolbar-label mb-0" htmlFor={selectId}>
          Show
        </label>
        <select
          id={selectId}
          className="form-select form-select-sm list-table-toolbar-select"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          aria-label="Rows per page"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={500}>500</option>
        </select>
        <span className="list-table-toolbar-label mb-0">entries</span>
        <span className="list-table-toolbar-range text-sm text-muted">
          Showing {startItem} to {endItem} of {total}
        </span>
      </div>

      <nav className="list-table-toolbar-nav" aria-label="Table pagination">
        <div className="list-pagination-pills">
          <button
            type="button"
            className="list-pagination-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={atFirst}
            aria-label="Previous page"
          >
            <NavIcon icon={FaChevronLeft} size={14} />
          </button>

          {visiblePages.map((item, idx) => {
            if (item === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="list-pagination-ellipsis"
                  aria-hidden
                >
                  …
                </span>
              );
            }
            const isActive = item === page;
            return (
              <button
                key={item}
                type="button"
                className={`list-pagination-btn list-pagination-btn--page${
                  isActive ? ' is-active' : ''
                }`}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item}
              </button>
            );
          })}

          <button
            type="button"
            className="list-pagination-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={atLast}
            aria-label="Next page"
          >
            <NavIcon icon={FaChevronRight} size={14} />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default TablePagination;
