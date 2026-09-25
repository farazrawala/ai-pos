import { useRef } from 'react';
import { FaFileExport, FaFileImport } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';
import './line-items-csv-buttons.css';

/** Export / Import CSV buttons for a line-items toolbar. */
const LineItemsCsvButtons = ({ onExport, onImport, busy = false, exportDisabled, importDisabled }) => {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary mb-0 line-items-csv-btn"
        onClick={onExport}
        disabled={busy || exportDisabled}
        title="Download line items as CSV (product_id, barcode, qty, rate)"
      >
        <NavIcon icon={FaFileExport} className="me-1" size={11} />
        Export CSV
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary mb-0 line-items-csv-btn"
        onClick={() => inputRef.current?.click()}
        disabled={busy || importDisabled}
        title="Add or update line items from a CSV with product_id or barcode, qty, rate"
      >
        <NavIcon icon={FaFileImport} className="me-1" size={11} />
        {busy ? 'Working…' : 'Import CSV'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onImport(file);
        }}
      />
    </>
  );
};

export default LineItemsCsvButtons;
