import { buildTestPageEscPos } from './EscPosBuilder.js';
import { LocalPrintBridgeClient, loadBridgeUrl } from './LocalPrintBridgeClient.js';
import { ReceiptRenderer } from './ReceiptRenderer.js';

const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 3;

export function detectDirectTcpSupport() {
  return {
    supported: false,
    reason:
      'Browsers cannot open raw TCP sockets to printer IPs. Use the local print bridge on the same Wi‑Fi/LAN.',
  };
}

export class PrintQueue {
  constructor() {
    this.jobs = [];
    this.listeners = new Set();
    this.processing = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.getSnapshot());
  }

  getSnapshot() {
    return [...this.jobs];
  }

  enqueue(job) {
    const entry = {
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      retries: 0,
      error: null,
      createdAt: new Date().toISOString(),
      ...job,
    };
    this.jobs.unshift(entry);
    this.notify();
    this.processNext();
    return entry.id;
  }

  updateJob(id, patch) {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return;
    this.jobs[idx] = { ...this.jobs[idx], ...patch };
    this.notify();
  }

  async processNext() {
    if (this.processing) return;
    const next = this.jobs.find((j) => j.status === 'pending');
    if (!next) return;

    this.processing = true;
    this.updateJob(next.id, { status: 'printing' });

    try {
      await next.execute();
      this.updateJob(next.id, { status: 'printed', error: null });
    } catch (error) {
      const retries = (next.retries || 0) + 1;
      if (retries < MAX_RETRIES) {
        this.updateJob(next.id, { status: 'pending', retries, error: error.message });
        setTimeout(() => {
          this.processing = false;
          this.processNext();
        }, RETRY_DELAY_MS);
        return;
      }
      this.updateJob(next.id, { status: 'failed', retries, error: error.message });
    }

    this.processing = false;
    this.processNext();
  }

  retryFailed(id) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || job.status !== 'failed') return;
    this.updateJob(id, { status: 'pending', retries: 0, error: null });
    this.processNext();
  }

  clearCompleted() {
    this.jobs = this.jobs.filter(
      (j) => j.status === 'pending' || j.status === 'printing' || j.status === 'failed'
    );
    this.notify();
  }
}

export const globalPrintQueue = new PrintQueue();

export class PrinterService {
  constructor({ bridgeUrl } = {}) {
    this.bridgeUrl = bridgeUrl || loadBridgeUrl();
    this.bridge = new LocalPrintBridgeClient(this.bridgeUrl);
    this.queue = globalPrintQueue;
  }

  setBridgeUrl(url) {
    this.bridgeUrl = url;
    this.bridge = new LocalPrintBridgeClient(url);
  }

  getCapabilities() {
    return { directTcp: detectDirectTcpSupport(), bridge: Boolean(this.bridgeUrl) };
  }

  async testConnection(printer) {
    const ip = printer.ip_address ?? printer.ipAddress;
    const port = printer.port ?? 9100;
    if (!ip) throw new Error('Printer IP address is required');
    return this.bridge.testConnection({ ip, port });
  }

  async testPrint(printer) {
    const ip = printer.ip_address ?? printer.ipAddress;
    const port = printer.port ?? 9100;
    const data = buildTestPageEscPos({
      paperWidth: printer.paper_width || '80mm',
      autoCut: printer.auto_cut !== false,
      openDrawer: Boolean(printer.open_cash_drawer),
    });
    return this.bridge.printRaw({ ip, port, data, copies: printer.copies ?? 1 });
  }

  async printRaw(printer, data, { copies } = {}) {
    return this.bridge.printRaw({
      ip: printer.ip_address ?? printer.ipAddress,
      port: printer.port ?? 9100,
      data,
      copies: copies ?? printer.copies ?? 1,
    });
  }

  printReceipt({ printer, template, company, receipt }) {
    const renderer = new ReceiptRenderer({ template, printer, company });
    const data = renderer.renderReceipt(receipt);
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        type: 'receipt',
        printerId: printer._id || printer.id,
        printerName: printer.name,
        execute: async () => {
          try {
            await this.printRaw(printer, data);
            resolve();
          } catch (e) {
            reject(e);
            throw e;
          }
        },
      });
    });
  }

  printKitchen({ printer, title, lines, meta }) {
    const renderer = new ReceiptRenderer({ printer });
    const data = renderer.renderKitchenTicket({ title, lines, meta });
    return this.queue.enqueue({
      type: 'kitchen',
      printerId: printer._id || printer.id,
      execute: () => this.printRaw(printer, data),
    });
  }

  splitAndPrintOrder({ lines = [], categoryPrinterMap = {}, printersById = {}, orderMeta = {} }) {
    const buckets = new Map();
    for (const line of lines) {
      const catId = String(line.category_id ?? line.categoryId ?? '');
      const printerId = categoryPrinterMap[catId];
      if (!printerId) continue;
      if (!buckets.has(printerId)) buckets.set(printerId, []);
      buckets.get(printerId).push(line);
    }

    const jobIds = [];
    for (const [printerId, bucketLines] of buckets) {
      const printer = printersById[printerId];
      if (!printer || printer.status === 'disabled') continue;
      const dept = printer.department || 'kitchen';
      jobIds.push(
        this.printKitchen({
          printer,
          title: dept.replace(/_/g, ' ').toUpperCase(),
          lines: bucketLines,
          meta: orderMeta,
        })
      );
    }
    return jobIds;
  }
}

export const printerService = new PrinterService();
