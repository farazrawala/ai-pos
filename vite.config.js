import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { projectDevLogPlugin } from './vite-plugin-project-dev-log.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const projectDevLogFile = env.VITE_PROJECT_DEV_LOG_FILE || 'logs.txt';

  return {
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
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        // Category (and other) uploads are often served outside /api; proxy so /uploads works on :5173
        '/uploads': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/storage': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/public': {
          target: 'http://localhost:8000',
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
