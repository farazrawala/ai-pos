import { useEffect, useRef, useState } from 'react';
import AppModal from '../AppModal.jsx';
import {
  normalizeConnectionSyncSettings,
  updateConnectionSettingsRequest,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import { showToast } from '../../utils/toast.js';

export const CONNECTION_SYNC_SETTING_FIELDS = [
  { key: 'sync_product_name', label: 'Sync product name' },
  { key: 'sync_product_slug', label: 'Sync product slug' },
  { key: 'sync_product_image', label: 'Sync product image' },
  { key: 'sync_product_quantity', label: 'Sync product quantity' },
  { key: 'sync_product_description', label: 'Sync product description' },
  { key: 'sync_product_status', label: 'Sync product status' },
];

export default function ConnectedStoreSettingsModal({
  open,
  onClose,
  connection,
  partnerName = 'store',
  onSaved,
}) {
  const [settings, setSettings] = useState(() => normalizeConnectionSyncSettings(connection));
  const [savingKey, setSavingKey] = useState('');
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const next = normalizeConnectionSyncSettings(connection);
    setSettings(next);
    settingsRef.current = next;
    setSavingKey('');
  }, [open, connection]);

  const handleToggle = async (key, checked) => {
    const id = String(connection?._id || connection?.id || '').trim();
    if (!id || savingKey) return;

    const previous = settingsRef.current;
    const nextValue = checked ? 'yes' : 'no';
    const next = { ...previous, [key]: nextValue };
    setSettings(next);
    settingsRef.current = next;
    setSavingKey(key);

    try {
      const result = await updateConnectionSettingsRequest(id, { [key]: nextValue });
      const synced = result.settings || next;
      setSettings(synced);
      settingsRef.current = synced;
      onSaved?.(synced, result.connection);
    } catch (err) {
      setSettings(previous);
      settingsRef.current = previous;
      showToast({
        message: err?.message || 'Failed to update connection settings',
        variant: 'error',
      });
    } finally {
      setSavingKey('');
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Connected store settings"
      subtitle={`Choose which product fields to sync with ${partnerName}.`}
      size="md"
      disableBackdropClose={Boolean(savingKey)}
    >
      <div className="bc-connection-settings-grid">
        {CONNECTION_SYNC_SETTING_FIELDS.map(({ key, label }) => {
          const checked = settings?.[key] === 'yes';
          const inputId = `bc-connection-setting-${key}`;
          const busy = savingKey === key;
          return (
            <div key={key} className="bc-connection-setting-card">
              <label className="bc-connection-setting-label" htmlFor={inputId}>
                {label}
              </label>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input bc-connection-setting-switch"
                  type="checkbox"
                  role="switch"
                  id={inputId}
                  checked={checked}
                  onChange={(e) => handleToggle(key, e.target.checked)}
                  disabled={Boolean(savingKey)}
                  aria-busy={busy}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AppModal>
  );
}
