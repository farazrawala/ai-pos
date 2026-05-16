/** Active environment: local | development | live */
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEVELOPMENT = APP_ENV === 'development';
export const IS_LIVE = APP_ENV === 'live';

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AI POS';

export const isDevServer = Boolean(import.meta.env.DEV);
