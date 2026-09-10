import { useEffect, useRef, useState } from 'react';
import {
  FaAlignLeft,
  FaBoxOpen,
  FaCircleCheck,
  FaFont,
  FaImage,
  FaLink,
  FaToggleOn,
  FaTruck,
} from 'react-icons/fa6';
import AppModal from '../AppModal.jsx';
import {
  normalizeConnectionSyncSettings,
  updateConnectionSettingsRequest,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import { showToast } from '../../utils/toast.js';

export const CONNECTION_SYNC_SETTING_FIELDS = [
  {
    key: 'sync_product_name',
    label: 'Product name',
    hint: 'Keep the catalog title in sync',
    Icon: FaFont,
  },
  {
    key: 'sync_product_slug',
    label: 'Product slug',
    hint: 'Match the public URL slug',
    Icon: FaLink,
  },
  {
    key: 'sync_product_image',
    label: 'Product image',
    hint: 'Sync catalog photos',
    Icon: FaImage,
  },
  {
    key: 'sync_product_quantity',
    label: 'Product quantity',
    hint: 'Keep stock levels updated',
    Icon: FaBoxOpen,
  },
  {
    key: 'sync_product_description',
    label: 'Product description',
    hint: 'Sync product copy and details',
    Icon: FaAlignLeft,
  },
  {
    key: 'sync_product_status',
    label: 'Product status',
    hint: 'Sync active and inactive state',
    Icon: FaToggleOn,
  },
  {
    key: 'sync_order_to_vendor',
    label: 'Sync order to vendor',
    hint: 'Send customer orders to the vendor store',
    Icon: FaTruck,
  },
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
      const synced = { ...next, ...(result.settings || {}) };
      setSettings(synced);
      settingsRef.current = synced;
      onSaved?.(synced, result.connection);
      const field =
        CONNECTION_SYNC_SETTING_FIELDS.find((item) => item.key === key)?.label || 'Setting';
      showToast({
        message: `${field} sync ${nextValue === 'yes' ? 'enabled' : 'disabled'}.`,
        variant: 'success',
      });
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
      onClose={() => {
        if (!savingKey) onClose?.();
      }}
      title="Product settings"
      subtitle={`Choose which fields stay in sync with ${partnerName}. Changes save immediately.`}
      size="md"
      disableBackdropClose={Boolean(savingKey)}
    >
      <div className="bc-connection-settings">
        <div className="bc-connection-settings-note">
          <FaCircleCheck aria-hidden="true" />
          <span>Toggles apply to this connected store as soon as you switch them.</span>
        </div>
        <div className="bc-connection-settings-list">
          {CONNECTION_SYNC_SETTING_FIELDS.map(({ key, label, hint, Icon }) => {
            const checked = settings?.[key] === 'yes';
            const inputId = `bc-connection-setting-${key}`;
            const busy = savingKey === key;
            return (
              <div
                key={key}
                className={`bc-connection-setting-row${checked ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
              >
                <span className="bc-connection-setting-icon" aria-hidden="true">
                  <Icon />
                </span>
                <label className="bc-connection-setting-copy" htmlFor={inputId}>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </label>
                <span className={`bc-connection-setting-state${checked ? ' is-on' : ''}`}>
                  {busy ? 'Saving' : checked ? 'On' : 'Off'}
                </span>
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
      </div>
    </AppModal>
  );
}
