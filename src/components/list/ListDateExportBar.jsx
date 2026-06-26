const ListDateExportBar = ({
  idPrefix,
  show = true,
  localStartDate,
  localEndDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onClear,
  exporting = false,
  onExport,
}) => {
  if (!show) return null;

  return (
    <div className="card-body pt-0 px-3 pb-0">
      <div className="orders-filter-panel" id={`${idPrefix}-filter-panel`}>
        <div className="row g-3 align-items-end">
          <div className="col-xl-3 col-md-4 col-sm-6">
            <label
              className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
              htmlFor={`${idPrefix}-from-date`}
            >
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
          <div className="col-xl-3 col-md-4 col-sm-6">
            <label
              className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
              htmlFor={`${idPrefix}-to-date`}
            >
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
          <div className="col-xl-6 col-md-4 d-flex flex-wrap align-items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm mb-0" onClick={onApply}>
              <i className="fas fa-check me-1" aria-hidden="true" />
              Apply
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mb-0"
              onClick={onClear}
            >
              <i className="fas fa-rotate-left me-1" aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>
        <hr className="my-3 opacity-50" />
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-xs text-uppercase fw-bold text-muted me-1">
            <i className="fas fa-download me-1" aria-hidden="true" />
            Download all
          </span>
          <button
            type="button"
            className="btn btn-outline-success btn-sm mb-0"
            disabled={exporting}
            onClick={() => onExport('csv')}
          >
            <i className="fas fa-file-csv me-1" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'CSV'}
          </button>
          <button
            type="button"
            className="btn btn-outline-success btn-sm mb-0"
            disabled={exporting}
            onClick={() => onExport('excel')}
          >
            <i className="fas fa-file-excel me-1" aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm mb-0"
            disabled={exporting}
            onClick={() => onExport('pdf')}
          >
            <i className="fas fa-file-pdf me-1" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListDateExportBar;
