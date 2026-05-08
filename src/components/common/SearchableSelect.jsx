import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * @typedef {{ value: string, label: string, subLabel?: string }} SearchableOption
 *
 * @param {{
 *   options?: SearchableOption[];
 *   value: string;
 *   placeholder?: string;
 *   disabled?: boolean;
 *   onChange: (next: string) => void;
 * }} props
 */
export default function SearchableSelect({
  options = [],
  value,
  placeholder = 'Select…',
  disabled = false,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = (o.label || '').toLowerCase();
      const sub = (o.subLabel || '').toLowerCase();
      const id = String(o.value || '').toLowerCase();
      return label.includes(q) || sub.includes(q) || id.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const display = selected?.label || '';

  const handleToggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
    if (!open) setQuery('');
  };

  const pick = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className="position-relative">
      <button
        type="button"
        className={`form-select text-start d-flex align-items-center justify-content-between text-sm ${
          !display ? 'text-muted' : ''
        }`}
        disabled={disabled}
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-truncate me-2">{display || placeholder}</span>
        <i className="ni ni-bold-down text-xs opacity-6 flex-shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          className="position-absolute top-100 start-0 end-0 mt-1 rounded-3 border bg-white shadow-sm p-2"
          style={{ zIndex: 1055, maxHeight: 320 }}
          role="listbox"
        >
          <div className="input-group input-group-sm mb-2">
            <span className="input-group-text bg-transparent border-end-0 py-1">
              <i className="ni ni-zoom-split text-primary text-sm" aria-hidden />
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0 text-sm"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="overflow-auto" style={{ maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <div className="text-muted text-xs px-2 py-3 text-center">No matches.</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={String(o.value) === String(value)}
                  className={`btn btn-link text-start text-decoration-none text-body w-100 py-2 px-2 rounded-2 ${
                    String(o.value) === String(value) ? 'bg-light' : ''
                  }`}
                  onClick={() => pick(o.value)}
                >
                  <div className="text-sm font-weight-bold text-truncate">{o.label}</div>
                  {o.subLabel ? <div className="text-xs text-muted text-wrap">{o.subLabel}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
