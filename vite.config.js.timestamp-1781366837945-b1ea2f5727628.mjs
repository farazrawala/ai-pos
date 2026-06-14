// vite.config.js
import { defineConfig, loadEnv } from "file:///E:/xampp/htdocs/brands/ai-pos/node_modules/vite/dist/node/index.js";
import react from "file:///E:/xampp/htdocs/brands/ai-pos/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";

// vite-plugin-project-dev-log.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///E:/xampp/htdocs/brands/ai-pos/vite-plugin-project-dev-log.js";
var __dirname2 = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
function projectDevLogPlugin(options = {}) {
  const logFileName = options.logFile || "logs.txt";
  function installMiddleware(server) {
    server.middlewares.use((req, res, next) => {
      const urlPath = req.url?.split("?")[0];
      if (urlPath !== "/__project-dev-log" || req.method !== "POST") {
        return next();
      }
      const chunks = [];
      let size = 0;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > 256e3) {
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8").trim() || "{}";
          const logPath = path.isAbsolute(logFileName) ? logFileName : path.resolve(__dirname2, logFileName);
          if (!fs.existsSync(logPath)) {
            fs.writeFileSync(
              logPath,
              `# ai-pos: project dev client log (one line per entry). File: ${logFileName}. Written during \`npm run dev\`, or \`npm run preview\` with VITE_PROJECT_DEV_LOG=1. Override path with VITE_PROJECT_DEV_LOG_FILE.

`,
              "utf8"
            );
          }
          const stamp = (/* @__PURE__ */ new Date()).toISOString();
          let fileLine = `[${stamp}] ${body}`;
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed.consoleLine === "string" && parsed.consoleLine.length > 0) {
              fileLine = `[${stamp}] ${parsed.consoleLine}`;
            }
          } catch {
          }
          fs.appendFileSync(logPath, `${fileLine}

`, "utf8");
          res.statusCode = 204;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(String(e?.message || e));
        }
      });
    });
  }
  return {
    name: "project-dev-log",
    configureServer(server) {
      installMiddleware(server);
    },
    configurePreviewServer(server) {
      installMiddleware(server);
    }
  };
}

