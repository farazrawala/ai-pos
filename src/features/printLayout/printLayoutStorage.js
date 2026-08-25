import { createDefaultLayoutSettings, DOCUMENT_TYPES, PAPER_SIZE_OPTIONS } from './printLayoutDefaults.js';

const ALLOWED_DOCUMENT_TYPES = new Set(DOCUMENT_TYPES.map((d) => d.value));
const ALLOWED_PAPER_SIZES = new Set(PAPER_SIZE_OPTIONS.map((p) => p.value));

const STORAGE_PREFIX = 'ai-pos-print-layout';

function storageKey(companyId) {
  return `${STORAGE_PREFIX}:${companyId || 'default'}`;
}

/** Load saved layout from localStorage (UI-only, no backend). */
export function loadSavedLayoutSettings(companyId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist layout settings to localStorage (UI-only, no backend). */
export function saveLayoutSettings(companyId, settings) {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Remove saved layout for a company. */
export function clearSavedLayoutSettings(companyId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(companyId));
  } catch {
    // ignore
  }
}

/** Merge saved settings over defaults so new fields always have fallbacks. */
export function mergeWithDefaultLayout(saved) {
  const defaults = createDefaultLayoutSettings();
  if (!saved) return defaults;
  const merged = deepMerge(defaults, saved);
  if (!ALLOWED_DOCUMENT_TYPES.has(merged.documentType)) {
    merged.documentType = defaults.documentType;
  }
  if (!ALLOWED_PAPER_SIZES.has(merged.page?.paperSize)) {
    merged.page = { ...merged.page, paperSize: defaults.page.paperSize };
  }
  return merged;
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
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  });
  return out;
}
