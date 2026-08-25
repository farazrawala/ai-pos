import { useState } from 'react';
import { useSelector } from 'react-redux';
import { FaEye, FaRotateLeft, FaFloppyDisk } from 'react-icons/fa6';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { PrintLayoutProvider, usePrintLayout } from '../../features/printLayout/PrintLayoutContext.jsx';
import { useHydrateCompanyFromDb } from '../../features/printLayout/useHydrateCompanyFromDb.js';
import { useCustomPrinterSettings } from '../../features/printLayout/useCustomPrinterSettings.js';
import {
  clearSavedLayoutSettings,
} from '../../features/printLayout/printLayoutStorage.js';
import { DOCUMENT_TYPES, PAPER_SIZE_OPTIONS } from '../../features/printLayout/printLayoutDefaults.js';
import A4Preview from '../../components/printLayout/A4Preview.jsx';
import SettingsPanel from '../../components/printLayout/SettingsPanel.jsx';
import AppModal from '../../components/AppModal.jsx';
import { toast } from '../../utils/toast.js';
import './print-layout-settings.css';

function PrintLayoutSettingsContent() {
  useRequireModuleAccess('printer-settings');
  const companyId = useSelector(selectCompanyId);
  const { settings, resetSettings } = usePrintLayout();
  const { rehydrateCompany } = useHydrateCompanyFromDb();
  const { saving, loading, saveToCompany, switchDocumentType, switchPaperSize } =
    useCustomPrinterSettings();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Your account is not linked to a company.');
      return;
    }
    try {
      await saveToCompany();
      toast.success('Layout saved to company (all paper sizes & document types).');
    } catch (err) {
      toast.error(err?.message || 'Failed to save layout settings.');
    }
  };

  const handleReset = () => {
    clearSavedLayoutSettings(companyId);
    resetSettings();
    rehydrateCompany();
    toast.info('Layout reset to defaults. Company details reloaded from your account.');
  };

  return (
    <div className="pl-layout-page">
      <div className="pl-layout-header">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h1 className="pl-layout-header__title">Print Layout Settings</h1>
            <p className="pl-layout-header__subtitle">
              Customize how your POS documents appear when printed on any paper size
            </p>
            {loading ? (
              <p className="text-muted text-sm mb-0">Loading saved layout from company…</p>
            ) : null}
          </div>
          <div className="pl-layout-header__actions">
            <select
              className="form-select form-select-sm pl-layout-header__paper-select"
              value={settings.page.paperSize}
              onChange={(e) => switchPaperSize(e.target.value)}
              aria-label="Paper size"
              disabled={saving}
            >
              {PAPER_SIZE_OPTIONS.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.value === 'custom'
                    ? 'Custom size'
                    : `${size.label} — ${size.description}`}
                </option>
              ))}
            </select>
            <select
              className="form-select form-select-sm pl-layout-header__doc-select"
              value={settings.documentType}
              onChange={(e) => switchDocumentType(e.target.value)}
              aria-label="Document type"
              disabled={saving}
            >
              {DOCUMENT_TYPES.map((doc) => (
                <option key={doc.value} value={doc.value}>
                  {doc.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPreviewOpen(true)}>
              <FaEye className="me-1" />
              Preview
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleReset} disabled={saving}>
              <FaRotateLeft className="me-1" />
              Reset
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSave}
              disabled={saving || !companyId}
            >
              <FaFloppyDisk className="me-1" />
              {saving ? 'Saving…' : 'Save Layout'}
            </button>
          </div>
        </div>
      </div>

      <div className="pl-layout-body">
        <A4Preview />
        <SettingsPanel />
      </div>

      <AppModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Document Preview"
        size="xl"
      >
        <div className="pl-preview-modal">
          <A4Preview />
        </div>
      </AppModal>
    </div>
  );
}

export default function PrintLayoutSettingsPage() {
  const companyId = useSelector(selectCompanyId);

  return (
    <PrintLayoutProvider companyId={companyId}>
      <PrintLayoutSettingsContent />
    </PrintLayoutProvider>
  );
}
