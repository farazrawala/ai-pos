import { FaGrip, FaList, FaMagnifyingGlass } from 'react-icons/fa6';
import { PAGE_SIZE_OPTIONS } from '../../features/bigCommerce/marketplaceUtils.js';

export default function ProductToolbar({
  search,
  onSearchChange,
  showing,
  total,
  viewMode,
  onViewModeChange,
  pageSize,
  onPageSizeChange,
}) {
  return (
    <div className="bc-toolbar">
      <div className="bc-search-wrap">
        <FaMagnifyingGlass className="bc-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="bc-search-input"
          placeholder="Search products..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search products"
        />
      </div>

      <div className="bc-toolbar-row">
        <p className="bc-result-summary mb-0">
          Showing <strong>{showing}</strong> of <strong>{total}</strong> Products
        </p>

        <div className="bc-toolbar-actions">
          <div className="bc-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`bc-icon-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('grid')}
              title="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <FaGrip />
            </button>
            <button
              type="button"
              className={`bc-icon-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => onViewModeChange('list')}
              title="List view"
              aria-pressed={viewMode === 'list'}
            >
              <FaList />
            </button>
          </div>

          <label className="bc-page-size">
            <span className="bc-sr-only">Page size</span>
            <select
              className="bc-input bc-input-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
