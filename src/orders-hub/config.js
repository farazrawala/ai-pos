const APP_URL = (import.meta.env.VITE_ORDERS_HUB_APP_URL || 'http://localhost:5173').replace(
  /\/+$/,
  ''
);

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
  urls: {
    app: APP_URL,
    login: joinUrl(APP_URL, import.meta.env.VITE_ORDERS_HUB_LOGIN_PATH || '/signin'),
    signup: joinUrl(APP_URL, import.meta.env.VITE_ORDERS_HUB_SIGNUP_PATH || '/signup'),
    demo: import.meta.env.VITE_ORDERS_HUB_DEMO_URL || 'mailto:hello@ordershub.com?subject=Orders%20Hub%20Demo',
  },
};
