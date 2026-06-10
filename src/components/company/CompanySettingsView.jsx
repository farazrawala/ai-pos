import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCompany, selectCompany, selectCompanyId } from '../../features/user/userSlice.js';
import {
  COMPANY_LOGO_FIELD,
  PRINTER_SETTING_DEFS,
  PRINTER_SETTING_SECTIONS,
  buildPrinterSettingsPayload,
  defaultPrinterSettings,
  extractPrinterSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  mergePrinterSettings,
  normalizeIncomingPrinterSettings,
  patchCompanyPrinterSettings,
  pickCompanyLogoUrl,
  updateCompanyDetailsRequest,
} from '../../features/company/companyAPI.js';
import { isUserUploadFilePart } from '../../features/users/usersAPI.js';
import { showToast } from '../../utils/toast.js';

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

  const printerSettingByKey = useMemo(() => {
    const map = {};
    PRINTER_SETTING_DEFS.forEach((def) => {
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
    if (form.company_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.company_email.trim())) {
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
      const merged = { ...(authCompany || {}), ...(fromApi || {}), ...payload };
      dispatch(setCompany(merged));
      setExistingLogoUrl(pickCompanyLogoUrl(merged));
      if (isUserUploadFilePart(logoFile)) clearLogoSelection();
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

  if (loading) {
    return (
      <div className="card shadow-sm" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card-body text-center p-4">Loading company settings…</div>
      </div>
    );
  }

  return (
    <>
      <div className="card shadow-sm" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card-header pb-3">
          <h5 className="mb-1">Company details</h5>
          <p className="text-sm text-muted mb-0">
            Business profile fields saved on the company record.
          </p>
        </div>
        <div className="card-body pt-0">
          {loadError ? <div className="alert alert-warning py-2 text-sm">{loadError}</div> : null}

          <form onSubmit={handleCompanySubmit}>
            <div className="mb-4">
              <label className="form-label d-block text-center" htmlFor="company-logo">
                Logo image <span className="text-muted">({COMPANY_LOGO_FIELD})</span>
              </label>
              <div className="text-center">
                {logoPreview || existingLogoUrl ? (
                  <img
                    src={logoPreview || existingLogoUrl}
                    alt="Company logo"
                    className="border rounded mb-2 bg-white"
                    style={{ width: '112px', height: '112px', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded border bg-light text-muted mb-2"
                    style={{ width: '112px', height: '112px' }}
                  >
                    No logo
                  </div>
                )}
              </div>
              <div className="mx-auto" style={{ maxWidth: '360px' }}>
                <input
                  ref={logoInputRef}
                  id="company-logo"
                  type="file"
                  className={`form-control form-control-sm ${errors.company_logo ? 'is-invalid' : ''}`}
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={companySaving || !companyId}
                />
                <small className="text-muted d-block mt-1">
                  Upload image for <code className="text-xs">{COMPANY_LOGO_FIELD}</code>. Used on
                  invoices when &quot;Show logo&quot; is enabled in printer settings.
                </small>
                {errors.company_logo ? (
                  <div className="invalid-feedback d-block">{errors.company_logo}</div>
                ) : null}
                {logoPreview ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary mt-2"
                    onClick={clearLogoSelection}
                    disabled={companySaving}
                  >
                    Remove new logo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="company-name">
                Company name <span className="text-danger">*</span>
              </label>
              <input
                id="company-name"
                className={`form-control ${errors.company_name ? 'is-invalid' : ''}`}
                value={form.company_name}
                onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                disabled={companySaving || !companyId}
              />
              {errors.company_name ? (
                <div className="invalid-feedback">{errors.company_name}</div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="company-phone">
                Phone
              </label>
              <input
                id="company-phone"
                type="tel"
                className="form-control"
                value={form.company_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, company_phone: e.target.value }))}
                disabled={companySaving || !companyId}
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="company-email">
                Email
              </label>
              <input
                id="company-email"
                type="email"
                className={`form-control ${errors.company_email ? 'is-invalid' : ''}`}
                value={form.company_email}
                onChange={(e) => setForm((prev) => ({ ...prev, company_email: e.target.value }))}
                disabled={companySaving || !companyId}
              />
              {errors.company_email ? (
                <div className="invalid-feedback">{errors.company_email}</div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="company-address">
                Address
              </label>
              <textarea
                id="company-address"
                className="form-control"
                rows={3}
                value={form.company_address}
                onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))}
                disabled={companySaving || !companyId}
              />
            </div>

            {companySaveError ? (
              <div className="alert alert-danger py-2">{companySaveError}</div>
            ) : null}

            <div className="d-flex justify-content-end">
              <button type="submit" className="btn btn-primary" disabled={companySaving || !companyId}>
                {companySaving ? 'Saving…' : 'Save company'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm mt-4 mb-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card-header pb-3">
          <h5 className="mb-1">Printer settings</h5>
          <p className="text-sm text-muted mb-0">
            Toggle each option on or off — changes save immediately to{' '}
            <code className="text-xs">printer_settings</code>.
          </p>
        </div>
        <div className="card-body pt-0">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder">
                      Option
                    </th>
                    <th
                      className="text-uppercase text-secondary text-xxs font-weight-bolder text-end"
                      style={{ width: '180px' }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRINTER_SETTING_SECTIONS.map((section) => (
                    <Fragment key={section.title}>
                      <tr className="table-light">
                        <td colSpan={2} className="text-xs text-uppercase text-secondary fw-bold py-2">
                          {section.title}
                        </td>
                      </tr>
                      {section.keys.map((key) => {
                        const { label, hint } = printerSettingByKey[key] || { label: key };
                        const isOn = Boolean(printerSettings[key]);
                        return (
                          <tr key={key}>
                            <td className="text-sm">
                              <div className="fw-semibold">{label}</div>
                              {hint ? <small className="text-muted">{hint}</small> : null}
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex align-items-center justify-content-end gap-2">
                                <label
                                  className="form-check form-switch mb-0"
                                  htmlFor={`printer-setting-${key}`}
                                  style={{
                                    cursor:
                                      togglingPrinterKey || !companyId
                                        ? 'not-allowed'
                                        : 'pointer',
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
                                {togglingPrinterKey === key ? (
                                  <span
                                    className="spinner-border spinner-border-sm text-primary"
                                    role="status"
                                    style={{ width: '1rem', height: '1rem' }}
                                  >
                                    <span className="visually-hidden">Saving…</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`badge ${isOn ? 'bg-success' : 'bg-secondary'}`}
                                  >
                                    {isOn ? 'On' : 'Off'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {printerSaveError ? (
              <div className="alert alert-danger py-2 mt-3">{printerSaveError}</div>
            ) : null}
        </div>
      </div>
    </>
  );
}
