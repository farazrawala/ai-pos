import {
  PRINTER_TYPES,
  PAPER_WIDTHS,
  CHARACTER_ENCODINGS,
  PRINTER_STATUSES,
} from '../../features/printers/printerConstants.js';

const boolSelect = (value, onChange, disabled) => (
  <select
    className="form-select company-control"
    value={value ? 'yes' : 'no'}
    onChange={(e) => onChange(e.target.value === 'yes')}
    disabled={disabled}
  >
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>
);

export default function DefaultPrinterSettingsForm({
  form,
  onChange,
  errors = {},
  disabled = false,
}) {
  const set = (name, value) => onChange({ ...form, [name]: value });

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-name">
          Printer name <span className="req">*</span>
        </label>
        <input
          id="default-printer-name"
          className={`form-control company-control ${errors.name ? 'is-invalid' : ''}`}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Kitchen Printer"
          disabled={disabled}
        />
        {errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-status">
          Status
        </label>
        <select
          id="default-printer-status"
          className="form-select company-control"
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          disabled={disabled}
        >
          {PRINTER_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-ip">
          IP address <span className="req">*</span>
        </label>
        <input
          id="default-printer-ip"
          className={`form-control company-control ${errors.ip_address ? 'is-invalid' : ''}`}
          value={form.ip_address}
          onChange={(e) => set('ip_address', e.target.value)}
          placeholder="192.168.1.120"
          disabled={disabled}
        />
        {errors.ip_address ? (
          <div className="invalid-feedback d-block">{errors.ip_address}</div>
        ) : null}
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-port">
          Port
        </label>
        <input
          id="default-printer-port"
          type="number"
          min="1"
          max="65535"
          className={`form-control company-control ${errors.port ? 'is-invalid' : ''}`}
          value={form.port}
          onChange={(e) => set('port', Number(e.target.value))}
          disabled={disabled}
        />
        {errors.port ? <div className="invalid-feedback d-block">{errors.port}</div> : null}
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-type">
          Printer type
        </label>
        <select
          id="default-printer-type"
          className="form-select company-control"
          value={form.printer_type}
          onChange={(e) => set('printer_type', e.target.value)}
          disabled={disabled}
        >
          {PRINTER_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-paper">
          Paper width
        </label>
        <select
          id="default-printer-paper"
          className="form-select company-control"
          value={form.paper_width}
          onChange={(e) => set('paper_width', e.target.value)}
          disabled={disabled}
        >
          {PAPER_WIDTHS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-encoding">
          Character encoding
        </label>
        <select
          id="default-printer-encoding"
          className="form-select company-control"
          value={form.character_encoding}
          onChange={(e) => set('character_encoding', e.target.value)}
          disabled={disabled}
        >
          {CHARACTER_ENCODINGS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-copies">
          Copies
        </label>
        <input
          id="default-printer-copies"
          type="number"
          min="1"
          max="10"
          className="form-control company-control"
          value={form.copies}
          onChange={(e) => set('copies', Number(e.target.value))}
          disabled={disabled}
        />
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-autocut">
          Auto cut
        </label>
        {boolSelect(form.auto_cut, (v) => set('auto_cut', v), disabled)}
      </div>

      <div className="col-md-6">
        <label className="company-label d-block" htmlFor="default-printer-drawer">
          Open cash drawer
        </label>
        {boolSelect(form.open_cash_drawer, (v) => set('open_cash_drawer', v), disabled)}
      </div>
    </div>
  );
}
