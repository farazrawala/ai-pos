/**
 * Filters — detail ledger transactions.
 */
export default function LedgerDetailFilters({
  dateFrom,
  dateTo,
  transactionType,
  reference,
  paymentMethod,
  category,
  createdBy,
  searchNotes,
  onChange,
  onApply,
  onReset,
  onQuickRange,
  onExportCsv,
}) {
  return (
    <div className="card border-0 shadow-sm mb-4 ledger-detail-toolbar">
      <div className="card-header pb-2 pt-3 bg-transparent border-bottom-0">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h6 className="mb-0 text-sm font-weight-bold text-uppercase text-muted">Ledger filters</h6>
          <div className="d-flex flex-wrap gap-1">
            {['Today', 'This week', 'This month', 'This year'].map((label) => (
              <button
                key={label}
                type="button"
                className="btn btn-sm btn-outline-primary mb-0 py-1 px-2"
                onClick={() => onQuickRange(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card-body pt-2">
        <div className="row g-3 align-items-end">
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">From</label>
            <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => onChange('dateFrom', e.target.value)} />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">To</label>
            <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => onChange('dateTo', e.target.value)} />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Type</label>
            <select className="form-select form-select-sm" value={transactionType} onChange={(e) => onChange('transactionType', e.target.value)}>
              <option value="all">All</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Reference</label>
            <input type="text" className="form-control form-control-sm" placeholder="REF-…" value={reference} onChange={(e) => onChange('reference', e.target.value)} />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Payment method</label>
            <select className="form-select form-select-sm" value={paymentMethod} onChange={(e) => onChange('paymentMethod', e.target.value)}>
              <option value="all">All</option>
              <option value="Cash">Cash</option>
              <option value="Bank transfer">Bank transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Journal">Journal</option>
              <option value="On account">On account</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Category</label>
            <input type="text" className="form-control form-control-sm" placeholder="Sales, …" value={category} onChange={(e) => onChange('category', e.target.value)} />
          </div>
          <div className="col-lg-2 col-md-4 col-sm-6">
            <label className="form-label text-xs mb-1">Created by</label>
            <input type="text" className="form-control form-control-sm" value={createdBy} onChange={(e) => onChange('createdBy', e.target.value)} />
          </div>
          <div className="col-lg-4 col-md-8">
            <label className="form-label text-xs mb-1">Search notes / description</label>
            <input type="text" className="form-control form-control-sm" value={searchNotes} onChange={(e) => onChange('searchNotes', e.target.value)} />
          </div>
          <div className="col-12 d-flex flex-wrap gap-2 justify-content-end">
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={onApply}>
              Apply
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onReset}>
              Reset
            </button>
            <button type="button" className="btn btn-sm btn-outline-dark mb-0" onClick={onExportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