// vite.config.js
var __vite_injected_original_dirname = "E:\\xampp\\htdocs\\brands\\ai-pos";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const projectDevLogFile = env.VITE_PROJECT_DEV_LOG_FILE || "logs.txt";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";
  const basePath = env.VITE_BASE_PATH || "/";
  const normalizedBase = basePath === "/" ? "/" : `/${String(basePath).replace(/^\/+|\/+$/g, "")}/`;
  if (mode === "live") {
    console.log("[build:live] Using .env.live");
    console.log("[build:live] VITE_API_BASE_URL =", env.VITE_API_BASE_URL || "(not set)");
    console.log("[build:live] VITE_BASE_PATH =", normalizedBase);
  }
  return {
    base: normalizedBase,
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || mode)
    },
    plugins: [
      react({
        include: ["**/*.jsx", "**/*.js", "**/*.tsx", "**/*.ts"]
      }),
      projectDevLogPlugin({ logFile: projectDevLogFile })
    ],
    server: {
      port: 5173,
      fs: {
        allow: [".."]
      },
      proxy: {
        // Use `/api/` (slash after api) so the SPA route `/api-workflow` is not proxied to the backend.
        "/api/": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        },
        // Category (and other) uploads are often served outside /api; proxy so /uploads works on :5173
        "/uploads": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        },
        "/storage": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        },
        "/public": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    publicDir: "public",
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.[jt]sx?$/,
      exclude: []
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx"
        }
      }
    },
    resolve: {
      alias: {
        "@": resolve(__vite_injected_original_dirname, "src")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAidml0ZS1wbHVnaW4tcHJvamVjdC1kZXYtbG9nLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxceGFtcHBcXFxcaHRkb2NzXFxcXGJyYW5kc1xcXFxhaS1wb3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXHhhbXBwXFxcXGh0ZG9jc1xcXFxicmFuZHNcXFxcYWktcG9zXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi94YW1wcC9odGRvY3MvYnJhbmRzL2FpLXBvcy92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xyXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IHByb2plY3REZXZMb2dQbHVnaW4gfSBmcm9tICcuL3ZpdGUtcGx1Z2luLXByb2plY3QtZGV2LWxvZy5qcyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XHJcbiAgY29uc3QgcHJvamVjdERldkxvZ0ZpbGUgPSBlbnYuVklURV9QUk9KRUNUX0RFVl9MT0dfRklMRSB8fCAnbG9ncy50eHQnO1xyXG4gIGNvbnN0IGFwaVByb3h5VGFyZ2V0ID0gZW52LlZJVEVfQVBJX1BST1hZX1RBUkdFVCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJztcclxuICBjb25zdCBiYXNlUGF0aCA9IGVudi5WSVRFX0JBU0VfUEFUSCB8fCAnLyc7XHJcbiAgY29uc3Qgbm9ybWFsaXplZEJhc2UgPVxyXG4gICAgYmFzZVBhdGggPT09ICcvJyA/ICcvJyA6IGAvJHtTdHJpbmcoYmFzZVBhdGgpLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKX0vYDtcclxuXHJcbiAgaWYgKG1vZGUgPT09ICdsaXZlJykge1xyXG4gICAgY29uc29sZS5sb2coJ1tidWlsZDpsaXZlXSBVc2luZyAuZW52LmxpdmUnKTtcclxuICAgIGNvbnNvbGUubG9nKCdbYnVpbGQ6bGl2ZV0gVklURV9BUElfQkFTRV9VUkwgPScsIGVudi5WSVRFX0FQSV9CQVNFX1VSTCB8fCAnKG5vdCBzZXQpJyk7XHJcbiAgICBjb25zb2xlLmxvZygnW2J1aWxkOmxpdmVdIFZJVEVfQkFTRV9QQVRIID0nLCBub3JtYWxpemVkQmFzZSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgYmFzZTogbm9ybWFsaXplZEJhc2UsXHJcbiAgICBkZWZpbmU6IHtcclxuICAgICAgX19BUFBfRU5WX186IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX0FQUF9FTlYgfHwgbW9kZSksXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICByZWFjdCh7XHJcbiAgICAgICAgaW5jbHVkZTogWycqKi8qLmpzeCcsICcqKi8qLmpzJywgJyoqLyoudHN4JywgJyoqLyoudHMnXSxcclxuICAgICAgfSksXHJcbiAgICAgIHByb2plY3REZXZMb2dQbHVnaW4oeyBsb2dGaWxlOiBwcm9qZWN0RGV2TG9nRmlsZSB9KSxcclxuICAgIF0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydDogNTE3MyxcclxuICAgICAgZnM6IHtcclxuICAgICAgICBhbGxvdzogWycuLiddLFxyXG4gICAgICB9LFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgIC8vIFVzZSBgL2FwaS9gIChzbGFzaCBhZnRlciBhcGkpIHNvIHRoZSBTUEEgcm91dGUgYC9hcGktd29ya2Zsb3dgIGlzIG5vdCBwcm94aWVkIHRvIHRoZSBiYWNrZW5kLlxyXG4gICAgICAgICcvYXBpLyc6IHtcclxuICAgICAgICAgIHRhcmdldDogYXBpUHJveHlUYXJnZXQsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy8gQ2F0ZWdvcnkgKGFuZCBvdGhlcikgdXBsb2FkcyBhcmUgb2Z0ZW4gc2VydmVkIG91dHNpZGUgL2FwaTsgcHJveHkgc28gL3VwbG9hZHMgd29ya3Mgb24gOjUxNzNcclxuICAgICAgICAnL3VwbG9hZHMnOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVByb3h5VGFyZ2V0LFxyXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgICcvc3RvcmFnZSc6IHtcclxuICAgICAgICAgIHRhcmdldDogYXBpUHJveHlUYXJnZXQsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJy9wdWJsaWMnOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVByb3h5VGFyZ2V0LFxyXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHB1YmxpY0RpcjogJ3B1YmxpYycsXHJcbiAgICBlc2J1aWxkOiB7XHJcbiAgICAgIGxvYWRlcjogJ2pzeCcsXHJcbiAgICAgIGluY2x1ZGU6IC9zcmNcXC8uKlxcLltqdF1zeD8kLyxcclxuICAgICAgZXhjbHVkZTogW10sXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgICAgbG9hZGVyOiB7XHJcbiAgICAgICAgICAnLmpzJzogJ2pzeCcsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgJ0AnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9O1xyXG59KTtcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFx4YW1wcFxcXFxodGRvY3NcXFxcYnJhbmRzXFxcXGFpLXBvc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxceGFtcHBcXFxcaHRkb2NzXFxcXGJyYW5kc1xcXFxhaS1wb3NcXFxcdml0ZS1wbHVnaW4tcHJvamVjdC1kZXYtbG9nLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi94YW1wcC9odGRvY3MvYnJhbmRzL2FpLXBvcy92aXRlLXBsdWdpbi1wcm9qZWN0LWRldi1sb2cuanNcIjtpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XHJcblxyXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcclxuXHJcbi8qKlxyXG4gKiBXcml0ZXMgY2xpZW50IFBPU1QgYm9kaWVzIHRvIGEgcHJvamVjdCBsb2cgZmlsZSAoZGVmYXVsdCBsb2dzLnR4dCkuXHJcbiAqIEBwYXJhbSB7eyBsb2dGaWxlPzogc3RyaW5nIH19IG9wdGlvbnMgLSBsb2dGaWxlIHJlbGF0aXZlIHRvIHByb2plY3Qgcm9vdCwgb3IgYWJzb2x1dGUgcGF0aFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3REZXZMb2dQbHVnaW4ob3B0aW9ucyA9IHt9KSB7XHJcbiAgY29uc3QgbG9nRmlsZU5hbWUgPSBvcHRpb25zLmxvZ0ZpbGUgfHwgJ2xvZ3MudHh0JztcclxuXHJcbiAgZnVuY3Rpb24gaW5zdGFsbE1pZGRsZXdhcmUoc2VydmVyKSB7XHJcbiAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICBjb25zdCB1cmxQYXRoID0gcmVxLnVybD8uc3BsaXQoJz8nKVswXTtcclxuICAgICAgaWYgKHVybFBhdGggIT09ICcvX19wcm9qZWN0LWRldi1sb2cnIHx8IHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xyXG4gICAgICAgIHJldHVybiBuZXh0KCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgY2h1bmtzID0gW107XHJcbiAgICAgIGxldCBzaXplID0gMDtcclxuICAgICAgcmVxLm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XHJcbiAgICAgICAgc2l6ZSArPSBjaHVuay5sZW5ndGg7XHJcbiAgICAgICAgaWYgKHNpemUgPiAyNTZfMDAwKSB7XHJcbiAgICAgICAgICByZXEuZGVzdHJveSgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjaHVua3MucHVzaChjaHVuayk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXEub24oJ2VuZCcsICgpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgYm9keSA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKS50b1N0cmluZygndXRmOCcpLnRyaW0oKSB8fCAne30nO1xyXG4gICAgICAgICAgY29uc3QgbG9nUGF0aCA9IHBhdGguaXNBYnNvbHV0ZShsb2dGaWxlTmFtZSlcclxuICAgICAgICAgICAgPyBsb2dGaWxlTmFtZVxyXG4gICAgICAgICAgICA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIGxvZ0ZpbGVOYW1lKTtcclxuICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dQYXRoKSkge1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKFxyXG4gICAgICAgICAgICAgIGxvZ1BhdGgsXHJcbiAgICAgICAgICAgICAgYCMgYWktcG9zOiBwcm9qZWN0IGRldiBjbGllbnQgbG9nIChvbmUgbGluZSBwZXIgZW50cnkpLiBGaWxlOiAke2xvZ0ZpbGVOYW1lfS4gV3JpdHRlbiBkdXJpbmcgXFxgbnBtIHJ1biBkZXZcXGAsIG9yIFxcYG5wbSBydW4gcHJldmlld1xcYCB3aXRoIFZJVEVfUFJPSkVDVF9ERVZfTE9HPTEuIE92ZXJyaWRlIHBhdGggd2l0aCBWSVRFX1BST0pFQ1RfREVWX0xPR19GSUxFLlxcblxcbmAsXHJcbiAgICAgICAgICAgICAgJ3V0ZjgnXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBjb25zdCBzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcclxuICAgICAgICAgIGxldCBmaWxlTGluZSA9IGBbJHtzdGFtcH1dICR7Ym9keX1gO1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXJzZWQuY29uc29sZUxpbmUgPT09ICdzdHJpbmcnICYmIHBhcnNlZC5jb25zb2xlTGluZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgZmlsZUxpbmUgPSBgWyR7c3RhbXB9XSAke3BhcnNlZC5jb25zb2xlTGluZX1gO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgLy8ga2VlcCBmaWxlTGluZSBhcyByYXcgYm9keVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZnMuYXBwZW5kRmlsZVN5bmMobG9nUGF0aCwgYCR7ZmlsZUxpbmV9XFxuXFxuYCwgJ3V0ZjgnKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjA0O1xyXG4gICAgICAgICAgcmVzLmVuZCgpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvcGxhaW47IGNoYXJzZXQ9dXRmLTgnKTtcclxuICAgICAgICAgIHJlcy5lbmQoU3RyaW5nKGU/Lm1lc3NhZ2UgfHwgZSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAncHJvamVjdC1kZXYtbG9nJyxcclxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgaW5zdGFsbE1pZGRsZXdhcmUoc2VydmVyKTtcclxuICAgIH0sXHJcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xyXG4gICAgICBpbnN0YWxsTWlkZGxld2FyZShzZXJ2ZXIpO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVIsU0FBUyxjQUFjLGVBQWU7QUFDelQsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTs7O0FDRjJSLE9BQU8sUUFBUTtBQUNsVSxPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFGNkosSUFBTSwyQ0FBMkM7QUFJNU8sSUFBTUEsYUFBWSxLQUFLLFFBQVEsY0FBYyx3Q0FBZSxDQUFDO0FBTXRELFNBQVMsb0JBQW9CLFVBQVUsQ0FBQyxHQUFHO0FBQ2hELFFBQU0sY0FBYyxRQUFRLFdBQVc7QUFFdkMsV0FBUyxrQkFBa0IsUUFBUTtBQUNqQyxXQUFPLFlBQVksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3pDLFlBQU0sVUFBVSxJQUFJLEtBQUssTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUNyQyxVQUFJLFlBQVksd0JBQXdCLElBQUksV0FBVyxRQUFRO0FBQzdE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
