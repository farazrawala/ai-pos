import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  createDefaultLayoutSettings,
  DEFAULT_POS_DATA,
} from './printLayoutDefaults.js';
import { loadSavedLayoutSettings, mergeWithDefaultLayout } from './printLayoutStorage.js';

const PrintLayoutContext = createContext(null);

export function PrintLayoutProvider({ children, companyId = '' }) {
  const [settings, setSettings] = useState(() => {
    const saved = loadSavedLayoutSettings(companyId);
    return saved ? mergeWithDefaultLayout(saved) : createDefaultLayoutSettings();
  });
  const [posData] = useState(DEFAULT_POS_DATA);

  const replaceSettings = useCallback((next) => {
    setSettings(next);
  }, []);

  const updateSettings = useCallback((path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i += 1) {
        cursor[keys[i]] = { ...cursor[keys[i]] };
        cursor = cursor[keys[i]];
      }
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const patchSettings = useCallback((patch) => {
    setSettings((prev) => deepMerge(prev, patch));
  }, []);

  const toggleSetting = useCallback((path) => {
    setSettings((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let cursor = next;
      for (let i = 0; i < keys.length - 1; i += 1) {
        cursor[keys[i]] = { ...cursor[keys[i]] };
        cursor = cursor[keys[i]];
      }
      const last = keys[keys.length - 1];
      cursor[last] = !cursor[last];
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(createDefaultLayoutSettings());
  }, []);

  const setDocumentType = useCallback((documentType) => {
    setSettings((prev) => ({ ...prev, documentType }));
  }, []);

  const setPaperSize = useCallback((paperSize) => {
    setSettings((prev) => ({
      ...prev,
      page: { ...prev.page, paperSize },
    }));
  }, []);

  const setSectionOrder = useCallback((sectionOrder) => {
    setSettings((prev) => ({ ...prev, sectionOrder }));
  }, []);

  const setProductColumnOrder = useCallback((columnOrder) => {
    setSettings((prev) => ({
      ...prev,
      products: { ...prev.products, columnOrder },
    }));
  }, []);

  const setLogoFile = useCallback((dataUrl) => {
    setSettings((prev) => ({
      ...prev,
      logo: { ...prev.logo, dataUrl },
    }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      posData,
      updateSettings,
      patchSettings,
      toggleSetting,
      resetSettings,
      replaceSettings,
      setDocumentType,
      setPaperSize,
      setSectionOrder,
      setProductColumnOrder,
      setLogoFile,
    }),
    [
      settings,
      posData,
      updateSettings,
      patchSettings,
      toggleSetting,
      resetSettings,
      replaceSettings,
      setDocumentType,
      setPaperSize,
      setSectionOrder,
      setProductColumnOrder,
      setLogoFile,
    ]
  );

  return (
    <PrintLayoutContext.Provider value={value}>{children}</PrintLayoutContext.Provider>
  );
}

export function usePrintLayout() {
  const ctx = useContext(PrintLayoutContext);
  if (!ctx) {
    throw new Error('usePrintLayout must be used within PrintLayoutProvider');
  }
  return ctx;
}

function deepMerge(target, source) {
  const out = { ...target };
  Object.keys(source).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  });
  return out;
}
