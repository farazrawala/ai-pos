const ListDateExportBar = ({
  idPrefix,
  localStartDate,
  localEndDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onClear,
  exporting = false,
  onExport,
}) => (
  <div className="card-body pt-0 px-3 pb-0">
    <div className="row g-2 align-items-end mb-3">
      <div className="col-md-3 col-sm-6">
        <label className="form-label mb-1 text-sm" htmlFor={`${idPrefix}-from-date`}>
          From date
        </label>
        <input
          id={`${idPrefix}-from-date`}
          type="date"
          className="form-control form-control-sm"
          value={localStartDate}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
      </div>
      <div className="col-md-3 col-sm-6">
        <label className="form-label mb-1 text-sm" htmlFor={`${idPrefix}-to-date`}>
          To date
        </label>
        <input
          id={`${idPrefix}-to-date`}
          type="date"
          className="form-control form-control-sm"
          value={localEndDate}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </div>
      <div className="col-md-6 d-flex flex-wrap align-items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm mb-0" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm mb-0" onClick={onClear}>
          Clear
        </button>
        <span className="text-muted text-sm mx-1 d-none d-md-inline">|</span>
        <span className="text-sm text-muted d-none d-md-inline">Download all:</span>
        <button
          type="button"
          className="btn btn-outline-success btn-sm mb-0"
          disabled={exporting}
          onClick={() => onExport('csv')}
        >
          {exporting ? 'Exporting…' : 'CSV'}
        </button>
        <button
          type="button"
          className="btn btn-outline-success btn-sm mb-0"
          disabled={exporting}
          onClick={() => onExport('excel')}
        >
          Excel
        </button>
        <button
          type="button"
          className="btn btn-outline-success btn-sm mb-0"
          disabled={exporting}
          onClick={() => onExport('pdf')}
        >
          PDF
        </button>
      </div>
    </div>
  </div>
);

export default ListDateExportBar;
