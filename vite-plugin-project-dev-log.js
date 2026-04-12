import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Writes client POST bodies to a project log file (default logs.txt).
 * @param {{ logFile?: string }} options - logFile relative to project root, or absolute path
 */
export function projectDevLogPlugin(options = {}) {
  const logFileName = options.logFile || 'logs.txt';

  function installMiddleware(server) {
    server.middlewares.use((req, res, next) => {
      const urlPath = req.url?.split('?')[0];
      if (urlPath !== '/__project-dev-log' || req.method !== 'POST') {
        return next();
      }
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 256_000) {
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8').trim() || '{}';
          const logPath = path.isAbsolute(logFileName)
            ? logFileName
            : path.resolve(__dirname, logFileName);
          if (!fs.existsSync(logPath)) {
            fs.writeFileSync(
              logPath,
              `# ai-pos: project dev client log (one line per entry). File: ${logFileName}. Written during \`npm run dev\`, or \`npm run preview\` with VITE_PROJECT_DEV_LOG=1. Override path with VITE_PROJECT_DEV_LOG_FILE.\n\n`,
              'utf8'
            );
          }
          const stamp = new Date().toISOString();
          let fileLine = `[${stamp}] ${body}`;
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed.consoleLine === 'string' && parsed.consoleLine.length > 0) {
              fileLine = `[${stamp}] ${parsed.consoleLine}`;
            }
          } catch {
            // keep fileLine as raw body
          }
          fs.appendFileSync(logPath, `${fileLine}\n\n`, 'utf8');
          res.statusCode = 204;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(String(e?.message || e));
        }
      });
    });
  }

  return {
    name: 'project-dev-log',
    configureServer(server) {
      installMiddleware(server);
    },
    configurePreviewServer(server) {
      installMiddleware(server);
    },
  };
}
