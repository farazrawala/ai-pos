/** Active environment: local | development | live */
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEVELOPMENT = APP_ENV === 'development';
export const IS_LIVE = APP_ENV === 'live';

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AI POS';

export const isDevServer = Boolean(import.meta.env.DEV);

/** `VITE_DEBUG=true` — enables dev tooling (e.g. API sources footer). */
function parseEnvBool(value) {
  if (value === undefined || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export const DEBUG = parseEnvBool(import.meta.env.VITE_DEBUG);
