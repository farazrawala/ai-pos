/**
 * Build raw ESC/POS command bytes for thermal printers.
 * Output is sent to the local print bridge → TCP :9100 on the printer.
 */
export class EscPosBuilder {
  constructor({ encoding = 'utf8', paperWidth = '80mm' } = {}) {
    this.encoding = encoding;
    this.paperWidth = paperWidth;
    this.chunks = [];
  }

  raw(bytes) {
    if (bytes instanceof Uint8Array) this.chunks.push(bytes);
    else if (Array.isArray(bytes)) this.chunks.push(Uint8Array.from(bytes));
    return this;
  }

  init() {
    return this.raw([0x1b, 0x40]);
  }

  align(mode = 'left') {
    const map = { left: 0, center: 1, right: 2 };
    return this.raw([0x1b, 0x61, map[mode] ?? 0]);
  }

  bold(on = true) {
    return this.raw([0x1b, 0x45, on ? 1 : 0]);
  }

  doubleHeight(on = true) {
    return this.raw([0x1b, 0x21, on ? 0x10 : 0x00]);
  }

  text(line = '') {
    const encoder = new TextEncoder();
    this.chunks.push(encoder.encode(String(line)));
    return this.raw([0x0a]);
  }

  blank(lines = 1) {
    for (let i = 0; i < lines; i += 1) this.raw([0x0a]);
    return this;
  }

  separator(char = '-') {
    const cols = this.paperWidth === '58mm' ? 32 : 42;
    return this.text(String(char).repeat(cols));
  }

  cut({ partial = true, feedDots = 3 } = {}) {
    // Small advance so last lines clear the cutter; GS V 65/66 also feeds `feedDots`.
    this.blank(2);
    const n = Math.max(0, Math.min(255, Number(feedDots) || 3));
    // GS V 65 n = feed then full cut; GS V 66 n = feed then partial cut.
    const mode = partial ? 0x42 : 0x41;
    return this.raw([0x1d, 0x56, mode, n]);
  }

  openDrawer() {
    return this.raw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  }

  build() {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  toBase64() {
    const bytes = this.build();
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}

/** Minimal ESC/POS payload that only feeds and cuts (for after browser print). */
export function buildCutEscPos({ partial = true, feedDots = 3 } = {}) {
  const b = new EscPosBuilder();
  b.init().cut({ partial, feedDots });
  return b.build();
}

/** Standard test page content per product spec. */
export function buildTestPageEscPos(options = {}) {
  const { paperWidth = '80mm', autoCut = true, openDrawer = false } = options;
  const b = new EscPosBuilder({ paperWidth });
  const now = new Date();
  b.init()
    .align('center')
    .bold(true)
    .text('******************************')
    .text('        TEST PRINT')
    .text('******************************')
    .blank()
    .bold(false)
    .text('Printer Connected Successfully')
    .blank()
    .align('left')
    .text(`Date: ${now.toLocaleDateString()}`)
    .text(`Time: ${now.toLocaleTimeString()}`)
    .blank()
    .text('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    .blank()
    .text('1234567890')
    .blank()
    .align('center')
    .text('Thank You')
    .blank(2);
  if (openDrawer) b.openDrawer();
  if (autoCut) b.cut();
  return b.build();
}
