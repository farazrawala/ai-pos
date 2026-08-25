import { useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa6';

export default function SettingSection({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="pl-setting-section">
      <button
        type="button"
        className="pl-setting-section__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="pl-setting-section__title">
          {Icon ? <Icon className="pl-setting-section__icon" /> : null}
          {title}
        </span>
        {open ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
      </button>
      <div className={`pl-setting-section__body ${open ? 'is-open' : ''}`}>{children}</div>
    </div>
  );
}

export function SettingRow({ label, hint, children }) {
  return (
    <div className="pl-setting-row">
      <div className="pl-setting-row__label">
        <span>{label}</span>
        {hint ? <small className="text-muted d-block">{hint}</small> : null}
      </div>
      <div className="pl-setting-row__control">{children}</div>
    </div>
  );
}

export function SettingToggle({ label, hint, checked, onChange, disabled }) {
  return (
    <SettingRow label={label} hint={hint}>
      <label className="form-check form-switch mb-0 pl-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={Boolean(checked)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </label>
    </SettingRow>
  );
}

export function SettingSelect({ label, hint, value, options, onChange }) {
  return (
    <SettingRow label={label} hint={hint}>
      <select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}

export function SettingInput({ label, hint, value, onChange, type = 'text', min, max, step, multiline }) {
  return (
    <SettingRow label={label} hint={hint}>
      {multiline ? (
        <textarea
          className="form-control form-control-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="form-control form-control-sm"
          type={type}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) =>
            onChange(type === 'number' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </SettingRow>
  );
}

export function SettingColorPicker({ label, hint, value, onChange }) {
  return (
    <SettingRow label={label} hint={hint}>
      <div className="pl-color-picker">
        <input
          type="color"
          className="pl-color-picker__swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          type="text"
          className="form-control form-control-sm pl-color-picker__hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </SettingRow>
  );
}
