import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(path, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function inRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  if (x >= radius && x < size - radius) return y >= 0 && y < size;
  if (y >= radius && y < size - radius) return x >= 0 && x < size;
  const cx = x < radius ? radius : size - radius;
  const cy = y < radius ? radius : size - radius;
  return distSq(x, y, cx, cy) <= radius * radius;
}

function inRect(x, y, left, top, w, h) {
  return x >= left && x < left + w && y >= top && y < top + h;
}

function paintIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const radius = 96 * scale;
  const terminal = {
    x: 104 * scale,
    y: 160 * scale,
    w: 304 * scale,
    h: 256 * scale,
    r: 24 * scale,
  };
  const bars = [
    { x: 168 * scale, y: 208 * scale, w: 32 * scale, h: 128 * scale },
    { x: 232 * scale, y: 208 * scale, w: 32 * scale, h: 128 * scale },
    { x: 296 * scale, y: 208 * scale, w: 32 * scale, h: 128 * scale },
  ];
  const dot = { x: 368 * scale, y: 144 * scale, r: 40 * scale };
  const purple = [94, 114, 228, 255];
  const white = [255, 255, 255, 255];
  const green = [45, 206, 137, 255];

  const inTerminal = (x, y) => {
    const { x: left, y: top, w, h, r } = terminal;
    const lx = x - left;
    const ly = y - top;
    if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
    if (lx >= r && lx < w - r) return true;
    if (ly >= r && ly < h - r) return true;
    const cx = lx < r ? r : w - r;
    const cy = ly < r ? r : h - r;
    return distSq(lx, ly, cx, cy) <= r * r;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      let color = [0, 0, 0, 0];
      if (inRoundedRect(x + 0.5, y + 0.5, size, radius)) color = purple;
      if (inTerminal(x + 0.5, y + 0.5)) color = white;
      for (const bar of bars) {
        if (inRect(x + 0.5, y + 0.5, bar.x, bar.y, bar.w, bar.h)) color = purple;
      }
      if (distSq(x + 0.5, y + 0.5, dot.x, dot.y) <= dot.r * dot.r) color = green;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = color[3];
    }
  }
  return pixels;
}

for (const size of [192, 512]) {
  writePng(resolve(outDir, `pwa-icon-${size}.png`), size, size, paintIcon(size));
}
