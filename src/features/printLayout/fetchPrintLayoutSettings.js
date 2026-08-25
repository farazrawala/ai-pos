import {
  fetchCompanyById,
  getCompanyFromApiBody,
} from '../company/companyAPI.js';
import {
  extractCustomPrinterSettingsFromCompany,
  getPrintLayoutFromStore,
} from './customPrinterSettings.js';

/**
 * Load saved print layout for a document + paper size (for invoice/PDF print flows).
 */
export async function fetchPrintLayoutSettings(companyId, options = {}) {
  const { documentType, paperSize } = options;
  if (!companyId) return getPrintLayoutFromStore(null, documentType, paperSize);

  const body = await fetchCompanyById(companyId);
  const company = getCompanyFromApiBody(body);
  const store = extractCustomPrinterSettingsFromCompany(company);
  return getPrintLayoutFromStore(store, documentType, paperSize);
}

export {
  extractCustomPrinterSettingsFromCompany,
  getPrintLayoutFromStore,
  parseCustomPrinterSettings,
} from './customPrinterSettings.js';
