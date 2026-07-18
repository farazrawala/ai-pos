import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCompany, selectCompany, selectCompanyId } from '../../features/user/userSlice.js';
import {
  COMPANY_LOGO_FIELD,
  BIGCOMMERCE_SETTINGS_FIELD,
  BIGCOMMERCE_SETTING_DEFS,
  DISPLAY_STORE_ON_BIGCOMMERCE_META,
  PRINTER_SETTING_DEFS,
  PRINTER_SETTING_SECTIONS,
  PRODUCT_SETTING_DEFS,
  LOCAL_SMS_SETTING_DEFS,
  LOCAL_WHATSAPP_SETTING_DEFS,
  API_SMS_SETTING_DEFS,
  EMAIL_ALERT_SETTING_DEFS,
  DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
  buildPrinterSettingsPayload,
  buildProductSettingsPayload,
  buildBigCommerceSettingsPayload,
  buildLocalSmsSettingsPayload,
  buildLocalWhatsappSettingsPayload,
  buildApiSmsSettingsPayload,
  buildEmailAlertsSettingsPayload,
  defaultPrinterSettings,
  defaultProductSettings,
  defaultBigCommerceSettings,
  defaultLocalSmsSettings,
  defaultLocalWhatsappSettings,
  defaultApiSmsSettings,
  defaultEmailAlertsSettings,
  extractPrinterSettingsFromCompanyBody,
  extractProductSettingsFromCompanyBody,
  extractBigCommerceSettingsFromCompanyBody,
  extractLocalSmsSettingsFromCompanyBody,
  extractLocalWhatsappSettingsFromCompanyBody,
  extractApiSmsSettingsFromCompanyBody,
  extractEmailAlertsSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  mergePrinterSettings,
  mergeProductSettings,
  mergeBigCommerceSettings,
  mergeLocalSmsSettings,
  mergeLocalWhatsappSettings,
  mergeApiSmsSettings,
  mergeEmailAlertsSettings,
  normalizeIncomingPrinterSettings,
  normalizeIncomingProductSettings,
  patchCompanyPrinterSettings,
  patchCompanyProductSettings,
  patchCompanyBigCommerceSettings,
  patchCompanyDisplayStoreOnBigcommerce,
  patchCompanyLocalSmsSettings,
  patchCompanyLocalWhatsappSettings,
  patchCompanyApiSmsSettings,
  patchCompanyEmailAlertsSettings,
  pickCompanyLogoUrl,
  pickDisplayStoreOnBigcommerce,
  pickBigCommerceLogoUrl,
  pickBigCommerceBannerUrl,
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

  const [productSettings, setProductSettings] = useState(() => defaultProductSettings());
  const [togglingProductKey, setTogglingProductKey] = useState('');
  const [productSaveError, setProductSaveError] = useState('');

  const [bigCommerceSettings, setBigCommerceSettings] = useState(() => defaultBigCommerceSettings());
  const [displayStoreOnBigcommerce, setDisplayStoreOnBigcommerce] = useState(
    DISPLAY_STORE_ON_BIGCOMMERCE_META.defaultValue
  );
  const [togglingBigCommerceKey, setTogglingBigCommerceKey] = useState('');
  const [togglingDisplayStore, setTogglingDisplayStore] = useState(false);
  const [bigCommerceSaveError, setBigCommerceSaveError] = useState('');
  const [bigCommerceSaving, setBigCommerceSaving] = useState(false);
  const [bcLogoFile, setBcLogoFile] = useState(null);
  const [bcLogoPreview, setBcLogoPreview] = useState(null);
  const [existingBcLogoUrl, setExistingBcLogoUrl] = useState('');
  const bcLogoInputRef = useRef(null);
  const [bcBannerFile, setBcBannerFile] = useState(null);
  const [bcBannerPreview, setBcBannerPreview] = useState(null);
  const [existingBcBannerUrl, setExistingBcBannerUrl] = useState('');
  const bcBannerInputRef = useRef(null);

  const [smsSettings, setSmsSettings] = useState(() => defaultLocalSmsSettings());
  const [togglingSmsKey, setTogglingSmsKey] = useState('');
  const [smsAmountSaving, setSmsAmountSaving] = useState(false);
  const [smsSaveError, setSmsSaveError] = useState('');

  const [whatsappSettings, setWhatsappSettings] = useState(() => defaultLocalWhatsappSettings());
  const [togglingWhatsappKey, setTogglingWhatsappKey] = useState('');
  const [whatsappAmountSaving, setWhatsappAmountSaving] = useState(false);
  const [whatsappSaveError, setWhatsappSaveError] = useState('');

  const [apiSmsSettings, setApiSmsSettings] = useState(() => defaultApiSmsSettings());
  const [togglingApiSmsKey, setTogglingApiSmsKey] = useState('');
  const [apiSmsFieldSaving, setApiSmsFieldSaving] = useState(false);
  const [apiSmsSaveError, setApiSmsSaveError] = useState('');

  const [emailAlertsSettings, setEmailAlertsSettings] = useState(() =>
    defaultEmailAlertsSettings()
  );
  const [togglingEmailAlertsKey, setTogglingEmailAlertsKey] = useState('');
  const [emailAlertsFieldSaving, setEmailAlertsFieldSaving] = useState(false);
  const [emailAlertsSaveError, setEmailAlertsSaveError] = useState('');

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

  const bigCommerceSettingByKey = useMemo(() => {
    const map = {};
    BIGCOMMERCE_SETTING_DEFS.forEach((def) => {
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

  useEffect(() => {
    return () => {
      if (bcLogoPreview && bcLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bcLogoPreview);
      }
    };
  }, [bcLogoPreview]);

  useEffect(() => {
    return () => {
      if (bcBannerPreview && bcBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bcBannerPreview);
      }
    };
  }, [bcBannerPreview]);

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
    const bigCommerceParsed = extractBigCommerceSettingsFromCompanyBody(body ?? { data: company });
    const bcSettings = mergeBigCommerceSettings(bigCommerceParsed);
    setBigCommerceSettings(bcSettings);
    setDisplayStoreOnBigcommerce(pickDisplayStoreOnBigcommerce(company));
    setExistingBcLogoUrl(pickBigCommerceLogoUrl(company));
    setBcLogoFile(null);
    setBcLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (bcLogoInputRef.current) bcLogoInputRef.current.value = '';
    setExistingBcBannerUrl(pickBigCommerceBannerUrl(company));
    setBcBannerFile(null);
    setBcBannerPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (bcBannerInputRef.current) bcBannerInputRef.current.value = '';
    const smsParsed = extractLocalSmsSettingsFromCompanyBody(body ?? { data: company });
    setSmsSettings(mergeLocalSmsSettings(smsParsed));
    const whatsappParsed = extractLocalWhatsappSettingsFromCompanyBody(body ?? { data: company });
    setWhatsappSettings(mergeLocalWhatsappSettings(whatsappParsed));
    const apiSmsParsed = extractApiSmsSettingsFromCompanyBody(body ?? { data: company });
    setApiSmsSettings(mergeApiSmsSettings(apiSmsParsed));
    const emailAlertsParsed = extractEmailAlertsSettingsFromCompanyBody(body ?? { data: company });
    setEmailAlertsSettings(mergeEmailAlertsSettings(emailAlertsParsed));
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
        display_store_on_bigcommerce: Boolean(displayStoreOnBigcommerce),
      };
      if (isUserUploadFilePart(logoFile)) payload.company_logo = logoFile;

      const updated = await updateCompanyDetailsRequest(companyId, payload);
      const fromApi = getCompanyFromApiBody(updated) || updated;
      // Never spread the File upload into company state — String(File) becomes "[object File]".
      const { company_logo: _uploadedLogo, ...savedFields } = payload;
      const merged = { ...(authCompany || {}), ...(fromApi || {}), ...savedFields };
      if (isUserUploadFilePart(merged.company_logo)) delete merged.company_logo;
      dispatch(setCompany(merged));
      setDisplayStoreOnBigcommerce(pickDisplayStoreOnBigcommerce(merged));
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

  const applyBigCommerceCompanyUpdate = (updated, settingsPayload) => {
    const fromApi = getCompanyFromApiBody(updated) || (updated && !updated.company ? updated : null);
    const payloadObject =
      settingsPayload && typeof settingsPayload === 'object' ? settingsPayload : null;
    const settingsForStore = payloadObject
      ? JSON.stringify(payloadObject)
      : typeof settingsPayload === 'string'
        ? settingsPayload
        : '{}';
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      bigcommerce_settings:
        fromApi?.bigcommerce_settings ?? fromApi?.bigcommerceSettings ?? settingsForStore,
    };
    dispatch(setCompany(merged));
    const parsed = extractBigCommerceSettingsFromCompanyBody({ data: merged });
    const nextSettings = mergeBigCommerceSettings({
      ...(parsed || {}),
      ...(payloadObject || {}),
    });
    setBigCommerceSettings(nextSettings);
    setExistingBcLogoUrl(pickBigCommerceLogoUrl({ bigcommerce_settings: nextSettings }) || '');
    setExistingBcBannerUrl(pickBigCommerceBannerUrl({ bigcommerce_settings: nextSettings }) || '');
    return merged;
  };

  const persistBigCommerceSettings = async (nextSettings, files = {}) => {
    const payload = buildBigCommerceSettingsPayload({
      ...nextSettings,
      logo:
        nextSettings.logo ||
        (existingBcLogoUrl && !existingBcLogoUrl.startsWith('blob:') ? existingBcLogoUrl : '') ||
        '',
      banner:
        nextSettings.banner ||
        (existingBcBannerUrl && !existingBcBannerUrl.startsWith('blob:')
          ? existingBcBannerUrl
          : '') ||
        '',
    });
    const { company, settings } = await patchCompanyBigCommerceSettings(companyId, payload, files);
    return applyBigCommerceCompanyUpdate(company, settings);
  };

  const handleToggleDisplayStoreOnBigcommerce = async () => {
    if (!companyId || togglingDisplayStore || companySaving) return;

    const previous = displayStoreOnBigcommerce;
    const next = !previous;
    setDisplayStoreOnBigcommerce(next);
    setCompanySaveError('');
    setTogglingDisplayStore(true);

    try {
      const updated = await patchCompanyDisplayStoreOnBigcommerce(companyId, next);
      const fromApi =
        getCompanyFromApiBody(updated) || (updated && !updated.company ? updated : null);
      const merged = {
        ...(authCompany || {}),
        ...(fromApi || {}),
        display_store_on_bigcommerce:
          fromApi?.display_store_on_bigcommerce ??
          fromApi?.displayStoreOnBigcommerce ??
          next,
      };
      dispatch(setCompany(merged));
      setDisplayStoreOnBigcommerce(pickDisplayStoreOnBigcommerce(merged));
      showToast({
        message: next
          ? 'Store will appear on Big Commerce listing.'
          : 'Store hidden from Big Commerce listing.',
        variant: 'success',
      });
    } catch (err) {
      setDisplayStoreOnBigcommerce(previous);
      const message = err?.message || 'Failed to update Display Store on BigCommerce';
      setCompanySaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingDisplayStore(false);
    }
  };

  const handleToggleBigCommerceSetting = async (key) => {
    if (!companyId || togglingBigCommerceKey || bigCommerceSaving) return;

    const previous = bigCommerceSettings;
    const next = { ...previous, [key]: !previous[key] };
    setBigCommerceSettings(next);
    setBigCommerceSaveError('');
    setTogglingBigCommerceKey(key);

    try {
      await persistBigCommerceSettings(next);
    } catch (err) {
      setBigCommerceSettings(previous);
      const message = err?.message || 'Failed to update Big Commerce setting';
      setBigCommerceSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingBigCommerceKey('');
    }
  };

  const handleBcLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setBigCommerceSaveError('Please choose an image file for the logo.');
      return;
    }
    setBigCommerceSaveError('');
    setBcLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setBcLogoFile(file);
  };

  const handleBcBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setBigCommerceSaveError('Please choose an image file for the banner.');
      return;
    }
    setBigCommerceSaveError('');
    setBcBannerPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setBcBannerFile(file);
  };

  const clearBcLogoSelection = () => {
    setBcLogoFile(null);
    setBcLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (bcLogoInputRef.current) bcLogoInputRef.current.value = '';
  };

  const clearBcBannerSelection = () => {
    setBcBannerFile(null);
    setBcBannerPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (bcBannerInputRef.current) bcBannerInputRef.current.value = '';
  };

  const handleSaveBigCommerceMedia = async () => {
    if (!companyId || bigCommerceSaving) return;
    if (!isUserUploadFilePart(bcLogoFile) && !isUserUploadFilePart(bcBannerFile)) {
      setBigCommerceSaveError('Choose a logo or banner image to upload.');
      return;
    }

    setBigCommerceSaving(true);
    setBigCommerceSaveError('');
    try {
      await persistBigCommerceSettings(bigCommerceSettings, {
        logo: bcLogoFile,
        banner: bcBannerFile,
      });
      if (isUserUploadFilePart(bcLogoFile)) clearBcLogoSelection();
      if (isUserUploadFilePart(bcBannerFile)) clearBcBannerSelection();
      showToast({ message: 'Big Commerce images saved.', variant: 'success' });
    } catch (err) {
      const message = err?.message || 'Failed to save Big Commerce images';
      setBigCommerceSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setBigCommerceSaving(false);
    }
  };

  const persistSmsSettings = async (nextSettings) => {
    const payload = buildLocalSmsSettingsPayload(nextSettings);
    const updated = await patchCompanyLocalSmsSettings(companyId, payload);
    const fromApi = getCompanyFromApiBody(updated);
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      local_sms: fromApi?.local_sms ?? fromApi?.localSms ?? payload,
    };
    dispatch(setCompany(merged));
    const parsed = extractLocalSmsSettingsFromCompanyBody({ data: merged });
    setSmsSettings(mergeLocalSmsSettings(parsed));
  };

  const handleToggleSmsSetting = async (key) => {
    if (!companyId || togglingSmsKey || smsAmountSaving) return;

    const previous = smsSettings;
    const next = { ...previous, [key]: !previous[key] };
    if (
      key === 'send_sms_on_order' &&
      next.send_sms_on_order &&
      !String(next.send_sms_on_order_message || '').trim()
    ) {
      next.send_sms_on_order_message = DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE;
    }
    setSmsSettings(next);
    setSmsSaveError('');
    setTogglingSmsKey(key);

    try {
      await persistSmsSettings(next);
    } catch (err) {
      setSmsSettings(previous);
      const message = err?.message || 'Failed to update SMS setting';
      setSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingSmsKey('');
    }
  };

  const handleSmsAmountChange = (value) => {
    const amount = value === '' ? '' : Math.max(0, Number(value));
    setSmsSettings((prev) => ({
      ...prev,
      send_sms_greater_than_amount: amount === '' || Number.isNaN(amount) ? '' : amount,
    }));
  };

  const handleSmsAmountBlur = async () => {
    if (!companyId || togglingSmsKey || smsAmountSaving) return;

    const previous = mergeLocalSmsSettings(smsSettings);
    const next = {
      ...smsSettings,
      send_sms_greater_than_amount: Math.max(
        0,
        Number(smsSettings.send_sms_greater_than_amount) || 0
      ),
    };
    setSmsSettings(next);
    setSmsSaveError('');
    setSmsAmountSaving(true);

    try {
      await persistSmsSettings(next);
    } catch (err) {
      setSmsSettings(previous);
      const message = err?.message || 'Failed to update SMS amount';
      setSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setSmsAmountSaving(false);
    }
  };

  const handleSmsTemplateChange = (value) => {
    setSmsSettings((prev) => ({
      ...prev,
      send_sms_on_order_message: value,
    }));
  };

  const handleSmsTemplateBlur = async () => {
    if (!companyId || togglingSmsKey || smsAmountSaving) return;

    const previous = mergeLocalSmsSettings(smsSettings);
    const next = {
      ...smsSettings,
      send_sms_on_order_message:
        String(smsSettings.send_sms_on_order_message || '').trim() ||
        DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    };
    setSmsSettings(next);
    setSmsSaveError('');
    setSmsAmountSaving(true);

    try {
      await persistSmsSettings(next);
    } catch (err) {
      setSmsSettings(previous);
      const message = err?.message || 'Failed to update SMS message';
      setSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setSmsAmountSaving(false);
    }
  };

  const persistWhatsappSettings = async (nextSettings) => {
    const payload = buildLocalWhatsappSettingsPayload(nextSettings);
    const updated = await patchCompanyLocalWhatsappSettings(companyId, payload);
    const fromApi = getCompanyFromApiBody(updated);
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      whatsapp_local_settings:
        fromApi?.whatsapp_local_settings ?? fromApi?.whatsappLocalSettings ?? payload,
    };
    dispatch(setCompany(merged));
    const parsed = extractLocalWhatsappSettingsFromCompanyBody({ data: merged });
    setWhatsappSettings(mergeLocalWhatsappSettings(parsed));
  };

  const handleToggleWhatsappSetting = async (key) => {
    if (!companyId || togglingWhatsappKey || whatsappAmountSaving) return;

    const previous = whatsappSettings;
    const next = { ...previous, [key]: !previous[key] };
    if (
      key === 'send_whatsapp_on_order' &&
      next.send_whatsapp_on_order &&
      !String(next.send_whatsapp_on_order_message || '').trim()
    ) {
      next.send_whatsapp_on_order_message = DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE;
    }
    setWhatsappSettings(next);
    setWhatsappSaveError('');
    setTogglingWhatsappKey(key);

    try {
      await persistWhatsappSettings(next);
    } catch (err) {
      setWhatsappSettings(previous);
      const message = err?.message || 'Failed to update WhatsApp setting';
      setWhatsappSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingWhatsappKey('');
    }
  };

  const handleWhatsappAmountChange = (value) => {
    const amount = value === '' ? '' : Math.max(0, Number(value));
    setWhatsappSettings((prev) => ({
      ...prev,
      send_whatsapp_greater_than_amount: amount === '' || Number.isNaN(amount) ? '' : amount,
    }));
  };

  const handleWhatsappAmountBlur = async () => {
    if (!companyId || togglingWhatsappKey || whatsappAmountSaving) return;

    const previous = mergeLocalWhatsappSettings(whatsappSettings);
    const next = {
      ...whatsappSettings,
      send_whatsapp_greater_than_amount: Math.max(
        0,
        Number(whatsappSettings.send_whatsapp_greater_than_amount) || 0
      ),
    };
    setWhatsappSettings(next);
    setWhatsappSaveError('');
    setWhatsappAmountSaving(true);

    try {
      await persistWhatsappSettings(next);
    } catch (err) {
      setWhatsappSettings(previous);
      const message = err?.message || 'Failed to update WhatsApp amount';
      setWhatsappSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setWhatsappAmountSaving(false);
    }
  };

  const handleWhatsappTemplateChange = (value) => {
    setWhatsappSettings((prev) => ({
      ...prev,
      send_whatsapp_on_order_message: value,
    }));
  };

  const handleWhatsappTemplateBlur = async () => {
    if (!companyId || togglingWhatsappKey || whatsappAmountSaving) return;

    const previous = mergeLocalWhatsappSettings(whatsappSettings);
    const next = {
      ...whatsappSettings,
      send_whatsapp_on_order_message:
        String(whatsappSettings.send_whatsapp_on_order_message || '').trim() ||
        DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    };
    setWhatsappSettings(next);
    setWhatsappSaveError('');
    setWhatsappAmountSaving(true);

    try {
      await persistWhatsappSettings(next);
    } catch (err) {
      setWhatsappSettings(previous);
      const message = err?.message || 'Failed to update WhatsApp message';
      setWhatsappSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setWhatsappAmountSaving(false);
    }
  };

  const persistApiSmsSettings = async (nextSettings) => {
    const payload = buildApiSmsSettingsPayload(nextSettings);
    const updated = await patchCompanyApiSmsSettings(companyId, payload);
    const fromApi = getCompanyFromApiBody(updated);
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      api_sms: fromApi?.api_sms ?? fromApi?.apiSms ?? payload,
    };
    dispatch(setCompany(merged));
    const parsed = extractApiSmsSettingsFromCompanyBody({ data: merged });
    setApiSmsSettings(mergeApiSmsSettings(parsed));
  };

  const handleToggleApiSmsSetting = async (key) => {
    if (!companyId || togglingApiSmsKey || apiSmsFieldSaving) return;

    const previous = apiSmsSettings;
    const next = { ...previous, [key]: !previous[key] };
    if (
      key === 'send_sms_on_order' &&
      next.send_sms_on_order &&
      !String(next.send_sms_on_order_message || '').trim()
    ) {
      next.send_sms_on_order_message = DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE;
    }
    setApiSmsSettings(next);
    setApiSmsSaveError('');
    setTogglingApiSmsKey(key);

    try {
      await persistApiSmsSettings(next);
    } catch (err) {
      setApiSmsSettings(previous);
      const message = err?.message || 'Failed to update API SMS setting';
      setApiSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingApiSmsKey('');
    }
  };

  const handleApiSmsAmountChange = (value) => {
    const amount = value === '' ? '' : Math.max(0, Number(value));
    setApiSmsSettings((prev) => ({
      ...prev,
      send_sms_greater_than_amount: amount === '' || Number.isNaN(amount) ? '' : amount,
    }));
  };

  const handleApiSmsAmountBlur = async () => {
    if (!companyId || togglingApiSmsKey || apiSmsFieldSaving) return;

    const previous = mergeApiSmsSettings(apiSmsSettings);
    const next = {
      ...apiSmsSettings,
      send_sms_greater_than_amount: Math.max(
        0,
        Number(apiSmsSettings.send_sms_greater_than_amount) || 0
      ),
    };
    setApiSmsSettings(next);
    setApiSmsSaveError('');
    setApiSmsFieldSaving(true);

    try {
      await persistApiSmsSettings(next);
    } catch (err) {
      setApiSmsSettings(previous);
      const message = err?.message || 'Failed to update API SMS amount';
      setApiSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setApiSmsFieldSaving(false);
    }
  };

  const handleApiSmsTemplateChange = (value) => {
    setApiSmsSettings((prev) => ({
      ...prev,
      send_sms_on_order_message: value,
    }));
  };

  const handleApiSmsTemplateBlur = async () => {
    if (!companyId || togglingApiSmsKey || apiSmsFieldSaving) return;

    const previous = mergeApiSmsSettings(apiSmsSettings);
    const next = {
      ...apiSmsSettings,
      send_sms_on_order_message:
        String(apiSmsSettings.send_sms_on_order_message || '').trim() ||
        DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    };
    setApiSmsSettings(next);
    setApiSmsSaveError('');
    setApiSmsFieldSaving(true);

    try {
      await persistApiSmsSettings(next);
    } catch (err) {
      setApiSmsSettings(previous);
      const message = err?.message || 'Failed to update API SMS message';
      setApiSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setApiSmsFieldSaving(false);
    }
  };

  const handleApiSmsCredChange = (field, value) => {
    setApiSmsSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleApiSmsCredBlur = async () => {
    if (!companyId || togglingApiSmsKey || apiSmsFieldSaving) return;

    const previous = mergeApiSmsSettings(apiSmsSettings);
    const next = buildApiSmsSettingsPayload(apiSmsSettings);
    setApiSmsSettings(next);
    setApiSmsSaveError('');
    setApiSmsFieldSaving(true);

    try {
      await persistApiSmsSettings(next);
    } catch (err) {
      setApiSmsSettings(previous);
      const message = err?.message || 'Failed to update API SMS credentials';
      setApiSmsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setApiSmsFieldSaving(false);
    }
  };

  const persistEmailAlertsSettings = async (nextSettings) => {
    const payload = buildEmailAlertsSettingsPayload(nextSettings);
    const updated = await patchCompanyEmailAlertsSettings(companyId, payload);
    const fromApi = getCompanyFromApiBody(updated);
    const merged = {
      ...(authCompany || {}),
      ...(fromApi || {}),
      email_alerts: fromApi?.email_alerts ?? fromApi?.emailAlerts ?? payload,
    };
    dispatch(setCompany(merged));
    const parsed = extractEmailAlertsSettingsFromCompanyBody({ data: merged });
    setEmailAlertsSettings(mergeEmailAlertsSettings(parsed));
  };

  const handleToggleEmailAlertsSetting = async (key) => {
    if (!companyId || togglingEmailAlertsKey || emailAlertsFieldSaving) return;

    const previous = emailAlertsSettings;
    const next = { ...previous, [key]: !previous[key] };
    if (
      key === 'send_email_on_order' &&
      next.send_email_on_order &&
      !String(next.send_email_on_order_message || '').trim()
    ) {
      next.send_email_on_order_message = DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE;
    }
    setEmailAlertsSettings(next);
    setEmailAlertsSaveError('');
    setTogglingEmailAlertsKey(key);

    try {
      await persistEmailAlertsSettings(next);
    } catch (err) {
      setEmailAlertsSettings(previous);
      const message = err?.message || 'Failed to update email alert setting';
      setEmailAlertsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setTogglingEmailAlertsKey('');
    }
  };

  const handleEmailAlertsAmountChange = (value) => {
    const amount = value === '' ? '' : Math.max(0, Number(value));
    setEmailAlertsSettings((prev) => ({
      ...prev,
      send_email_greater_than_amount: amount === '' || Number.isNaN(amount) ? '' : amount,
    }));
  };

  const handleEmailAlertsAmountBlur = async () => {
    if (!companyId || togglingEmailAlertsKey || emailAlertsFieldSaving) return;

    const previous = mergeEmailAlertsSettings(emailAlertsSettings);
    const next = {
      ...emailAlertsSettings,
      send_email_greater_than_amount: Math.max(
        0,
        Number(emailAlertsSettings.send_email_greater_than_amount) || 0
      ),
    };
    setEmailAlertsSettings(next);
    setEmailAlertsSaveError('');
    setEmailAlertsFieldSaving(true);

    try {
      await persistEmailAlertsSettings(next);
    } catch (err) {
      setEmailAlertsSettings(previous);
      const message = err?.message || 'Failed to update email alert amount';
      setEmailAlertsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setEmailAlertsFieldSaving(false);
    }
  };

  const handleEmailAlertsTemplateChange = (value) => {
    setEmailAlertsSettings((prev) => ({
      ...prev,
      send_email_on_order_message: value,
    }));
  };

  const handleEmailAlertsTemplateBlur = async () => {
    if (!companyId || togglingEmailAlertsKey || emailAlertsFieldSaving) return;

    const previous = mergeEmailAlertsSettings(emailAlertsSettings);
    const next = {
      ...emailAlertsSettings,
      send_email_on_order_message:
        String(emailAlertsSettings.send_email_on_order_message || '').trim() ||
        DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE,
    };
    setEmailAlertsSettings(next);
    setEmailAlertsSaveError('');
    setEmailAlertsFieldSaving(true);

    try {
      await persistEmailAlertsSettings(next);
    } catch (err) {
      setEmailAlertsSettings(previous);
      const message = err?.message || 'Failed to update email alert message';
      setEmailAlertsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setEmailAlertsFieldSaving(false);
    }
  };

  const handleEmailAlertsCredChange = (field, value) => {
    setEmailAlertsSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmailAlertsCredBlur = async () => {
    if (!companyId || togglingEmailAlertsKey || emailAlertsFieldSaving) return;

    const previous = mergeEmailAlertsSettings(emailAlertsSettings);
    const next = buildEmailAlertsSettingsPayload(emailAlertsSettings);
    setEmailAlertsSettings(next);
    setEmailAlertsSaveError('');
    setEmailAlertsFieldSaving(true);

    try {
      await persistEmailAlertsSettings(next);
    } catch (err) {
      setEmailAlertsSettings(previous);
      const message = err?.message || 'Failed to update email credentials';
      setEmailAlertsSaveError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setEmailAlertsFieldSaving(false);
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

                <div className="settings-row mt-4 mb-0">
                  <div>
                    <div className="settings-row-label">{DISPLAY_STORE_ON_BIGCOMMERCE_META.label}</div>
                    {DISPLAY_STORE_ON_BIGCOMMERCE_META.hint ? (
                      <div className="settings-row-hint">{DISPLAY_STORE_ON_BIGCOMMERCE_META.hint}</div>
                    ) : null}
                  </div>
                  <div className="settings-row-control">
                    {togglingDisplayStore ? (
                      <span
                        className="spinner-border spinner-border-sm text-primary"
                        role="status"
                        style={{ width: '1rem', height: '1rem' }}
                      >
                        <span className="visually-hidden">Saving…</span>
                      </span>
                    ) : (
                      <span
                        className={`settings-state ${
                          displayStoreOnBigcommerce ? 'text-success' : 'text-muted'
                        }`}
                      >
                        {displayStoreOnBigcommerce ? 'On' : 'Off'}
                      </span>
                    )}
                    <label
                      className="form-check form-switch settings-switch"
                      htmlFor="company-display-store-on-bigcommerce"
                      style={{
                        cursor:
                          togglingDisplayStore || companySaving || !companyId
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="company-display-store-on-bigcommerce"
                        checked={displayStoreOnBigcommerce}
                        onChange={handleToggleDisplayStoreOnBigcommerce}
                        disabled={togglingDisplayStore || companySaving || !companyId}
                        aria-label={`${DISPLAY_STORE_ON_BIGCOMMERCE_META.label} ${
                          displayStoreOnBigcommerce ? 'on' : 'off'
                        }`}
                      />
                    </label>
                  </div>
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

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-store" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Big Commerce</h5>
            <p className="company-card-subtitle">
              Marketplace branding and visibility — settings save to{' '}
              <code className="text-xs">bigcommerce_settings</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          <div className="row g-4 mb-3">
            <div className="col-md-6">
              <div className="company-logo-panel">
                <div className="company-label mb-2">Logo</div>
                <div className="company-logo-frame">
                  {bcLogoPreview || existingBcLogoUrl ? (
                    <img src={bcLogoPreview || existingBcLogoUrl} alt="Big Commerce logo" />
                  ) : (
                    <div className="company-logo-empty">
                      <i className="fas fa-image" aria-hidden="true" />
                      <span>No logo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={bcLogoInputRef}
                  id="bigcommerce-logo"
                  type="file"
                  className="d-none"
                  accept="image/*"
                  onChange={handleBcLogoChange}
                  disabled={bigCommerceSaving || !companyId}
                />
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mb-0"
                    onClick={() => bcLogoInputRef.current?.click()}
                    disabled={bigCommerceSaving || !companyId}
                  >
                    <i className="fas fa-upload me-1" aria-hidden="true" />
                    {bcLogoPreview || existingBcLogoUrl ? 'Change logo' : 'Upload logo'}
                  </button>
                  {bcLogoPreview ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0"
                      onClick={clearBcLogoSelection}
                      disabled={bigCommerceSaving}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="company-logo-hint">
                  Stored as <code className="text-xs">logo</code> inside{' '}
                  <code className="text-xs">{BIGCOMMERCE_SETTINGS_FIELD}</code>. Use a file under
                  ~1.8&nbsp;MB.
                </p>
              </div>
            </div>

            <div className="col-md-6">
              <div className="company-logo-panel">
                <div className="company-label mb-2">Banner</div>
                <div className="company-banner-frame">
                  {bcBannerPreview || existingBcBannerUrl ? (
                    <img src={bcBannerPreview || existingBcBannerUrl} alt="Big Commerce banner" />
                  ) : (
                    <div className="company-logo-empty">
                      <i className="fas fa-image" aria-hidden="true" />
                      <span>No banner</span>
                    </div>
                  )}
                </div>
                <input
                  ref={bcBannerInputRef}
                  id="bigcommerce-banner"
                  type="file"
                  className="d-none"
                  accept="image/*"
                  onChange={handleBcBannerChange}
                  disabled={bigCommerceSaving || !companyId}
                />
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mb-0"
                    onClick={() => bcBannerInputRef.current?.click()}
                    disabled={bigCommerceSaving || !companyId}
                  >
                    <i className="fas fa-upload me-1" aria-hidden="true" />
                    {bcBannerPreview || existingBcBannerUrl ? 'Change banner' : 'Upload banner'}
                  </button>
                  {bcBannerPreview ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0"
                      onClick={clearBcBannerSelection}
                      disabled={bigCommerceSaving}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="company-logo-hint">
                  Stored as <code className="text-xs">banner</code> inside{' '}
                  <code className="text-xs">{BIGCOMMERCE_SETTINGS_FIELD}</code>. Use a file under
                  ~1.8&nbsp;MB.
                </p>
              </div>
            </div>
          </div>

          <div className="company-card-footer pt-0 border-0 mt-0 mb-3">
            <button
              type="button"
              className="btn btn-primary mb-0"
              onClick={handleSaveBigCommerceMedia}
              disabled={
                bigCommerceSaving ||
                !companyId ||
                (!isUserUploadFilePart(bcLogoFile) && !isUserUploadFilePart(bcBannerFile))
              }
            >
              {bigCommerceSaving ? 'Saving…' : 'Save images'}
            </button>
          </div>

          {BIGCOMMERCE_SETTING_DEFS.map(({ key }) => {
            const { label, hint } = bigCommerceSettingByKey[key] || { label: key };
            const isOn = Boolean(bigCommerceSettings[key]);
            const busy = togglingBigCommerceKey === key;
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
                    htmlFor={`bigcommerce-setting-${key}`}
                    style={{
                      cursor:
                        togglingBigCommerceKey || bigCommerceSaving || !companyId
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id={`bigcommerce-setting-${key}`}
                      checked={isOn}
                      onChange={() => handleToggleBigCommerceSetting(key)}
                      disabled={!!togglingBigCommerceKey || bigCommerceSaving || !companyId}
                      aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {bigCommerceSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{bigCommerceSaveError}</div>
          ) : null}
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-sms" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Send Local SMS Alerts</h5>
            <p className="company-card-subtitle">
              Local SMS alerts for orders — saved to{' '}
              <code className="text-xs">local_sms</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          {LOCAL_SMS_SETTING_DEFS.map((def) => {
            const { key, label, hint, type, amountKey, templateKey } = def;
            const isOn = Boolean(smsSettings[key]);
            const busy = togglingSmsKey === key;
            return (
              <Fragment key={key}>
                <div className="settings-row">
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
                      htmlFor={`sms-setting-${key}`}
                      style={{
                        cursor:
                          togglingSmsKey || smsAmountSaving || !companyId
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`sms-setting-${key}`}
                        checked={isOn}
                        onChange={() => handleToggleSmsSetting(key)}
                        disabled={!!togglingSmsKey || smsAmountSaving || !companyId}
                        aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                      />
                    </label>
                  </div>
                </div>

                {type === 'toggle_template' && isOn ? (
                  <div className="settings-row settings-row-nested settings-row-template">
                    <div className="w-100">
                      <div className="settings-row-label mb-1">SMS message</div>
                      <div className="settings-row-hint mb-2">
                        Use placeholders:{' '}
                        <code>{'{name}'}</code>, <code>{'{email}'}</code>,{' '}
                        <code>{'{phone}'}</code>, <code>{'{total_amount}'}</code>,{' '}
                        <code>{'{transaction_number}'}</code>, <code>{'{createdAt}'}</code>
                      </div>
                      <textarea
                        id={`sms-setting-${templateKey}`}
                        className="form-control company-control settings-sms-template"
                        rows={7}
                        value={smsSettings[templateKey] ?? DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE}
                        onChange={(e) => handleSmsTemplateChange(e.target.value)}
                        onBlur={handleSmsTemplateBlur}
                        disabled={!companyId || !!togglingSmsKey || smsAmountSaving}
                        aria-label="Send SMS on order message template"
                      />
                    </div>
                  </div>
                ) : null}

                {type === 'toggle_amount' ? (
                  <div className="settings-row settings-row-nested">
                    <div>
                      <div className="settings-row-label">Amount</div>
                      <div className="settings-row-hint">
                        Send SMS when order total is greater than this amount.
                      </div>
                    </div>
                    <div className="settings-row-control">
                      {smsAmountSaving ? (
                        <span
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        >
                          <span className="visually-hidden">Saving…</span>
                        </span>
                      ) : null}
                      <input
                        id={`sms-setting-${amountKey}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control company-control settings-amount-input"
                        value={smsSettings[amountKey] ?? 0}
                        onChange={(e) => handleSmsAmountChange(e.target.value)}
                        onBlur={handleSmsAmountBlur}
                        disabled={!companyId || !!togglingSmsKey || smsAmountSaving || !isOn}
                        aria-label="Send SMS greater than amount"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}

          {smsSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{smsSaveError}</div>
          ) : null}
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fab fa-whatsapp" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Send Local WhatsApp Alerts</h5>
            <p className="company-card-subtitle">
              Local WhatsApp alerts for orders — saved to{' '}
              <code className="text-xs">whatsapp_local_settings</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          {LOCAL_WHATSAPP_SETTING_DEFS.map((def) => {
            const { key, label, hint, type, amountKey, templateKey } = def;
            const isOn = Boolean(whatsappSettings[key]);
            const busy = togglingWhatsappKey === key;
            return (
              <Fragment key={key}>
                <div className="settings-row">
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
                      htmlFor={`whatsapp-setting-${key}`}
                      style={{
                        cursor:
                          togglingWhatsappKey || whatsappAmountSaving || !companyId
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`whatsapp-setting-${key}`}
                        checked={isOn}
                        onChange={() => handleToggleWhatsappSetting(key)}
                        disabled={!!togglingWhatsappKey || whatsappAmountSaving || !companyId}
                        aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                      />
                    </label>
                  </div>
                </div>

                {type === 'toggle_template' && isOn ? (
                  <div className="settings-row settings-row-nested settings-row-template">
                    <div className="w-100">
                      <div className="settings-row-label mb-1">WhatsApp message</div>
                      <div className="settings-row-hint mb-2">
                        Use placeholders:{' '}
                        <code>{'{name}'}</code>, <code>{'{email}'}</code>,{' '}
                        <code>{'{phone}'}</code>, <code>{'{total_amount}'}</code>,{' '}
                        <code>{'{transaction_number}'}</code>, <code>{'{createdAt}'}</code>
                      </div>
                      <textarea
                        id={`whatsapp-setting-${templateKey}`}
                        className="form-control company-control settings-sms-template"
                        rows={7}
                        value={
                          whatsappSettings[templateKey] ?? DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
                        }
                        onChange={(e) => handleWhatsappTemplateChange(e.target.value)}
                        onBlur={handleWhatsappTemplateBlur}
                        disabled={!companyId || !!togglingWhatsappKey || whatsappAmountSaving}
                        aria-label="Send WhatsApp on order message template"
                      />
                    </div>
                  </div>
                ) : null}

                {type === 'toggle_amount' ? (
                  <div className="settings-row settings-row-nested">
                    <div>
                      <div className="settings-row-label">Amount</div>
                      <div className="settings-row-hint">
                        Send WhatsApp when order total is greater than this amount.
                      </div>
                    </div>
                    <div className="settings-row-control">
                      {whatsappAmountSaving ? (
                        <span
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        >
                          <span className="visually-hidden">Saving…</span>
                        </span>
                      ) : null}
                      <input
                        id={`whatsapp-setting-${amountKey}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control company-control settings-amount-input"
                        value={whatsappSettings[amountKey] ?? 0}
                        onChange={(e) => handleWhatsappAmountChange(e.target.value)}
                        onBlur={handleWhatsappAmountBlur}
                        disabled={
                          !companyId || !!togglingWhatsappKey || whatsappAmountSaving || !isOn
                        }
                        aria-label="Send WhatsApp greater than amount"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}

          {whatsappSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{whatsappSaveError}</div>
          ) : null}
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-cloud" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Send Api SMS Alerts</h5>
            <p className="company-card-subtitle">
              API SMS gateway for orders — saved to <code className="text-xs">api_sms</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          <div className="settings-section-label">API credentials</div>
          <div className="row g-3 mb-3">
            <div className="col-12">
              <label className="company-label d-block" htmlFor="api-sms-url">
                API URL
              </label>
              <input
                id="api-sms-url"
                type="url"
                className="form-control company-control"
                value={apiSmsSettings.api_url}
                onChange={(e) => handleApiSmsCredChange('api_url', e.target.value)}
                onBlur={handleApiSmsCredBlur}
                placeholder="https://api.example.com/sms/send"
                disabled={!companyId || !!togglingApiSmsKey || apiSmsFieldSaving}
              />
            </div>
            <div className="col-md-6">
              <label className="company-label d-block" htmlFor="api-sms-key">
                API key
              </label>
              <input
                id="api-sms-key"
                type="text"
                className="form-control company-control"
                value={apiSmsSettings.api_key}
                onChange={(e) => handleApiSmsCredChange('api_key', e.target.value)}
                onBlur={handleApiSmsCredBlur}
                placeholder="Your API key"
                autoComplete="off"
                disabled={!companyId || !!togglingApiSmsKey || apiSmsFieldSaving}
              />
            </div>
            <div className="col-md-6">
              <label className="company-label d-block" htmlFor="api-sms-secret">
                API secret
              </label>
              <input
                id="api-sms-secret"
                type="password"
                className="form-control company-control"
                value={apiSmsSettings.api_secret}
                onChange={(e) => handleApiSmsCredChange('api_secret', e.target.value)}
                onBlur={handleApiSmsCredBlur}
                placeholder="Your API secret"
                autoComplete="new-password"
                disabled={!companyId || !!togglingApiSmsKey || apiSmsFieldSaving}
              />
            </div>
          </div>

          <div className="settings-section-label">Alert options</div>
          {API_SMS_SETTING_DEFS.map((def) => {
            const { key, label, hint, type, amountKey, templateKey } = def;
            const isOn = Boolean(apiSmsSettings[key]);
            const busy = togglingApiSmsKey === key;
            return (
              <Fragment key={`api-${key}`}>
                <div className="settings-row">
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
                      htmlFor={`api-sms-setting-${key}`}
                      style={{
                        cursor:
                          togglingApiSmsKey || apiSmsFieldSaving || !companyId
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`api-sms-setting-${key}`}
                        checked={isOn}
                        onChange={() => handleToggleApiSmsSetting(key)}
                        disabled={!!togglingApiSmsKey || apiSmsFieldSaving || !companyId}
                        aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                      />
                    </label>
                  </div>
                </div>

                {type === 'toggle_template' && isOn ? (
                  <div className="settings-row settings-row-nested settings-row-template">
                    <div className="w-100">
                      <div className="settings-row-label mb-1">SMS message</div>
                      <div className="settings-row-hint mb-2">
                        Use placeholders:{' '}
                        <code>{'{name}'}</code>, <code>{'{email}'}</code>,{' '}
                        <code>{'{phone}'}</code>, <code>{'{total_amount}'}</code>,{' '}
                        <code>{'{transaction_number}'}</code>, <code>{'{createdAt}'}</code>
                      </div>
                      <textarea
                        id={`api-sms-setting-${templateKey}`}
                        className="form-control company-control settings-sms-template"
                        rows={7}
                        value={
                          apiSmsSettings[templateKey] ?? DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
                        }
                        onChange={(e) => handleApiSmsTemplateChange(e.target.value)}
                        onBlur={handleApiSmsTemplateBlur}
                        disabled={!companyId || !!togglingApiSmsKey || apiSmsFieldSaving}
                        aria-label="API Send SMS on order message template"
                      />
                    </div>
                  </div>
                ) : null}

                {type === 'toggle_amount' ? (
                  <div className="settings-row settings-row-nested">
                    <div>
                      <div className="settings-row-label">Amount</div>
                      <div className="settings-row-hint">
                        Send SMS when order total is greater than this amount.
                      </div>
                    </div>
                    <div className="settings-row-control">
                      {apiSmsFieldSaving ? (
                        <span
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        >
                          <span className="visually-hidden">Saving…</span>
                        </span>
                      ) : null}
                      <input
                        id={`api-sms-setting-${amountKey}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control company-control settings-amount-input"
                        value={apiSmsSettings[amountKey] ?? 0}
                        onChange={(e) => handleApiSmsAmountChange(e.target.value)}
                        onBlur={handleApiSmsAmountBlur}
                        disabled={
                          !companyId || !!togglingApiSmsKey || apiSmsFieldSaving || !isOn
                        }
                        aria-label="API Send SMS greater than amount"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}

          {apiSmsSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{apiSmsSaveError}</div>
          ) : null}
        </div>
      </div>

      <div className="company-card">
        <div className="company-card-head">
          <span className="company-card-head-icon">
            <i className="fas fa-envelope" aria-hidden="true" />
          </span>
          <div>
            <h5 className="company-card-title">Email alerts</h5>
            <p className="company-card-subtitle">
              Gmail alerts for orders — saved to <code className="text-xs">email_alerts</code>.
            </p>
          </div>
        </div>
        <div className="company-card-body">
          <div className="settings-section-label">Gmail credentials</div>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="company-label d-block" htmlFor="email-alerts-gmail">
                Gmail email
              </label>
              <input
                id="email-alerts-gmail"
                type="email"
                className="form-control company-control"
                value={emailAlertsSettings.gmail_email}
                onChange={(e) => handleEmailAlertsCredChange('gmail_email', e.target.value)}
                onBlur={handleEmailAlertsCredBlur}
                placeholder="you@gmail.com"
                autoComplete="off"
                disabled={!companyId || !!togglingEmailAlertsKey || emailAlertsFieldSaving}
              />
            </div>
            <div className="col-md-6">
              <label className="company-label d-block" htmlFor="email-alerts-two-step">
                2-step password
              </label>
              <input
                id="email-alerts-two-step"
                type="password"
                className="form-control company-control"
                value={emailAlertsSettings.two_step_password}
                onChange={(e) => handleEmailAlertsCredChange('two_step_password', e.target.value)}
                onBlur={handleEmailAlertsCredBlur}
                placeholder="Gmail app password"
                autoComplete="new-password"
                disabled={!companyId || !!togglingEmailAlertsKey || emailAlertsFieldSaving}
              />
            </div>
          </div>

          <div className="settings-section-label">Alert options</div>
          {EMAIL_ALERT_SETTING_DEFS.map((def) => {
            const { key, label, hint, type, amountKey, templateKey } = def;
            const isOn = Boolean(emailAlertsSettings[key]);
            const busy = togglingEmailAlertsKey === key;
            return (
              <Fragment key={`email-${key}`}>
                <div className="settings-row">
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
                      htmlFor={`email-alert-setting-${key}`}
                      style={{
                        cursor:
                          togglingEmailAlertsKey || emailAlertsFieldSaving || !companyId
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`email-alert-setting-${key}`}
                        checked={isOn}
                        onChange={() => handleToggleEmailAlertsSetting(key)}
                        disabled={
                          !!togglingEmailAlertsKey || emailAlertsFieldSaving || !companyId
                        }
                        aria-label={`${label} ${isOn ? 'on' : 'off'}`}
                      />
                    </label>
                  </div>
                </div>

                {type === 'toggle_template' && isOn ? (
                  <div className="settings-row settings-row-nested settings-row-template">
                    <div className="w-100">
                      <div className="settings-row-label mb-1">Email message</div>
                      <div className="settings-row-hint mb-2">
                        Use placeholders:{' '}
                        <code>{'{name}'}</code>, <code>{'{email}'}</code>,{' '}
                        <code>{'{phone}'}</code>, <code>{'{total_amount}'}</code>,{' '}
                        <code>{'{transaction_number}'}</code>, <code>{'{createdAt}'}</code>
                      </div>
                      <textarea
                        id={`email-alert-setting-${templateKey}`}
                        className="form-control company-control settings-sms-template"
                        rows={7}
                        value={
                          emailAlertsSettings[templateKey] ?? DEFAULT_SEND_SMS_ON_ORDER_TEMPLATE
                        }
                        onChange={(e) => handleEmailAlertsTemplateChange(e.target.value)}
                        onBlur={handleEmailAlertsTemplateBlur}
                        disabled={
                          !companyId || !!togglingEmailAlertsKey || emailAlertsFieldSaving
                        }
                        aria-label="Send email on order message template"
                      />
                    </div>
                  </div>
                ) : null}

                {type === 'toggle_amount' ? (
                  <div className="settings-row settings-row-nested">
                    <div>
                      <div className="settings-row-label">Amount</div>
                      <div className="settings-row-hint">
                        Send email when order total is greater than this amount.
                      </div>
                    </div>
                    <div className="settings-row-control">
                      {emailAlertsFieldSaving ? (
                        <span
                          className="spinner-border spinner-border-sm text-primary"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        >
                          <span className="visually-hidden">Saving…</span>
                        </span>
                      ) : null}
                      <input
                        id={`email-alert-setting-${amountKey}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control company-control settings-amount-input"
                        value={emailAlertsSettings[amountKey] ?? 0}
                        onChange={(e) => handleEmailAlertsAmountChange(e.target.value)}
                        onBlur={handleEmailAlertsAmountBlur}
                        disabled={
                          !companyId ||
                          !!togglingEmailAlertsKey ||
                          emailAlertsFieldSaving ||
                          !isOn
                        }
                        aria-label="Send email greater than amount"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}

          {emailAlertsSaveError ? (
            <div className="alert alert-danger py-2 mt-3 mb-0">{emailAlertsSaveError}</div>
          ) : null}
        </div>
      </div>
    </>
  );
}
