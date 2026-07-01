export default function AttributeValuesEditor({
  values,
  newValue,
  onNewValueChange,
  onAddValue,
  onRemoveValue,
  onKeyDown,
  disabled = false,
  error,
}) {
  const valueCount = values.length;

  return (
    <div className="attr-form-section">
      <div className="d-flex align-items-center flex-wrap gap-2 mb-0">
        <div className="attr-form-section-title mb-0">
          <i className="fas fa-tags text-primary" aria-hidden="true" />
          Attribute values
        </div>
        {valueCount > 0 ? (
          <span className="attr-value-count" aria-label={`${valueCount} values`}>
            {valueCount}
          </span>
        ) : null}
      </div>
      <p className="attr-form-section-hint">
        Add options like Red, Blue, Small, or Large. Press Enter or click Add value.
      </p>

      <div className="attr-value-add-row">
        <input
          type="text"
          className="form-control attr-form-control"
          placeholder="Enter value (e.g. Red, Small)"
          value={newValue}
          onChange={(e) => onNewValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-label="New attribute value"
        />
        <button
          type="button"
          className="btn btn-sm btn-outline-primary mb-0"
          onClick={onAddValue}
          disabled={!newValue.trim() || disabled}
        >
          <i className="fas fa-plus me-1" aria-hidden="true" />
          Add value
        </button>
      </div>

      {error ? <div className="text-danger small mt-2">{error}</div> : null}

      <div
        className={`attr-value-chips${valueCount === 0 ? ' attr-value-chips--empty' : ''}`}
        aria-live="polite"
      >
        {valueCount === 0 ? (
          <span>No values added yet</span>
        ) : (
          values.map((value, index) => (
            <span key={`${value.name || value}-${index}`} className="attr-value-chip">
              {value.name || value}
              <button
                type="button"
                className="attr-value-chip-remove"
                onClick={() => onRemoveValue(index)}
                disabled={disabled}
                aria-label={`Remove ${value.name || value}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
