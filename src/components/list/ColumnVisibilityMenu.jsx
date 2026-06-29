import { FaTableColumns, FaCheck } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';

/**
 * Dropdown to show/hide table columns. Pairs with `useColumnVisibility`.
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
  const toggleable = columns.filter((c) => !c.alwaysVisible);

  return (
    <div className="dropdown column-visibility-menu">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary mb-0 d-inline-flex align-items-center"
        id={id}
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
        title="Show / hide columns"
      >
        <NavIcon icon={FaTableColumns} size={14} className="me-1" />
        {buttonLabel}
      </button>
      <div
        className="dropdown-menu dropdown-menu-end column-visibility-panel p-0"
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
    </div>
  );
}
