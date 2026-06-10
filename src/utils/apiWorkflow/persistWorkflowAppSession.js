import store from '../../store/index.js';
import { setLoginSession } from '../../features/user/userSlice.js';
import { extractCompanyFromUser } from '../../features/company/companyAPI.js';

/**
 * Mirror app login/signup into localStorage + Redux so POS and other routes
 * use the same company as the workflow auth token.
 * @param {import('axios').AxiosResponse} axiosResponse
 */
export function persistWorkflowAppSession(axiosResponse) {
  if (typeof window === 'undefined' || !axiosResponse?.data) return;

  const body = axiosResponse.data;
  const data = body.data && typeof body.data === 'object' ? body.data : null;

  let user = body.user ?? data?.user ?? null;
  if (!user || typeof user !== 'object') return;

  user = { ...user };
  if ('password' in user) delete user.password;

  const token = String(
    user.token ?? body.token ?? data?.token ?? data?.access_token ?? ''
  ).trim();
  if (token) user = { ...user, token };

  let company = extractCompanyFromUser(user);
  if (!company && data?.company && typeof data.company === 'object') {
    company = { ...data.company };
  }
  if (company && data?.warehouse && typeof data.warehouse === 'object') {
    const hasWarehouse =
      company.warehouse_id != null &&
      (typeof company.warehouse_id === 'object' || String(company.warehouse_id).trim() !== '');
    if (!hasWarehouse) {
      company = { ...company, warehouse_id: data.warehouse };
    }
  }

  if (token) localStorage.setItem('authToken', token);
  localStorage.setItem('userData', JSON.stringify(user));
  if (user.name) localStorage.setItem('userName', String(user.name));
  if (company) {
    localStorage.setItem('companyData', JSON.stringify(company));
  } else {
    localStorage.removeItem('companyData');
  }

  store.dispatch(
    setLoginSession({
      success: body.success ?? true,
      message: body.message ?? '',
      user,
    })
  );
}

/** @param {string} url */
export function isWorkflowAuthSessionUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /user\/login/i.test(url) || /user\/user_company/i.test(url);
}
