import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = env.VITE_ORDERS_HUB_BASE_PATH || '/';
  const normalizedBase =
    basePath === '/' ? '/' : `/${String(basePath).replace(/^\/+|\/+$/g, '')}/`;

  return {
    root: resolve(__dirname, 'src/orders-hub'),
    base: normalizedBase,
    envDir: resolve(__dirname),
    publicDir: resolve(__dirname, 'src/orders-hub/public'),
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'dist-orders-hub'),
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
          },
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      open: true,
    },
    preview: {
      port: 4174,
      open: true,
    },
    resolve: {
      alias: {
        '@hub': resolve(__dirname, 'src/orders-hub'),
      },
    },
  };
});
