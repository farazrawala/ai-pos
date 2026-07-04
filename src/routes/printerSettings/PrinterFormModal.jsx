import { useEffect, useState } from 'react';
import {
  DEFAULT_PRINTER,
  PRINTER_TYPES,
  PAPER_WIDTHS,
  CHARACTER_ENCODINGS,
  PRINTER_STATUSES,
} from '../../features/printers/printerConstants.js';

const boolSelect = (value, onChange) => (
  <select className="form-select form-select-sm" value={value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')}>
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>
);

export default function PrinterFormModal({ open, initial, onClose, onSave, saving, errors = {} }) {
  const [form, setForm] = useState({ ...DEFAULT_PRINTER });

  useEffect(() => {
    if (open) setForm({ ...DEFAULT_PRINTER, ...(initial || {}) });
  }, [open, initial]);

  if (!open) return null;

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{initial?._id ? 'Edit printer' : 'Add printer'}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Printer name *</label>
                    <input
                      className={`form-control form-control-sm ${errors.name ? 'is-invalid' : ''}`}
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="Kitchen Printer"
                    />
                    {errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <select className="form-select form-select-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>
                      {PRINTER_STATUSES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">IP address *</label>
                    <input
                      className={`form-control form-control-sm ${errors.ip_address ? 'is-invalid' : ''}`}
                      value={form.ip_address}
                      onChange={(e) => set('ip_address', e.target.value)}
                      placeholder="192.168.1.120"
                    />
                    {errors.ip_address ? <div className="invalid-feedback d-block">{errors.ip_address}</div> : null}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      className={`form-control form-control-sm ${errors.port ? 'is-invalid' : ''}`}
                      value={form.port}
                      onChange={(e) => set('port', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Printer type</label>
                    <select className="form-select form-select-sm" value={form.printer_type} onChange={(e) => set('printer_type', e.target.value)}>
                      {PRINTER_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Paper width</label>
                    <select className="form-select form-select-sm" value={form.paper_width} onChange={(e) => set('paper_width', e.target.value)}>
                      {PAPER_WIDTHS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Character encoding</label>
                    <select className="form-select form-select-sm" value={form.character_encoding} onChange={(e) => set('character_encoding', e.target.value)}>
                      {CHARACTER_ENCODINGS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Copies</label>
                    <input type="number" min="1" max="10" className="form-control form-control-sm" value={form.copies} onChange={(e) => set('copies', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Auto cut</label>
                    {boolSelect(form.auto_cut, (v) => set('auto_cut', v))}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Open cash drawer</label>
                    {boolSelect(form.open_cash_drawer, (v) => set('open_cash_drawer', v))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary mb-0" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary mb-0" disabled={saving}>{saving ? 'Saving…' : 'Save printer'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
