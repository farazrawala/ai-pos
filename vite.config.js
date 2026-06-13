import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { projectDevLogPlugin } from './vite-plugin-project-dev-log.js';

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

  return {
    base: normalizedBase,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || mode),
    },
    plugins: [
      react({
        include: ['**/*.jsx', '**/*.js', '**/*.tsx', '**/*.ts'],
      }),
      projectDevLogPlugin({ logFile: projectDevLogFile }),
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
