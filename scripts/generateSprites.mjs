import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Zero-dependency RGBA PNG encoder
function encodePNG(width, height, rgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width * 4; x++) {
      raw[rowStart + 1 + x] = rgba[y * width * 4 + x];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hexStr) {
  const s = hexStr.replace('#', '');
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

function lerpColor(c1, c2, t) {
  const cl = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * cl),
    Math.round(c1[1] + (c2[1] - c1[1]) * cl),
    Math.round(c1[2] + (c2[2] - c1[2]) * cl),
  ];
}

// Smooth anti-aliased HD surface
class HDSurface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  blend(x, y, rgb, alpha = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const idx = (y * this.w + x) * 4;
    const srcA = Math.max(0, Math.min(1, alpha));
    const dstA = this.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    this.data[idx] = Math.round((rgb[0] * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
    this.data[idx + 1] = Math.round((rgb[1] * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
    this.data[idx + 2] = Math.round((rgb[2] * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);
    this.data[idx + 3] = Math.round(outA * 255);
  }
  fillSmoothGradientCircle(cx, cy, r, cInner, cMid, cOuter) {
    const rgbIn = hexToRgb(cInner);
    const rgbMid = hexToRgb(cMid);
    const rgbOut = hexToRgb(cOuter);
    const minX = Math.max(0, Math.floor(cx - r - 2));
    const maxX = Math.min(this.w - 1, Math.ceil(cx + r + 2));
    const minY = Math.max(0, Math.floor(cy - r - 2));
    const maxY = Math.min(this.h - 1, Math.ceil(cy + r + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r + 1) continue;
        const aa = Math.max(0, Math.min(1, r + 0.5 - dist));
        // Offset highlight toward top-left
        const ldist = Math.hypot(x - (cx - r * 0.3), y - (cy - r * 0.3)) / (r * 1.35);
        const col =
          ldist < 0.45
            ? lerpColor(rgbIn, rgbMid, ldist / 0.45)
            : lerpColor(rgbMid, rgbOut, (ldist - 0.45) / 0.55);
        this.blend(x, y, col, aa);
      }
    }
  }
  save(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, encodePNG(this.w, this.h, this.data));
  }
}

const outDir = path.resolve('public/sprites');

// 1. Smooth HD Ores & Cores Sheet (64x64 per tile -> 320x256)
const oreDefs = [
  { id: 'coal', main: '#2d333b', hi: '#768390', rim: '#14171c' },
  { id: 'copper', main: '#e0722b', hi: '#ffbb8c', rim: '#6e2c09' },
  { id: 'iron', main: '#95a5b5', hi: '#edf5fc', rim: '#3c454f' },
  { id: 'silver', main: '#d0e2f2', hi: '#ffffff', rim: '#5b6d7d' },
  { id: 'gold', main: '#ffbf2e', hi: '#fff9c4', rim: '#825600' },
  { id: 'cobalt', main: '#2979ff', hi: '#a6c8ff', rim: '#0a3073' },
  { id: 'platinum', main: '#b8e6f2', hi: '#ffffff', rim: '#486c75' },
  { id: 'aquamarine', main: '#00e5ff', hi: '#d6ffff', rim: '#005b69' },
  { id: 'titanium', main: '#cfd8dc', hi: '#ffffff', rim: '#37474f' },
  { id: 'cryo_diamond', main: '#80f8ff', hi: '#ffffff', rim: '#007c8c' },
  { id: 'uranium', main: '#39ff14', hi: '#d7ffd0', rim: '#0d5200' },
  { id: 'ruby', main: '#ff1744', hi: '#ff9ead', rim: '#6b0014' },
  { id: 'mythril', main: '#b388ff', hi: '#f3e5f5', rim: '#3c0d73' },
  { id: 'painite', main: '#ff4081', hi: '#ffb299', rim: '#730a40' },
  { id: 'voidstone', main: '#d500f9', hi: '#ffffff', rim: '#290040' },
];

const oresSheet = new HDSurface(64 * 5, 64 * 4);
oreDefs.forEach((ore, idx) => {
  const tx = (idx % 5) * 64;
  const ty = Math.floor(idx / 5) * 64;
  const nodes = [
    { x: 22, y: 22, r: 10 },
    { x: 42, y: 25, r: 12 },
    { x: 30, y: 42, r: 11 },
    { x: 44, y: 44, r: 8.5 },
  ];
  nodes.forEach((n) => {
    oresSheet.fillSmoothGradientCircle(tx + n.x, ty + n.y, n.r, ore.hi, ore.main, ore.rim);
  });
});
// Row 4: Fuel cell + 3 Planet Cores
oresSheet.fillSmoothGradientCircle(32, 192 + 32, 20, '#b9f6ca', '#00e676', '#0a3d1c');
oresSheet.fillSmoothGradientCircle(64 + 32, 192 + 32, 24, '#ffffff', '#ffab00', '#ff3d00');
oresSheet.fillSmoothGradientCircle(128 + 32, 192 + 32, 24, '#ffffff', '#00e5ff', '#0069c0');
oresSheet.fillSmoothGradientCircle(192 + 32, 192 + 32, 24, '#ffffff', '#ff4081', '#7b1fa2');
oresSheet.save(path.join(outDir, 'ores_and_cores.png'));

// 2. Smooth HD Pods & Drills Sheet (96x96 per tile)
const podsSheet = new HDSurface(96 * 4, 96);
const podCols = [
  { hi: '#ffe082', main: '#f5a623', dark: '#8c5104', visor: '#00e5ff' },
  { hi: '#b2ebf2', main: '#00bcd4', dark: '#004d61', visor: '#ffffff' },
  { hi: '#f3e5f5', main: '#d500f9', dark: '#4a0072', visor: '#ff80ab' },
  { hi: '#fff59d', main: '#ff8f00', dark: '#bf360c', visor: '#84ffff' },
];
podCols.forEach((p, idx) => {
  const ox = idx * 96;
  podsSheet.fillSmoothGradientCircle(ox + 48, 38, 24, p.hi, p.main, p.dark);
  podsSheet.fillSmoothGradientCircle(ox + 48, 34, 11, '#ffffff', p.visor, '#0d1b24');
});
podsSheet.save(path.join(outDir, 'pods_and_drills.png'));

console.log('Updated smooth HD PNG sprite sheets in public/sprites/');
