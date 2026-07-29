import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../features/support/supportConstants.js';

/**
 * Shared filter bar for user and admin ticket lists.
 */
export default function TicketFilters({
  filters = {},
  onChange,
  onReset,
  showAssigned = false,
  assignedOptions = [],
  className = '',
}) {
  const update = (key, value) => {
    onChange?.({ ...filters, [key]: value });
  };

  const hasActive =
    filters.search ||
    filters.status ||
    filters.priority ||
    filters.category ||
    filters.assigned_to ||
    filters.date_from ||
    filters.date_to;

  return (
    <div className={`support-filters ${className}`.trim()}>
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-4 col-lg-3">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-search">
            Search
          </label>
          <input
            id="support-filter-search"
            type="search"
            className="form-control form-control-sm"
            placeholder="Subject, ID, user…"
            value={filters.search || ''}
            onChange={(e) => update('search', e.target.value)}
          />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-status">
            Status
          </label>
          <select
            id="support-filter-status"
            className="form-select form-select-sm"
            value={filters.status || ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">All</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-priority">
            Priority
          </label>
          <select
            id="support-filter-priority"
            className="form-select form-select-sm"
            value={filters.priority || ''}
            onChange={(e) => update('priority', e.target.value)}
          >
            <option value="">All</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-category">
            Category
          </label>
          <select
            id="support-filter-category"
            className="form-select form-select-sm"
            value={filters.category || ''}
            onChange={(e) => update('category', e.target.value)}
          >
            <option value="">All</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {showAssigned ? (
          <div className="col-6 col-md-4 col-lg-2">
            <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-assigned">
              Assigned
            </label>
            <select
              id="support-filter-assigned"
              className="form-select form-select-sm"
              value={filters.assigned_to || ''}
              onChange={(e) => update('assigned_to', e.target.value)}
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {assignedOptions.map((u) => (
                <option key={u._id || u.id} value={u._id || u.id}>
                  {u.name || u.email || 'Admin'}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="col-6 col-md-4 col-lg-2">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-from">
            From
          </label>
          <input
            id="support-filter-from"
            type="date"
            className="form-control form-control-sm"
            value={filters.date_from || ''}
            onChange={(e) => update('date_from', e.target.value)}
          />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <label className="form-label text-xs text-uppercase mb-1" htmlFor="support-filter-to">
            To
          </label>
          <input
            id="support-filter-to"
            type="date"
            className="form-control form-control-sm"
            value={filters.date_to || ''}
            onChange={(e) => update('date_to', e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mb-0"
            onClick={onReset}
            disabled={!hasActive}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
