import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCompany, selectCompany, selectCompanyId } from '../../features/user/userSlice.js';
import {
  COMPANY_LOGO_FIELD,
  PRINTER_SETTING_DEFS,
  PRINTER_SETTING_SECTIONS,
  PRODUCT_SETTING_DEFS,
  buildPrinterSettingsPayload,
  buildProductSettingsPayload,
  defaultPrinterSettings,
  defaultProductSettings,
  extractPrinterSettingsFromCompanyBody,
  extractProductSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  mergePrinterSettings,
  mergeProductSettings,
  normalizeIncomingPrinterSettings,
  normalizeIncomingProductSettings,
  patchCompanyPrinterSettings,
  patchCompanyProductSettings,
  defaultDefaultPrinterSettings,
  extractDefaultPrinterSettingsFromCompanyBody,
  mergeDefaultPrinterSettings,
  buildDefaultPrinterSettingsPayload,
  validateDefaultPrinterSettingsPayload,
  patchCompanyDefaultPrinterSettings,
  pickCompanyLogoUrl,
  updateCompanyDetailsRequest,
} from '../../features/company/companyAPI.js';
import { isUserUploadFilePart } from '../../features/users/usersAPI.js';
import { showToast } from '../../utils/toast.js';
import DefaultPrinterSettingsForm from './DefaultPrinterSettingsForm.jsx';

function applyCompanyToForm(company, setters) {
  if (!company) return;
  const { setForm, setExistingLogoUrl, setLogoFile, setLogoPreview, logoInputRef } = setters;
  setForm({
    company_name: company.company_name || company.name || '',
    company_phone: company.company_phone || company.phone || '',
    company_email: company.company_email || company.email || '',
    company_address: company.company_address || company.address || '',
  });
  setExistingLogoUrl(pickCompanyLogoUrl(company));
  setLogoFile(null);
  setLogoPreview((prev) => {
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    return null;
  });
  if (logoInputRef.current) logoInputRef.current.value = '';
}

