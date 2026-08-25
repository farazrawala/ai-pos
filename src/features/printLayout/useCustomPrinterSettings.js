import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCompanyById,
  getCompanyFromApiBody,
  mergeCompanyRecordForSettings,
  patchCompanyCustomPrinterSettings,
} from '../company/companyAPI.js';
import {
  selectAuthUser,
  selectCompany,
  selectCompanyId,
  setCompany,
} from '../user/userSlice.js';
import {
  buildCustomPrinterSettingsPayload,
  extractCustomPrinterSettingsFromCompany,
  getPresetFromStore,
} from './customPrinterSettings.js';
import { mapCompanyRecordToLayoutPatch } from './mapCompanyToLayout.js';
import { usePrintLayout } from './PrintLayoutContext.jsx';
import { mergeWithDefaultLayout, saveLayoutSettings } from './printLayoutStorage.js';

export function useCustomPrinterSettings() {
  const dispatch = useDispatch();
  const companyId = useSelector(selectCompanyId);
  const authCompany = useSelector(selectCompany);
  const authUser = useSelector(selectAuthUser);
  const { settings, replaceSettings, patchSettings, setDocumentType, setPaperSize } =
    usePrintLayout();
  const [presetsStore, setPresetsStore] = useState(null);
  const [loading, setLoading] = useState(Boolean(companyId));
  const [saving, setSaving] = useState(false);
  const presetsStoreRef = useRef(null);
  const authCompanyRef = useRef(authCompany);
  const authUserRef = useRef(authUser);
  const hydratedRef = useRef(false);

  authCompanyRef.current = authCompany;
  authUserRef.current = authUser;

  const applyStore = useCallback(
    (store, company) => {
      presetsStoreRef.current = store;
      setPresetsStore(store);
      if (store?.active) {
        replaceSettings(mergeWithDefaultLayout(store.active));
      }
      const patch = mapCompanyRecordToLayoutPatch(company, authUserRef.current);
      if (patch) patchSettings(patch);
    },
    [replaceSettings, patchSettings]
  );

  const loadFromCompany = useCallback(
    (company) => {
      if (!company) return false;
      const store = extractCustomPrinterSettingsFromCompany(company);
      if (store) {
        applyStore(store, company);
        return true;
      }
      const patch = mapCompanyRecordToLayoutPatch(company, authUserRef.current);
      if (patch) patchSettings(patch);
      return false;
    },
    [applyStore, patchSettings]
  );

  // One-shot hydrate from session cache (no fetch loop).
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!authCompany) return;
    loadFromCompany(authCompany);
    hydratedRef.current = true;
  }, [authCompany, loadFromCompany]);

  // Fetch company once per companyId — do not depend on authCompany or it loops forever.
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        const merged = mergeCompanyRecordForSettings(fetched, authCompanyRef.current);
        loadFromCompany(merged);
        hydratedRef.current = true;
        dispatch(setCompany(merged));
      })
      .catch(() => {
        // Keep cached company settings on failure.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, dispatch, loadFromCompany]);

  const saveToCompany = useCallback(async () => {
    if (!companyId) {
      throw new Error('Your account is not linked to a company.');
    }
    setSaving(true);
    try {
      const payload = buildCustomPrinterSettingsPayload(
        settings,
        presetsStoreRef.current
      );
      const body = await patchCompanyCustomPrinterSettings(companyId, payload);
      const updated = getCompanyFromApiBody(body);
      const merged = mergeCompanyRecordForSettings(updated, {
        ...(authCompanyRef.current || {}),
        custom_printer_settings: JSON.stringify(payload),
        customPrinterSettings: JSON.stringify(payload),
      });
      presetsStoreRef.current = payload;
      setPresetsStore(payload);
      saveLayoutSettings(companyId, settings);
      dispatch(setCompany(merged));
      return payload;
    } finally {
      setSaving(false);
    }
  }, [companyId, settings, dispatch]);

  const switchDocumentType = useCallback(
    (documentType) => {
      const paperSize = settings.page?.paperSize || 'a4';
      const preset = getPresetFromStore(presetsStoreRef.current, documentType, paperSize);
      if (preset) {
        replaceSettings(preset);
        return;
      }
      setDocumentType(documentType);
    },
    [settings.page?.paperSize, replaceSettings, setDocumentType]
  );

  const switchPaperSize = useCallback(
    (paperSize) => {
      const documentType = settings.documentType || 'sales_invoice';
      const preset = getPresetFromStore(presetsStoreRef.current, documentType, paperSize);
      if (preset) {
        replaceSettings(preset);
        return;
      }
      setPaperSize(paperSize);
    },
    [settings.documentType, replaceSettings, setPaperSize]
  );

  return {
    loading,
    saving,
    presetsStore,
    saveToCompany,
    switchDocumentType,
    switchPaperSize,
    loadFromCompany,
  };
}
