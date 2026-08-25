import { createDefaultLayoutSettings, PAPER_SIZE_OPTIONS } from './printLayoutDefaults.js';
import { mergeWithDefaultLayout } from './printLayoutStorage.js';

export const CUSTOM_PRINTER_SETTINGS_VERSION = 1;

const PAPER_KEYS = new Set(PAPER_SIZE_OPTIONS.map((p) => p.value));

/** Strip runtime-only fields before persisting a layout preset. */
export function cloneLayoutSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function emptyPresetsTree() {
  return {};
}

/**
 * Build company `custom_printer_settings` JSON.
 * Stores active layout + per document + per paper size presets.
 */
export function buildCustomPrinterSettingsPayload(settings, existingStore = null) {
  const layout = cloneLayoutSettings(settings);
  const documentType = layout.documentType || 'sales_invoice';
  const paperSize = layout.page?.paperSize || 'a4';

  const store =
    existingStore && typeof existingStore === 'object'
      ? cloneLayoutSettings(existingStore)
      : { version: CUSTOM_PRINTER_SETTINGS_VERSION, active: null, presets: emptyPresetsTree() };

  store.version = CUSTOM_PRINTER_SETTINGS_VERSION;
  store.updatedAt = new Date().toISOString();
  store.active = layout;

  if (!store.presets || typeof store.presets !== 'object') {
    store.presets = emptyPresetsTree();
  }
  if (!store.presets[documentType] || typeof store.presets[documentType] !== 'object') {
    store.presets[documentType] = {};
  }
  store.presets[documentType][paperSize] = layout;

  return store;
}

export function parseCustomPrinterSettings(raw) {
  if (raw == null || raw === '') return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  // Legacy: flat layout object (localStorage-only saves before this feature)
  if (!parsed.presets && !parsed.active && parsed.documentType) {
    return {
      version: CUSTOM_PRINTER_SETTINGS_VERSION,
      active: parsed,
      presets: {
        [parsed.documentType || 'sales_invoice']: {
          [parsed.page?.paperSize || 'a4']: parsed,
        },
      },
    };
  }

  return parsed;
}

export function mergeCustomPrinterSettings(parsed) {
  const store = parseCustomPrinterSettings(parsed);
  if (!store?.active) return null;
  return mergeWithDefaultLayout(store.active);
}

/** Resolve layout for printing: preset → active → defaults. */
export function getPrintLayoutFromStore(store, documentType, paperSize) {
  const parsed = parseCustomPrinterSettings(store);
  if (!parsed) return createDefaultLayoutSettings();

  const doc = documentType || parsed.active?.documentType || 'sales_invoice';
  const paper = paperSize || parsed.active?.page?.paperSize || 'a4';

  const preset = parsed.presets?.[doc]?.[paper];
  if (preset) {
    return mergeWithDefaultLayout({
      ...preset,
      documentType: doc,
      page: { ...preset.page, paperSize: paper },
    });
  }

  if (
    parsed.active &&
    parsed.active.documentType === doc &&
    parsed.active.page?.paperSize === paper
  ) {
    return mergeWithDefaultLayout(parsed.active);
  }

  if (parsed.active) {
    return mergeWithDefaultLayout({
      ...parsed.active,
      documentType: doc,
      page: { ...parsed.active.page, paperSize: paper },
    });
  }

  return mergeWithDefaultLayout(createDefaultLayoutSettings());
}

export function getPresetFromStore(store, documentType, paperSize) {
  const parsed = parseCustomPrinterSettings(store);
  if (!parsed?.presets?.[documentType]?.[paperSize]) return null;
  const preset = parsed.presets[documentType][paperSize];
  return mergeWithDefaultLayout({
    ...preset,
    documentType,
    page: { ...preset.page, paperSize },
  });
}

export function readCustomPrinterSettingsRaw(company) {
  if (!company || typeof company !== 'object') return null;
  let raw =
    company.custom_printer_settings ??
    company.customPrinterSettings ??
    null;
  if (raw != null) return raw;

  const allFields = company.all_fields ?? company.allFields;
  if (allFields == null) return null;

  if (typeof allFields === 'string') {
    const parsed = parseCustomPrinterSettings(allFields);
    return parsed?.custom_printer_settings ?? parsed?.customPrinterSettings ?? null;
  }

  if (typeof allFields === 'object') {
    raw = allFields.custom_printer_settings ?? allFields.customPrinterSettings;
    if (raw != null) return raw;
  }

  return null;
}

export function extractCustomPrinterSettingsFromCompany(company) {
  return parseCustomPrinterSettings(readCustomPrinterSettingsRaw(company));
}

/** List saved preset keys for UI hints. */
export function listSavedPresets(store) {
  const parsed = parseCustomPrinterSettings(store);
  if (!parsed?.presets) return [];
  const rows = [];
  Object.entries(parsed.presets).forEach(([doc, papers]) => {
    if (!papers || typeof papers !== 'object') return;
    Object.keys(papers).forEach((paper) => {
      if (PAPER_KEYS.has(paper) || paper === 'custom') {
        rows.push({ documentType: doc, paperSize: paper });
      }
    });
  });
  return rows;
}
