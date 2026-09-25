import './line-items-csv-buttons.css';

/** "Clear all" button for a line-items table header; confirms before clearing. */
const ClearLinesButton = ({ count, onClear, disabled = false }) => {
  if (!count) return null;
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-danger mb-0 line-items-clear-btn"
      title="Remove all line items"
      onClick={() => {
        if (window.confirm(`Remove all ${count} line item${count === 1 ? '' : 's'}?`)) onClear();
      }}
      disabled={disabled}
    >
      Clear all
    </button>
  );
};

export default ClearLinesButton;
