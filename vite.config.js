import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { projectDevLogPlugin } from './vite-plugin-project-dev-log.js';

function readAppVersion() {
  try {
    const raw = readFileSync(resolve(__dirname, 'src/version.json'), 'utf-8');
    return JSON.parse(raw).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function withBasePath(base, pathSegment) {
  const segment = String(pathSegment || '').replace(/^\//, '');
  if (base === '/') return `/${segment}`.replace(/\/+/g, '/');
  return `${base}${segment}`.replace(/([^:]\/)\/+/g, '$1');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const projectDevLogFile = env.VITE_PROJECT_DEV_LOG_FILE || 'logs.txt';
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  const basePath = env.VITE_BASE_PATH || '/';
  const normalizedBase =
    basePath === '/' ? '/' : `/${String(basePath).replace(/^\/+|\/+$/g, '')}/`;

  if (mode === 'live') {
    console.log('[build:live] Using .env.live');
    console.log('[build:live] VITE_API_BASE_URL =', env.VITE_API_BASE_URL || '(not set)');
    console.log('[build:live] VITE_BASE_PATH =', normalizedBase);
  }

  const manifestBase = JSON.parse(
    readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8')
  );
  const pwaManifest = {
    ...manifestBase,
    start_url: withBasePath(normalizedBase, normalizedBase === '/' ? 'pos' : ''),
    scope: normalizedBase === '/' ? '/' : normalizedBase,
    icons: (manifestBase.icons || []).map((icon) => ({
      ...icon,
      src: withBasePath(normalizedBase, String(icon.src || '').replace(/^\//, '')),
    })),
  };
  const pwaStartPath =
    normalizedBase === '/'
      ? withBasePath(normalizedBase, 'pos')
      : normalizedBase.replace(/\/+$/, '') || '/';
  const basePathPattern =
    normalizedBase === '/'
      ? null
      : normalizedBase.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const navigateFallback =
    normalizedBase === '/' ? 'index.html' : withBasePath(normalizedBase, 'index.html');

  return {
    base: normalizedBase,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || mode),
      __APP_VERSION__: JSON.stringify(readAppVersion()),
    },
    plugins: [
      react({
        include: ['**/*.jsx', '**/*.js', '**/*.tsx', '**/*.ts'],
      }),
      projectDevLogPlugin({ logFile: projectDevLogFile }),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        scope: normalizedBase,
        includeAssets: [
          'pwa-icon.svg',
          'manifest.json',
          'assets/css/argon-dashboard.min.css',
          'assets/css/pos-sidenav-override.css',
          'assets/js/core/popper.min.js',
          'assets/js/core/bootstrap.min.js',
          'assets/js/plugins/perfect-scrollbar.min.js',
          'assets/js/plugins/smooth-scrollbar.min.js',
          'assets/js/argon-dashboard.min.js',
        ],
        manifest: pwaManifest,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,eot,ttf,json,webmanifest}'],
          globIgnores: ['**/assets/scss/**', '**/assets/js/argon-dashboard.js', '**/assets/css/argon-dashboard.css'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback,
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/storage\//],
          ...(basePathPattern
            ? { navigateFallbackAllowlist: [new RegExp(`^${basePathPattern}(/|$)`)] }
            : {}),
          skipWaiting: true,
          clientsClaim: true,
          ignoreURLParametersMatching: [/^v$/, /^rev$/],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.method === 'GET' &&
                (url.pathname.includes('/assets/') ||
                  /\.(js|css|woff2?|ttf|svg|png|ico|webmanifest)$/.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pos-static-assets',
                expiration: {
                  maxEntries: 400,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pos-product-images',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/storage/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'pos-storage-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: mode === 'localhost',
          type: 'classic',
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: {
      port: 5173,
      fs: {
        allow: ['..'],
      },
      proxy: {
        // Use `/api/` (slash after api) so the SPA route `/api-workflow` is not proxied to the backend.
        '/api/': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        // Category (and other) uploads are often served outside /api; proxy so /uploads works on :5173
        '/uploads': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/storage': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/public': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      open: pwaStartPath,
    },
    publicDir: 'public',
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  };
});
