/**
 * Search & filter toolbar — listing page.
 */
export default function LedgerUsersFilters({
  search,
  contactSearch,
  status,
  balanceType,
  dateFrom,
  dateTo,
  sortBy,
  onChange,
  onApply,
  onReset,
  onQuickFilter,
}) {
  return (
    <div className="card border-0 shadow-sm mb-4 ledger-sticky-toolbar">
      <div className="card-header pb-2 pt-3 bg-transparent border-bottom-0">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h6 className="mb-0 text-sm font-weight-bold text-uppercase text-muted">Search &amp; filters</h6>
          <div className="d-flex flex-wrap gap-1">
            {['Active', 'Receivable', 'Payable', 'Recent activity'].map((label) => (
              <button
                key={label}
                type="button"
                className="btn btn-sm btn-outline-primary mb-0 py-1 px-2"
                onClick={() => onQuickFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card-body pt-2">
        <div className="row g-3 align-items-end">
          <div className="col-lg-3 col-md-6">
            <label className="form-label text-xs mb-1">Search user</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Name…"
              value={search}
              onChange={(e) => onChange('search', e.target.value)}
            />
          </div>
          <div className="col-lg-3 col-md-6">
            <label className="form-label text-xs mb-1">Phone / email</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Contact…"
              value={contactSearch}
              onChange={(e) => onChange('contactSearch', e.target.value)}
            />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Status</label>
            <select
              className="form-select form-select-sm"
              value={status}
              onChange={(e) => onChange('status', e.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Balance type</label>
            <select
              className="form-select form-select-sm"
              value={balanceType}
              onChange={(e) => onChange('balanceType', e.target.value)}
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="zero">Zero</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Sort by</label>
            <select
              className="form-select form-select-sm"
              value={sortBy}
              onChange={(e) => onChange('sortBy', e.target.value)}
            >
              <option value="fullName">Name</option>
              <option value="currentBalance">Current balance</option>
              <option value="openingBalance">Opening balance</option>
              <option value="lastTransactionAt">Last transaction</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateFrom}
              onChange={(e) => onChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateTo}
              onChange={(e) => onChange('dateTo', e.target.value)}
            />
          </div>
          <div className="col-12 d-flex flex-wrap gap-2 justify-content-end">
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={onApply}>
              Apply
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
