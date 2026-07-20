import { SORT_OPTIONS } from '../../features/bigCommerce/marketplaceUtils.js';

function entityId(item) {
  return String(item?._id ?? item?.id ?? '').trim();
}

function entityName(item) {
  return String(item?.name ?? item?.category_name ?? item?.brand_name ?? 'Untitled').trim();
}

export default function MarketplaceFilters({
  filters,
  categories = [],
  brands = [],
  onChange,
  onReset,
  priceBounds = { min: 0, max: 100000 },
}) {
  const toggleId = (key, id) => {
    const list = Array.isArray(filters[key]) ? filters[key] : [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onChange({ [key]: next });
  };

  const maxSlider = Math.max(Number(priceBounds.max) || 100000, Number(filters.maxPrice) || 0, 1000);
  const minVal = filters.minPrice === '' ? 0 : Number(filters.minPrice) || 0;
  const maxVal = filters.maxPrice === '' ? maxSlider : Number(filters.maxPrice) || maxSlider;

  return (
    <aside className="bc-filters">
      <div className="bc-filters-head">
        <h2>Filters</h2>
        <button type="button" className="bc-btn bc-btn-ghost bc-btn-sm" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="bc-filter-block">
        <label className="bc-filter-label" htmlFor="bc-filter-search">
          Search
        </label>
        <input
          id="bc-filter-search"
          type="search"
          className="bc-input"
          placeholder="Name, SKU, barcode…"
          value={filters.search || ''}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div className="bc-filter-block">
        <div className="bc-filter-label">Category</div>
        <div className="bc-check-list">
          {categories.length === 0 ? (
            <p className="bc-muted bc-small">No categories</p>
          ) : (
            categories.map((cat) => {
              const id = entityId(cat);
              if (!id) return null;
              return (
                <label key={id} className="bc-check">
                  <input
                    type="checkbox"
                    checked={(filters.categoryIds || []).includes(id)}
                    onChange={() => toggleId('categoryIds', id)}
                  />
                  <span>{entityName(cat)}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="bc-filter-block">
        <div className="bc-filter-label">Brand</div>
        <div className="bc-check-list">
          {brands.length === 0 ? (
            <p className="bc-muted bc-small">No brands</p>
          ) : (
            brands.map((brand) => {
              const id = entityId(brand);
              if (!id) return null;
              return (
                <label key={id} className="bc-check">
                  <input
                    type="checkbox"
                    checked={(filters.brandIds || []).includes(id)}
                    onChange={() => toggleId('brandIds', id)}
                  />
                  <span>{entityName(brand)}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="bc-filter-block">
        <div className="bc-filter-label">Price range</div>
        <div className="bc-price-inputs">
          <input
            type="number"
            className="bc-input"
            min={0}
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
          />
          <span className="bc-price-sep">–</span>
          <input
            type="number"
            className="bc-input"
            min={0}
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
          />
        </div>
        <input
          type="range"
          className="bc-range"
          min={0}
          max={maxSlider}
          value={maxVal}
          onChange={(e) => onChange({ maxPrice: e.target.value, minPrice: String(minVal) })}
          aria-label="Maximum price"
        />
      </div>

      <div className="bc-filter-block">
        <div className="bc-filter-label">Stock</div>
        <div className="bc-radio-list">
          {[
            { value: '', label: 'Any' },
            { value: 'in_stock', label: 'In Stock' },
            { value: 'out_of_stock', label: 'Out of Stock' },
            { value: 'low_stock', label: 'Low Stock' },
          ].map((opt) => (
            <label key={opt.value || 'any'} className="bc-radio">
              <input
                type="radio"
                name="bc-stock"
                checked={(filters.stock || '') === opt.value}
                onChange={() => onChange({ stock: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bc-filter-block">
        <label className="bc-filter-label" htmlFor="bc-sort">
          Sort by
        </label>
        <select
          id="bc-sort"
          className="bc-input"
          value={filters.sortBy || 'latest'}
          onChange={(e) => onChange({ sortBy: e.target.value })}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
