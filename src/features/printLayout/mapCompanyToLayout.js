import { pickCompanyLogoUrl } from '../company/companyAPI.js';

/** Map a company DB record to print-layout company fields. */
export function mapCompanyRecordToLayoutCompany(company) {
  if (!company || typeof company !== 'object') return null;

  return {
    name: String(company.company_name ?? company.name ?? '').trim(),
    legalName: String(
      company.legal_name ?? company.company_legal_name ?? company.company_name ?? company.name ?? ''
    ).trim(),
    email: String(company.company_email ?? company.email ?? '').trim(),
    phone: String(company.company_phone ?? company.phone ?? '').trim(),
    address: String(company.company_address ?? company.address ?? '').trim(),
    city: String(company.city ?? company.company_city ?? '').trim(),
    country: String(company.country ?? company.company_country ?? '').trim(),
    website: String(company.website ?? company.company_website ?? '').trim(),
    tagline: String(company.tagline ?? company.company_tagline ?? '').trim(),
    taxNumber: String(
      company.tax_number ?? company.taxNumber ?? company.gst ?? company.vat ?? ''
    ).trim(),
    ntn: String(company.ntn ?? company.company_ntn ?? '').trim(),
    strn: String(company.strn ?? company.company_strn ?? '').trim(),
    registrationNumber: String(
      company.registration_number ?? company.reg_no ?? company.company_registration ?? ''
    ).trim(),
  };
}

export function mapCompanyRecordToLayoutPatch(company, authUser = null) {
  const mapped = mapCompanyRecordToLayoutCompany(company);
  if (!mapped) return null;

  const logoUrl = pickCompanyLogoUrl(company);
  const patch = { company: mapped };

  if (logoUrl) {
    patch.logo = { dataUrl: logoUrl };
  }

  if (authUser) {
    patch.user = {
      name: String(authUser.name ?? '').trim(),
      email: String(authUser.email ?? '').trim(),
      phone: String(authUser.phone ?? authUser.mobile ?? '').trim(),
      role: String(authUser.role ?? authUser.designation ?? '').trim(),
      branch: String(company.branch_name ?? company.branch ?? '').trim(),
      warehouse: String(company.warehouse_name ?? company.warehouse ?? '').trim(),
    };
  }

  return patch;
}
