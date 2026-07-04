/**
 * Minimal POS Print Bridge — forwards raw ESC/POS from browser to TCP :9100.
 * Run: node print-bridge/server.mjs
 * Default listen: http://127.0.0.1:17890
 */
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PRINT_BRIDGE_PORT) || 17890;
const HOST = process.env.PRINT_BRIDGE_HOST || '0.0.0.0';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function testTcp(ip, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ ...result, latency_ms: Date.now() - started });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ status: 'online', message: 'Online' }));
    socket.once('timeout', () => finish({ status: 'timeout', message: 'Timeout' }));
    socket.once('error', (err) => {
      if (err.code === 'ECONNREFUSED') finish({ status: 'refused', message: 'Connection Refused' });
      else finish({ status: 'offline', message: err.message || 'Offline' });
    });
    socket.connect(port, ip);
  });
}

function sendRawPrint(ip, port, buffer, copies = 1) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);
    socket.once('error', reject);
    socket.once('timeout', () => reject(new Error('Print timeout')));
    socket.connect(port, ip, () => {
      let copy = 0;
      const writeNext = () => {
        if (copy >= copies) {
          socket.end();
          resolve({ success: true });
          return;
        }
        copy += 1;
        socket.write(buffer, (err) => {
          if (err) reject(err);
          else writeNext();
        });
      };
      writeNext();
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'pos-print-bridge' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/capabilities') {
      sendJson(res, 200, {
        tcp_raw: true,
        esc_pos: true,
        port_default: 9100,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/printers/test') {
      const body = await readBody(req);
      const ip = body.ip_address || body.ip;
      const port = Number(body.port) || 9100;
      const result = await testTcp(ip, port);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/printers/print') {
      const body = await readBody(req);
      const ip = body.ip_address || body.ip;
      const port = Number(body.port) || 9100;
      const copies = Math.max(1, Number(body.copies) || 1);
      const b64 = body.data_base64 || body.data;
      if (!ip || !b64) {
        sendJson(res, 400, { message: 'ip_address and data_base64 required' });
        return;
      }
      const buffer = Buffer.from(b64, 'base64');
      await sendRawPrint(ip, port, buffer, copies);
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 404, { message: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Bridge error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`POS Print Bridge listening on http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
});
