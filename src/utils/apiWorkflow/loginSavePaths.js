import { AUTH_TOKEN_SAVE_PATHS, resolveWorkflowAuthToken } from './authToken.js';
import {
  COMPANY_DEFAULT_ACCOUNT_KEYS,
  extractCompanyFromUser,
  resolveLoginSessionParams,
} from '../../features/company/companyAPI.js';

const USER_ROOTS = ['response.data.user', 'response.data.data.user'];

/** Response paths for a populated field on login `user.company_id`. */
function loginCompanyFieldPaths(field) {
  const paths = [];
  for (const root of USER_ROOTS) {
    paths.push(`${root}.company_id.${field}._id`);
    paths.push(`${root}.company_id.${field}`);
    paths.push(`${root}.company.${field}._id`);
    paths.push(`${root}.company.${field}`);
  }
  return paths;
}

const LOGIN_COMPANY_ID_PATHS = [
  ...USER_ROOTS.flatMap((root) => [`${root}.company_id._id`, `${root}.company_id`]),
  ...USER_ROOTS.flatMap((root) => [`${root}.company._id`, `${root}.company`]),
  'response.data.data.company._id',
  'response.data.data.company.id',
  'response.data.company._id',
  'response.data.company.id',
];

const LOGIN_USER_ID_PATHS = [
  'response.data.user._id',
  'response.data.user.id',
  'response.data.data.user._id',
  'response.data.data.user.id',
];

/**
 * Save map for `POST user/login` — extracts ids from populated `user.company_id`.
 * Used with applySaveMap(..., { skipIfCached: true }) so signup values are kept when present.
 */
export function buildLoginSaveMap() {
  /** @type {Record<string, string | string[]>} */
  const save = {
    auth_token: AUTH_TOKEN_SAVE_PATHS,
    company_id: LOGIN_COMPANY_ID_PATHS,
    workflow_user_id: LOGIN_USER_ID_PATHS,
    warehouse_1_id: loginCompanyFieldPaths('warehouse_id'),
  };

  for (const key of COMPANY_DEFAULT_ACCOUNT_KEYS) {
    save[`${key}_id`] = loginCompanyFieldPaths(key);
  }

  return save;
}

export const LOGIN_SAVE_MAP = buildLoginSaveMap();

/** Seed workflow variables from app login cache (localStorage) when not already set. */
export function seedWorkflowVarsFromLoginCache(vars = {}) {
  const next = { ...vars };
  const token = resolveWorkflowAuthToken(next);
  if (token && !next.auth_token) next.auth_token = token;

  if (typeof window === 'undefined') return next;

  try {
    const userRaw = localStorage.getItem('userData');
    const companyRaw = localStorage.getItem('companyData');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const company = companyRaw ? JSON.parse(companyRaw) : extractCompanyFromUser(user);
    const params = resolveLoginSessionParams(user, company);

    if (!next.company_id && params.companyId) next.company_id = params.companyId;
    if (!next.workflow_user_id && params.userId) next.workflow_user_id = params.userId;
    if (!next.warehouse_1_id && params.warehouseId) next.warehouse_1_id = params.warehouseId;

    for (const key of COMPANY_DEFAULT_ACCOUNT_KEYS) {
      const varName = `${key}_id`;
      if (!next[varName] && params[key]) next[varName] = params[key];
    }
  } catch {
    /* ignore invalid cache */
  }

  return next;
}
