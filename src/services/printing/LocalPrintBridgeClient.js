import { CONNECTION_TEST_RESULTS } from '../../features/printers/printerConstants.js';

const DEFAULT_TIMEOUT_MS = 8000;

function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let json = null;
    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }
    if (!response.ok) {
      const err = new Error(json?.message || `Bridge error HTTP ${response.status}`);
      err.status = response.status;
      err.data = json;
      throw err;
    }
    return json ?? {};
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('Connection timeout');
      err.code = 'timeout';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * HTTP client for the local print bridge.
 * Browser → bridge (HTTP) → printer (TCP :9100 raw ESC/POS).
 */
export class LocalPrintBridgeClient {
  constructor(baseUrl) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  get isConfigured() {
    return Boolean(this.baseUrl);
  }

  async getCapabilities() {
    if (!this.baseUrl) throw new Error('Print bridge URL is not configured');
    return fetchJson(`${this.baseUrl}/capabilities`, { method: 'GET' });
  }

  async healthCheck() {
    if (!this.baseUrl) throw new Error('Print bridge URL is not configured');
    return fetchJson(`${this.baseUrl}/health`, { method: 'GET', timeoutMs: 5000 });
  }

  async testConnection({ ip, port = 9100 }) {
    if (!this.baseUrl) {
      return { status: 'error', message: 'Configure the local print bridge URL first.' };
    }
    try {
      const result = await fetchJson(`${this.baseUrl}/printers/test`, {
        method: 'POST',
        body: JSON.stringify({ ip_address: ip, port: Number(port) || 9100 }),
      });
      const status = String(result.status || result.state || 'online').toLowerCase();
      if (status === 'online' || status === 'ok' || status === 'success') {
        return {
          status: 'online',
          message: result.message || CONNECTION_TEST_RESULTS.online,
          latencyMs: result.latency_ms ?? result.latencyMs,
        };
      }
      if (status.includes('refused')) {
        return { status: 'refused', message: CONNECTION_TEST_RESULTS.refused };
      }
      if (status.includes('timeout')) {
        return { status: 'timeout', message: CONNECTION_TEST_RESULTS.timeout };
      }
      if (status.includes('offline')) {
        return { status: 'offline', message: CONNECTION_TEST_RESULTS.offline };
      }
      return { status: status || 'error', message: result.message || CONNECTION_TEST_RESULTS.error };
    } catch (error) {
      if (error.code === 'timeout') {
        return { status: 'timeout', message: CONNECTION_TEST_RESULTS.timeout };
      }
      if (error.status === 0 || /fetch|network|failed/i.test(error.message)) {
        return {
          status: 'offline',
          message: 'Print bridge unreachable. Start the bridge service on this device.',
        };
      }
      return { status: 'error', message: error.message || CONNECTION_TEST_RESULTS.error };
    }
  }

  async printRaw({ ip, port = 9100, data, copies = 1 }) {
    if (!this.baseUrl) throw new Error('Print bridge URL is not configured');

    let payload;
    if (typeof data === 'string') payload = data;
    else if (data instanceof Uint8Array) {
      let binary = '';
      for (let i = 0; i < data.length; i += 1) binary += String.fromCharCode(data[i]);
      payload = btoa(binary);
    } else {
      throw new Error('Invalid print data');
    }

    return fetchJson(`${this.baseUrl}/printers/print`, {
      method: 'POST',
      body: JSON.stringify({
        ip_address: ip,
        port: Number(port) || 9100,
        data_base64: payload,
        copies: Math.max(1, Number(copies) || 1),
      }),
    });
  }
}

export function loadBridgeUrl() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeBaseUrl(window.localStorage.getItem('posPrintBridgeUrl') || '');
  } catch {
    return '';
  }
}

export function saveBridgeUrl(url) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('posPrintBridgeUrl', normalizeBaseUrl(url));
  } catch {
    /* ignore */
  }
}
