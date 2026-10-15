// Generates the PWA PNG icons with no dependencies (raw RGBA + zlib).
// Usage: npm run icons
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const BRAND = [108, 142, 245, 255];
const WHITE = [255, 255, 255, 255];
const GOLD = [245, 196, 67, 255];
const TRANSPARENT = [0, 0, 0, 0];

/** Gift shape in a unit square (0..1). Returns a color or null. */
function gift(x, y) {
  const inRect = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const inCircle = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const ribbon = inRect(0.45, 0.3, 0.55, 0.85) || inRect(0.15, 0.3, 0.85, 0.42);
  if (
    (inCircle(0.38, 0.24, 0.09) && !inCircle(0.38, 0.24, 0.04)) ||
    (inCircle(0.62, 0.24, 0.09) && !inCircle(0.62, 0.24, 0.04))
  ) {
    return GOLD;
  }
  if (ribbon) return GOLD;
  if (inRect(0.2, 0.42, 0.8, 0.85)) return WHITE;
  return null;
}

function render(size, { padding = 0, background = BRAND, foreground = null, radius = 0 }) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (px + (sx + 0.5) / samples) / size;
          const v = (py + (sy + 0.5) / samples) / size;
          let color = background;
          if (radius > 0) {
            const dx = Math.max(radius - u, 0, u - (1 - radius));
            const dy = Math.max(radius - v, 0, v - (1 - radius));
            if (dx * dx + dy * dy > radius * radius) color = TRANSPARENT;
          }
          const gx = (u - padding) / (1 - 2 * padding);
          const gy = (v - padding) / (1 - 2 * padding);
          const g = gift(gx, gy);
          if (g && color !== TRANSPARENT) color = foreground ?? g;
          else if (g && background === TRANSPARENT) color = foreground ?? g;
          for (let c = 0; c < 4; c++) acc[c] += color[c];
        }
      }
      const offset = (py * size + px) * 4;
      for (let c = 0; c < 4; c++) pixels[offset + c] = Math.round(acc[c] / (samples * samples));
    }
  }
  return encodePng(size, size, pixels);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const icons = {
  "icon-192.png": render(192, { padding: 0.12, radius: 0.18 }),
  "icon-512.png": render(512, { padding: 0.12, radius: 0.18 }),
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  "icon-maskable-512.png": render(512, { padding: 0.22 }),
  "apple-touch-icon.png": render(180, { padding: 0.14 }),
  // Monochrome notification badge (Android uses only the alpha channel).
  "badge-96.png": render(96, { padding: 0.08, background: TRANSPARENT, foreground: WHITE }),
};

for (const [name, data] of Object.entries(icons)) {
  writeFileSync(new URL(name, OUT), data);
  console.log(`public/icons/${name}`);
}
