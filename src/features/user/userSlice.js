import { createSlice } from '@reduxjs/toolkit';
import {
  extractCompanyDefaultAccounts,
  extractCompanyFromUser,
  getCompanyIdFromUser,
  getDefaultAccountId,
  getWarehouseFromCompany,
  getWarehouseIdFromCompany,
  pickAccountRefId,
} from '../company/companyAPI.js';

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('userData');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredCompany = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('companyData');
    if (stored) return JSON.parse(stored);
  } catch {
    // fall through to user payload
  }
  return extractCompanyFromUser(getStoredUser());
};

const sanitizeUserPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const userData = { ...raw };
  if ('password' in userData) delete userData.password;
  return userData;
};

const buildSessionFromUser = (userData) => {
  const company = extractCompanyFromUser(userData);
  const companyId = getCompanyIdFromUser(userData) || pickId(company);
  const defaultAccounts = extractCompanyDefaultAccounts(company);
  const warehouse = getWarehouseFromCompany(company);
  const warehouseId = getWarehouseIdFromCompany(company);
  return {
    user: userData,
    name: userData?.name || '',
    token: userData?.token || '',
    company,
    companyId,
    warehouse,
    warehouseId,
    defaultAccounts,
    permissions:
      userData?.permissions && typeof userData.permissions === 'object' ? userData.permissions : {},
    roles: collectUserRoles(userData),
  };
};

/** Prefer `role`, fall back to `roles` (API shape varies). */
function collectUserRoles(userData) {
  const fromRole = Array.isArray(userData?.role)
    ? userData.role
    : userData?.role
      ? [userData.role]
      : [];
  if (fromRole.length) return fromRole;
  const fromRoles = Array.isArray(userData?.roles)
    ? userData.roles
    : userData?.roles
      ? [userData.roles]
      : [];
  return fromRoles;
}

const pickId = (doc) => {
  if (!doc || typeof doc !== 'object') return '';
  const id = doc._id ?? doc.id;
  return id != null ? String(id) : '';
};

const persistSession = ({ user, name, token, company }) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('userData', JSON.stringify(user));
    if (name) localStorage.setItem('userName', name);
    if (token) localStorage.setItem('authToken', token);
    if (company) {
      localStorage.setItem('companyData', JSON.stringify(company));
    } else {
      localStorage.removeItem('companyData');
    }
  } else {
    localStorage.removeItem('userData');
    localStorage.removeItem('userName');
    localStorage.removeItem('authToken');
    localStorage.removeItem('companyData');
  }
};

const storedUser = getStoredUser();
const storedCompany = getStoredCompany();
const initialSession = storedUser ? buildSessionFromUser(storedUser) : null;

