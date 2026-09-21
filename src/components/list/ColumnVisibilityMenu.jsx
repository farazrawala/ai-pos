import { useEffect, useRef, useState } from 'react';
import { FaTableColumns, FaCheck } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';

/**
 * Overlay to show/hide table columns. Pairs with `useColumnVisibility`.
 * Controlled in React so Argon/Bootstrap dropdown CSS cannot shift the toolbar.
 *
 * @param {object} props
 * @param {{ key: string; label: string; alwaysVisible?: boolean }[]} props.columns
 * @param {(key: string) => boolean} props.isVisible
 * @param {(key: string) => void} props.onToggle
 * @param {() => void} [props.onReset]
 * @param {string} [props.buttonLabel]
 * @param {string} [props.id]
 */
export default function ColumnVisibilityMenu({
  columns,
  isVisible,
  onToggle,
  onReset,
  buttonLabel = 'Columns',
  id = 'columnVisibilityMenu',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleable = columns.filter((c) => !c.alwaysVisible);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="column-visibility-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary mb-0 d-inline-flex align-items-center"
        id={id}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={`${id}-panel`}
        title="Show / hide columns"
        onClick={() => setOpen((prev) => !prev)}
      >
        <NavIcon icon={FaTableColumns} size={14} className="me-1" />
        {buttonLabel}
      </button>
      {open ? (
        <div
          className="column-visibility-panel"
          id={`${id}-panel`}
          role="menu"
          aria-labelledby={id}
        >
          <div className="d-flex align-items-center justify-content-between px-3 pt-3 pb-2">
            <span className="text-sm font-weight-bold mb-0">Show columns</span>
            {onReset ? (
              <button type="button" className="btn btn-link btn-sm p-0 text-xs" onClick={onReset}>
                Reset
              </button>
            ) : null}
          </div>
          <div className="column-visibility-options">
            {toggleable.map((col) => {
              const checked = isVisible(col.key);
              return (
                <button
                  type="button"
                  key={col.key}
                  className={`column-visibility-option${checked ? ' is-checked' : ''}`}
                  onClick={() => onToggle(col.key)}
                  role="menuitemcheckbox"
                  aria-checked={checked}
                >
                  <span className="column-visibility-check">
                    {checked ? <NavIcon icon={FaCheck} size={11} /> : null}
                  </span>
                  <span className="column-visibility-label">{col.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
