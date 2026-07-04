const STORAGE_KEY = 'posPrintersLocalStore';

function readStore() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStore(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function emptyStore() {
  return {
    printers: [],
    templates: [],
    assignments: [],
    categoryLinks: [],
    jobs: [],
  };
}

export function loadLocalPrinterStore() {
  return { ...emptyStore(), ...(readStore() || {}) };
}

export function saveLocalPrinterStore(patch) {
  const next = { ...loadLocalPrinterStore(), ...patch };
  writeStore(next);
  return next;
}

export function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const isLocalFallbackEnabled = () =>
  typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