const initialState = {
  name: initialSession?.name || storedUser?.name || '',
  token:
    initialSession?.token ||
    (typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''),
  user: storedUser,
  company: storedCompany,
  companyId: initialSession?.companyId || getCompanyIdFromUser(storedUser) || '',
  warehouse: initialSession?.warehouse || getWarehouseFromCompany(storedCompany),
  warehouseId: initialSession?.warehouseId || getWarehouseIdFromCompany(storedCompany) || '',
  defaultAccounts:
    initialSession?.defaultAccounts || extractCompanyDefaultAccounts(storedCompany) || {},
  permissions: initialSession?.permissions || storedUser?.permissions || {},
  roles: initialSession?.roles || [],
  loginMessage: '',
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setName: (state, action) => {
      state.name = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('userName', action.payload);
        } else {
          localStorage.removeItem('userName');
        }
      }
    },
    setToken: (state, action) => {
      state.token = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('authToken', action.payload);
        } else {
          localStorage.removeItem('authToken');
        }
      }
    },
    setUser: (state, action) => {
      const userData = sanitizeUserPayload(action.payload);
      if (!userData) {
        state.user = null;
        state.name = '';
        state.token = '';
        state.company = null;
        state.companyId = '';
        state.warehouse = null;
        state.warehouseId = '';
        state.defaultAccounts = {};
        state.permissions = {};
        state.roles = [];
        persistSession({ user: null });
        return;
      }

      const session = buildSessionFromUser(userData);
      state.user = session.user;
      state.name = session.name;
      state.token = session.token || state.token;
      state.company = session.company;
      state.companyId = session.companyId;
      state.warehouse = session.warehouse;
      state.warehouseId = session.warehouseId;
      state.defaultAccounts = session.defaultAccounts;
      state.permissions = session.permissions;
      state.roles = session.roles;

      persistSession({
        user: session.user,
        name: session.name,
        token: state.token,
        company: session.company,
      });
    },
    /** Full login API body: `{ success, message, user }`. */
    setLoginSession: (state, action) => {
      const body = action.payload;
      const userData = sanitizeUserPayload(body?.user ?? body);
      if (!userData) return;

      if (body?.message) state.loginMessage = String(body.message);

      const session = buildSessionFromUser(userData);
      state.user = session.user;
      state.name = session.name;
      state.token = session.token || state.token;
      state.company = session.company;
      state.companyId = session.companyId;
      state.warehouse = session.warehouse;
      state.warehouseId = session.warehouseId;
      state.defaultAccounts = session.defaultAccounts;
      state.permissions = session.permissions;
      state.roles = session.roles;

      persistSession({
        user: session.user,
        name: session.name,
        token: state.token,
        company: session.company,
      });
    },
    setCompany: (state, action) => {
      const company = action.payload && typeof action.payload === 'object' ? action.payload : null;
      state.company = company;
      state.companyId = getCompanyIdFromUser({ company_id: company }) || pickId(company);
      state.warehouse = getWarehouseFromCompany(company);
      state.warehouseId = getWarehouseIdFromCompany(company);
      state.defaultAccounts = extractCompanyDefaultAccounts(company);
      if (state.user && company) {
        state.user = { ...state.user, company_id: company };
        if (typeof window !== 'undefined') {
          localStorage.setItem('userData', JSON.stringify(state.user));
          localStorage.setItem('companyData', JSON.stringify(company));
        }
      }
    },
    clearUser: (state) => {
      state.name = '';
      state.token = '';
      state.user = null;
      state.company = null;
      state.companyId = '';
      state.warehouse = null;
      state.warehouseId = '';
      state.defaultAccounts = {};
      state.permissions = {};
      state.roles = [];
      state.loginMessage = '';
      persistSession({ user: null });
    },
  },
});

export const { setName, setToken, setUser, setLoginSession, setCompany, clearUser } =
  userSlice.actions;

/** Logged-in user document (without password). */
export const selectAuthUser = (state) => state.user?.user ?? null;

/** Populated company from login (`company_id` object). */
export const selectCompany = (state) => state.user?.company ?? null;

export const selectCompanyId = (state) => state.user?.companyId ?? '';

/** Head-office warehouse from login `company_id.warehouse_id`. */
export const selectWarehouse = (state) => state.user?.warehouse ?? null;

export const selectWarehouseId = (state) => state.user?.warehouseId ?? '';

/** Default accounts from login company populate (payable, receivable, cash, etc.). */
export const selectDefaultAccounts = (state) => state.user?.defaultAccounts ?? {};

export const selectDefaultAccountId = (key) => (state) => {
  const fromCompany = getDefaultAccountId(state.user?.company, key);
  if (fromCompany) return fromCompany;
  return pickAccountRefId(state.user?.defaultAccounts?.[key]);
};

export const selectDefaultPayableAccountId = selectDefaultAccountId(
  'default_account_payable_account'
);

export const selectDefaultReceivableAccountId = selectDefaultAccountId(
  'default_account_receivable_account'
);

export const selectDefaultCashAccountId = selectDefaultAccountId('default_cash_account');

export const selectDefaultAdjustmentAccountId = selectDefaultAccountId(
  'default_adjustment_account'
);

export const selectPermissions = (state) => state.user?.permissions ?? {};

export const selectUserRoles = (state) => state.user?.roles ?? [];

export const selectAuthToken = (state) => state.user?.token || state.user?.user?.token || '';

/** Matches protected routes: session can be token-only until user payload hydrates. */
export const selectIsAuthenticated = (state) => {
  const { name, token, user } = state.user;
  return Boolean(name || token || user?.name || user?.email || user?._id);
};

export default userSlice.reducer;