export default function CompanySettingsView() {
  const dispatch = useDispatch();
  const companyId = useSelector(selectCompanyId);
  const authCompany = useSelector(selectCompany);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [companySaving, setCompanySaving] = useState(false);
  const [companySaveError, setCompanySaveError] = useState('');
  const [form, setForm] = useState({
    company_name: '',
    company_phone: '',
    company_email: '',
    company_address: '',
  });
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState('');
  const logoInputRef = useRef(null);

  const [printerSettings, setPrinterSettings] = useState(() => defaultPrinterSettings());
  const [togglingPrinterKey, setTogglingPrinterKey] = useState('');
  const [printerSaveError, setPrinterSaveError] = useState('');

  const [productSettings, setProductSettings] = useState(() => defaultProductSettings());
  const [togglingProductKey, setTogglingProductKey] = useState('');
  const [productSaveError, setProductSaveError] = useState('');

  const [networkPrinterSettings, setNetworkPrinterSettings] = useState(() =>
    defaultDefaultPrinterSettings()
  );
  const [networkPrinterErrors, setNetworkPrinterErrors] = useState({});
  const [networkPrinterSaving, setNetworkPrinterSaving] = useState(false);
  const [networkPrinterSaveError, setNetworkPrinterSaveError] = useState('');

  const printerSettingByKey = useMemo(() => {
    const map = {};
    PRINTER_SETTING_DEFS.forEach((def) => {
      map[def.key] = def;
    });
    return map;
  }, []);

  const productSettingByKey = useMemo(() => {
    const map = {};
    PRODUCT_SETTING_DEFS.forEach((def) => {
      map[def.key] = def;
    });
    return map;
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const hydrateFromCompany = useCallback((company, body) => {
    applyCompanyToForm(company, {
      setForm,
      setExistingLogoUrl,
      setLogoFile,
      setLogoPreview,
      logoInputRef,
    });
    const parsed = extractPrinterSettingsFromCompanyBody(body ?? { data: company });
    setPrinterSettings(mergePrinterSettings(parsed));
    const productParsed = extractProductSettingsFromCompanyBody(body ?? { data: company });
    setProductSettings(mergeProductSettings(productParsed));
    const defaultPrinterParsed = extractDefaultPrinterSettingsFromCompanyBody(body ?? { data: company });
    setNetworkPrinterSettings(mergeDefaultPrinterSettings(defaultPrinterParsed));
  }, []);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setLoadError('Your account is not linked to a company.');
      if (authCompany) {
        hydrateFromCompany(authCompany, { data: authCompany });
      }
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) {
          if (authCompany) hydrateFromCompany(authCompany, { data: authCompany });
          return;
        }
        const merged = { ...(authCompany || {}), ...fetched };
        hydrateFromCompany(merged, { data: merged });
        dispatch(setCompany(merged));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err?.message || 'Failed to load company');
          if (authCompany) hydrateFromCompany(authCompany, { data: authCompany });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, hydrateFromCompany, dispatch]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, company_logo: 'Please choose an image file.' }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.company_logo;
      return next;
    });
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearLogoSelection = () => {
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const validateCompany = () => {
    const next = {};
    if (!form.company_name.trim()) next.company_name = 'Company name is required.';
    if (
      form.company_email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.company_email.trim())
    ) {
      next.company_email = 'Enter a valid email address.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setCompanySaveError('');
    if (!companyId) {
      setCompanySaveError('No company linked to your account.');
      return;
    }
    if (!validateCompany()) return;

    setCompanySaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        company_phone: form.company_phone.trim(),
        company_email: form.company_email.trim(),
        company_address: form.company_address.trim(),
      };
      if (isUserUploadFilePart(logoFile)) payload.company_logo = logoFile;

      const updated = await updateCompanyDetailsRequest(companyId, payload);
      const fromApi = getCompanyFromApiBody(updated) || updated;
      // Never spread the File upload into company state — String(File) becomes "[object File]".
      const { company_logo: _uploadedLogo, ...savedFields } = payload;
      const merged = { ...(authCompany || {}), ...(fromApi || {}), ...savedFields };
      if (isUserUploadFilePart(merged.company_logo)) delete merged.company_logo;
      dispatch(setCompany(merged));
      const nextLogoUrl = pickCompanyLogoUrl(merged);
      setExistingLogoUrl(nextLogoUrl);
      if (isUserUploadFilePart(logoFile)) {
        if (nextLogoUrl) {
          clearLogoSelection();
        } else {
          // Keep blob preview if API did not return a logo path yet.
          setLogoFile(null);
          if (logoInputRef.current) logoInputRef.current.value = '';
        }
      }
      showToast({ message: 'Company details saved.', variant: 'success' });
    } catch (err) {
      const message = err?.message || 'Failed to save company details';
      setCompanySaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setCompanySaving(false);
    }
  };

  const persistPrinterSettings = async (nextSettings) => {
    const payload = buildPrinterSettingsPayload(nextSettings);
    await patchCompanyPrinterSettings(companyId, payload);
    const merged = {
      ...(authCompany || {}),
      printer_settings: payload,
    };
    dispatch(setCompany(merged));
    setPrinterSettings(normalizeIncomingPrinterSettings(payload) || defaultPrinterSettings());
  };

  const handleTogglePrinterSetting = async (key) => {
    if (!companyId || togglingPrinterKey) return;

    const previous = printerSettings;
    const next = { ...previous, [key]: !previous[key] };
    setPrinterSettings(next);
    setPrinterSaveError('');
    setTogglingPrinterKey(key);

    try {
      await persistPrinterSettings(next);
    } catch (err) {
      setPrinterSettings(previous);
      const message = err?.message || 'Failed to update printer setting';
      setPrinterSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingPrinterKey('');
    }
  };

  const persistProductSettings = async (nextSettings) => {
    const payload = buildProductSettingsPayload(nextSettings);
    const updated = await patchCompanyProductSettings(companyId, payload);
    const fromApi = getCompanyFromApiBody(updated);
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      product_settings: fromApi?.product_settings ?? fromApi?.productSettings ?? payload,
    };
    dispatch(setCompany(merged));
    const parsed = extractProductSettingsFromCompanyBody({ data: merged });
    setProductSettings(mergeProductSettings(parsed));
  };

  const handleSaveDefaultPrinterSettings = async (e) => {
    e.preventDefault();
    if (!companyId || networkPrinterSaving) return;

    const validationErrors = validateDefaultPrinterSettingsPayload(networkPrinterSettings);
    if (Object.keys(validationErrors).length) {
      setNetworkPrinterErrors(validationErrors);
      return;
    }

    setNetworkPrinterSaving(true);
    setNetworkPrinterSaveError('');
    setNetworkPrinterErrors({});

    try {
      const payload = buildDefaultPrinterSettingsPayload(networkPrinterSettings);
      await patchCompanyDefaultPrinterSettings(companyId, payload);
      const merged = {
        ...(authCompany || {}),
        default_printer_settings: payload,
        defaultPrinterSettings: payload,
      };
      dispatch(setCompany(merged));
      setNetworkPrinterSettings(mergeDefaultPrinterSettings(payload));
      showToast({ message: 'Default printer settings saved.', variant: 'success' });
    } catch (err) {
      const message = err?.message || 'Failed to save default printer settings';
      setNetworkPrinterSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setNetworkPrinterSaving(false);
    }
  };

  const handleToggleProductSetting = async (key) => {
    if (!companyId || togglingProductKey) return;

    const previous = productSettings;
    const next = { ...previous, [key]: !previous[key] };
    setProductSettings(next);
    setProductSaveError('');
    setTogglingProductKey(key);

    try {
      await persistProductSettings(next);
    } catch (err) {
      setProductSettings(previous);
      const message = err?.message || 'Failed to update product setting';
      setProductSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingProductKey('');
    }
  };

  if (loading) {
    return (
      <div className="company-card">
        <div className="company-card-body text-center text-muted py-5">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <div>Loading company settings…</div>
        </div>
      </div>
    );
  }

  const logoSrc = logoPreview || existingLogoUrl;

  return (
    <>
      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-id-card" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Company details</h5>
            <p className="company-card-subtitle">
              Business profile fields saved on the company record.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          {loadError ? <div className="alert alert-warning py-2 text-sm">{loadError}</div> : null}

          <form onSubmit={handleCompanySubmit}>
            <div className="row g-4">
              {/* Logo */}
              <div className="col-lg-4">
                <div className="company-logo-panel">
                  <div className="company-logo-frame">
                    {logoSrc ? (
                      <img src={logoSrc} alt="Company logo" />
                    ) : (
                      <div className="company-logo-empty">
                        <i className="fas fa-image" aria-hidden="true" />
                        <span>No logo</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={logoInputRef}
                    id="company-logo"
                    type="file"
                    className="d-none"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={companySaving || !companyId}
                  />
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={companySaving || !companyId}
                    >
                      <i className="fas fa-upload me-1" aria-hidden="true" />
                      {logoSrc ? 'Change logo' : 'Upload logo'}
                    </button>
                    {logoPreview ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mb-0"
                        onClick={clearLogoSelection}
                        disabled={companySaving}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {errors.company_logo ? (
                    <div className="text-danger small mt-2">{errors.company_logo}</div>
                  ) : null}
                  <p className="company-logo-hint">
                    Saved to <code className="text-xs">{COMPANY_LOGO_FIELD}</code>. Shown on invoices
                    when “Show logo” is enabled in printer settings.
                  </p>
                </div>
              </div>

              {/* Fields */}
              <div className="col-lg-8">
                <div className="mb-3">
                  <label className="company-label d-block" htmlFor="company-name">
                    Company name <span className="req">*</span>
                  </label>
                  <input
                    id="company-name"
                    className={`form-control company-control ${errors.company_name ? 'is-invalid' : ''}`}
                    value={form.company_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                    disabled={companySaving || !companyId}
                  />
                  {errors.company_name ? (
                    <div className="invalid-feedback">{errors.company_name}</div>
                  ) : null}
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="company-label d-block" htmlFor="company-phone">
                      Phone
                    </label>
                    <input
                      id="company-phone"
                      type="tel"
                      className="form-control company-control"
                      value={form.company_phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, company_phone: e.target.value }))
                      }
                      disabled={companySaving || !companyId}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="company-label d-block" htmlFor="company-email">
                      Email
                    </label>
                    <input
                      id="company-email"
                      type="email"
                      className={`form-control company-control ${errors.company_email ? 'is-invalid' : ''}`}
                      value={form.company_email}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, company_email: e.target.value }))
                      }
                      disabled={companySaving || !companyId}
                    />
                    {errors.company_email ? (
                      <div className="invalid-feedback">{errors.company_email}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="company-label d-block" htmlFor="company-address">
                    Address
                  </label>
                  <textarea
                    id="company-address"
                    className="form-control company-control"
                    rows={3}
                    value={form.company_address}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, company_address: e.target.value }))
                    }
                    disabled={companySaving || !companyId}
                  />
                </div>
              </div>
            </div>

            {companySaveError ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{companySaveError}</div>
            ) : null}

            <div className="company-card-footer">
              <button
                type="submit"
                className="btn btn-primary mb-0"
                disabled={companySaving || !companyId}
              >
                {companySaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2" aria-hidden="true" />
                    Save company
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-print" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Printer settings</h5>
            <p className="company-card-subtitle">
              Toggle each option — changes save immediately to{' '}
              <code className="text-xs">printer_settings</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          {PRINTER_SETTING_SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <div className="settings-section-label">{section.title}</div>
              {section.keys.map((key) => {
                const { label, hint } = printerSettingByKey[key] || { label: key };
                const isOn = Boolean(printerSettings[key]);
                const busy = togglingPrinterKey === key;
                return (
                  <div className="settings-row" key={key}>
                    <div>
                      <div className="settings-row-label">{label}</div>
                      {hint ? <div className="settings-row-hint">{hint}</div> : null}
                    </div>
                    <div className="settings-row-control">
                      {busy ? (
                        <span
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        >
                          <span className="visually-hidden">Saving…</span>
                        </span>
                      ) : (
                        <span
                          className={`settings-state ${isOn ? 'text-success' : 'text-muted'}`}
                        >
                          {isOn ? 'On' : 'Off'}
                        </span>
                      )}
                      <label
                        className="form-check form-switch settings-switch"
                        htmlFor={`printer-setting-${key}`}
                        style={{
                          cursor: togglingPrinterKey || !companyId ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id={`printer-setting-${key}`}
                          checked={isOn}
                          onChange={() => handleTogglePrinterSetting(key)}
                          disabled={!!togglingPrinterKey || !companyId}
                          aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}

          {printerSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{printerSaveError}</div>
          ) : null}
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-network-wired" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Default printer settings</h5>
            <p className="company-card-subtitle">
              Default network printer for receipts — saved to{' '}
              <code className="text-xs">default_printer_settings</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          <form onSubmit={handleSaveDefaultPrinterSettings}>
            <DefaultPrinterSettingsForm
              form={networkPrinterSettings}
              onChange={setNetworkPrinterSettings}
              errors={networkPrinterErrors}
              disabled={networkPrinterSaving || !companyId}
            />

            {networkPrinterSaveError ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{networkPrinterSaveError}</div>
            ) : null}

            <div className="company-card-footer">
              <button
                type="submit"
                className="btn btn-primary mb-0"
                disabled={networkPrinterSaving || !companyId}
              >
                {networkPrinterSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2" aria-hidden="true" />
                    Save default printer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-box-open" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Product settings</h5>
            <p className="company-card-subtitle">
              POS product behavior — changes save immediately to{' '}
              <code className="text-xs">product_settings</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          {PRODUCT_SETTING_DEFS.map(({ key }) => {
            const { label, hint } = productSettingByKey[key] || { label: key };
            const isOn = Boolean(productSettings[key]);
            const busy = togglingProductKey === key;
            return (
              <div className="settings-row" key={key}>
                <div>
                  <div className="settings-row-label">{label}</div>
                  {hint ? <div className="settings-row-hint">{hint}</div> : null}
                </div>
                <div className="settings-row-control">
                  {busy ? (
                    <span
                      className="spinner-border spinner-border-sm text-primary"
                      role="status"
                      style={{ width: '1rem', height: '1rem' }}
                    >
                      <span className="visually-hidden">Saving…</span>
                    </span>
                  ) : (
                    <span className={`settings-state ${isOn ? 'text-success' : 'text-muted'}`}>
                      {isOn ? 'On' : 'Off'}
                    </span>
                  )}
                  <label
                    className="form-check form-switch settings-switch"
                    htmlFor={`product-setting-${key}`}
                    style={{
                      cursor: togglingProductKey || !companyId ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id={`product-setting-${key}`}
                      checked={isOn}
                      onChange={() => handleToggleProductSetting(key)}
                      disabled={!!togglingProductKey || !companyId}
                      aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {productSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{productSaveError}</div>
          ) : null}
        </div>
      </div>
    </>
  );
}
