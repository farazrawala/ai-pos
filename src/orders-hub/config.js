const APP_URL = (import.meta.env.VITE_ORDERS_HUB_APP_URL || 'http://localhost:5173').replace(
  /\/+$/,
  ''
);

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

function joinUrl(base, path) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path) || path.startsWith('mailto:')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const site = {
  name: 'Orders Hub',
  tagline: 'Everything Your Business Needs to Sell, Manage & Grow.',
  positioning: 'One platform to run your entire business.',
  coreMessage: 'One Business. One Platform. Complete Control.',
  email: import.meta.env.VITE_ORDERS_HUB_EMAIL || 'hello@ordershub.com',
  api: {
    baseUrl: API_BASE || '/api',
    userCompany: `${API_BASE || '/api'}/user/user_company`,
  },
  urls: {
    app: APP_URL,
    login: joinUrl(APP_URL, import.meta.env.VITE_ORDERS_HUB_LOGIN_PATH || '/signin'),
    signup: joinUrl(APP_URL, import.meta.env.VITE_ORDERS_HUB_SIGNUP_PATH || '/signup'),
    demo: import.meta.env.VITE_ORDERS_HUB_DEMO_URL || 'mailto:hello@ordershub.com?subject=Orders%20Hub%20Demo',
  },
};

export const DEFAULT_SIGNUP_PERMISSIONS = {
  category: { view: true, add: true, edit: true, delete: true },
  integration: { add: true, view: true, edit: true, delete: true },
  order: { add: true, view: true, edit: true, delete: true },
  process: { add: true, view: true, edit: false, delete: false },
};
