import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function installUploadLogMiddleware(server) {
  server.middlewares.use((req, res, next) => {
    const urlPath = req.url?.split('?')[0];
    if (urlPath !== '/__category-upload-log' || req.method !== 'POST') {
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
        const logPath = path.resolve(__dirname, 'logs.txt');
        if (!fs.existsSync(logPath)) {
          fs.writeFileSync(
            logPath,
            '# ai-pos: category image upload errors (one JSON object per block). Written by Vite during `npm run dev`, or `npm run preview` with VITE_FILE_UPLOAD_LOG=1 in .env.\n\n',
            'utf8'
          );
        }
        const stamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${stamp}] ${body}\n\n`, 'utf8');
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

export function categoryUploadLogPlugin() {
  return {
    name: 'category-upload-log-to-file',
    configureServer(server) {
      installUploadLogMiddleware(server);
    },
    configurePreviewServer(server) {
      installUploadLogMiddleware(server);
    },
  };
}
