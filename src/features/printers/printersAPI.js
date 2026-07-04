import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  isLocalFallbackEnabled,
  loadLocalPrinterStore,
  saveLocalPrinterStore,
  localId,
} from './printersLocalStore.js';
import {
  normalizePrinterRecord,
  normalizeTemplateRecord,
  normalizeAssignmentRecord,
  normalizeCategoryLinkRecord,
  validatePrinterPayload,
} from './printerValidation.js';
import { DEFAULT_RECEIPT_TEMPLATE } from './printerConstants.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function getErrorMessage(response) {
  try {
    const json = await response.json();
    return json?.message || json?.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path.replace(/^\//, '')}`;
  const response = await fetch(url, { ...options, headers: getHeaders() });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function unwrapList(result, keys = ['data', 'printers']) {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== 'object') return [];
  for (const k of keys) {
    if (Array.isArray(result[k])) return result[k];
  }
  return [];
}

function shouldUseLocalFallback(error) {
  return isLocalFallbackEnabled() && error && /fetch|404|failed|network/i.test(String(error.message));
}

export async function fetchPrintersRequest() {
  try {
    const result = await apiFetch('printers', { method: 'GET' });
    return unwrapList(result).map(normalizePrinterRecord).filter(Boolean);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return loadLocalPrinterStore().printers.map(normalizePrinterRecord).filter(Boolean);
  }
}

export async function createPrinterRequest(data) {
  const errors = validatePrinterPayload(data);
  if (Object.keys(errors).length) {
    const err = new Error(Object.values(errors).join('; '));
    err.validation = errors;
    throw err;
  }
  try {
    const result = await apiFetch('printers', { method: 'POST', body: JSON.stringify(data) });
    return normalizePrinterRecord(result?.data ?? result?.printer ?? result);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    const row = normalizePrinterRecord({ ...data, _id: localId() });
    store.printers.push(row);
    saveLocalPrinterStore(store);
    return row;
  }
}

export async function updatePrinterRequest(id, data) {
  const errors = validatePrinterPayload(data);
  if (Object.keys(errors).length) {
    const err = new Error(Object.values(errors).join('; '));
    err.validation = errors;
    throw err;
  }
  try {
    const result = await apiFetch(`printers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return normalizePrinterRecord(result?.data ?? result?.printer ?? result);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    store.printers = store.printers.map((p) =>
      String(p._id) === String(id) ? normalizePrinterRecord({ ...p, ...data, _id: id }) : p
    );
    saveLocalPrinterStore(store);
    return store.printers.find((p) => String(p._id) === String(id));
  }
}

export async function deletePrinterRequest(id) {
  try {
    await apiFetch(`printers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    store.printers = store.printers.filter((p) => String(p._id) !== String(id));
    saveLocalPrinterStore(store);
    return true;
  }
}

export async function testPrinterConnectionRequest(printerIdOrPayload) {
  const body =
    typeof printerIdOrPayload === 'object'
      ? printerIdOrPayload
      : { printer_id: printerIdOrPayload };
  try {
    return await apiFetch('printers/test', { method: 'POST', body: JSON.stringify(body) });
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return { status: 'offline', message: 'Backend unavailable — use bridge test from the UI.' };
  }
}

export async function testPrinterPrintRequest(printerIdOrPayload) {
  const body =
    typeof printerIdOrPayload === 'object'
      ? printerIdOrPayload
      : { printer_id: printerIdOrPayload };
  try {
    return await apiFetch('printers/test-print', { method: 'POST', body: JSON.stringify(body) });
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return { success: false, message: 'Use Print Test Page via the local bridge.' };
  }
}

export async function fetchPrinterTemplatesRequest() {
  try {
    const result = await apiFetch('printer-templates', { method: 'GET' });
    return unwrapList(result, ['data', 'templates']).map(normalizeTemplateRecord).filter(Boolean);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    if (!store.templates.length) {
      store.templates = [{ ...DEFAULT_RECEIPT_TEMPLATE, _id: localId(), name: 'Default Receipt' }];
      saveLocalPrinterStore(store);
    }
    return store.templates;
  }
}

export async function savePrinterTemplateRequest(template) {
  const id = template._id ?? template.id;
  try {
    if (id) {
      const result = await apiFetch(`printer-templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(template),
      });
      return normalizeTemplateRecord(result?.data ?? result);
    }
    const result = await apiFetch('printer-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    return normalizeTemplateRecord(result?.data ?? result);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    if (id) {
      store.templates = store.templates.map((t) =>
        String(t._id) === String(id) ? { ...t, ...template, _id: id } : t
      );
    } else {
      store.templates.push({ ...template, _id: localId() });
    }
    saveLocalPrinterStore(store);
    return store.templates.at(-1);
  }
}

export async function fetchPrinterAssignmentsRequest() {
  try {
    const result = await apiFetch('printer-assignments', { method: 'GET' });
    return unwrapList(result, ['data', 'assignments']).map(normalizeAssignmentRecord).filter(Boolean);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return loadLocalPrinterStore().assignments;
  }
}

export async function savePrinterAssignmentRequest({ department, printer_id }) {
  try {
    return await apiFetch('printer-assignments', {
      method: 'POST',
      body: JSON.stringify({ department, printer_id }),
    });
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const store = loadLocalPrinterStore();
    const idx = store.assignments.findIndex((a) => a.department === department);
    const row = { _id: localId(), department, printer_id };
    if (idx >= 0) store.assignments[idx] = { ...store.assignments[idx], printer_id };
    else store.assignments.push(row);
    saveLocalPrinterStore(store);
    return row;
  }
}

export async function fetchPrinterCategoryLinksRequest() {
  try {
    const result = await apiFetch('printer-categories', { method: 'GET' });
    return unwrapList(result, ['data', 'links']).map(normalizeCategoryLinkRecord).filter(Boolean);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return loadLocalPrinterStore().categoryLinks;
  }
}

export async function savePrinterCategoryLinksRequest(links = []) {
  try {
    return await apiFetch('printer-categories', {
      method: 'PUT',
      body: JSON.stringify({ links }),
    });
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    saveLocalPrinterStore({ categoryLinks: links });
    return links;
  }
}

export async function fetchPrintJobsRequest() {
  try {
    const result = await apiFetch('print/jobs', { method: 'GET' });
    return unwrapList(result, ['data', 'jobs']);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return loadLocalPrinterStore().jobs;
  }
}

export async function printReceiptRequest(payload) {
  return apiFetch('print/receipt', { method: 'POST', body: JSON.stringify(payload) });
}

export async function printKitchenRequest(payload) {
  return apiFetch('print/kitchen', { method: 'POST', body: JSON.stringify(payload) });
}

export async function printBarRequest(payload) {
  return apiFetch('print/bar', { method: 'POST', body: JSON.stringify(payload) });
}
