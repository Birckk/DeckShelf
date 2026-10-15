// Renders the app icons from the header mark, public/brand-familiar.svg, unchanged on a charcoal tile.
// Windows and desktop installs get a rounded tile with transparent corners, like other apps on the
// taskbar; iOS and Android round or mask icons themselves, so theirs stay full-bleed squares. iOS needs a PNG apple-touch-icon; Android and desktop installs use the manifest
// icons in public/icons. The Windows build uses desktop/icon.ico for the exe, installer and
// shortcuts. Usage: node scripts/app-icons.mjs
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const out = 'public/icons';
const tile = '#111214';
const corner = 0.24;
const mark = await readFile('public/brand-familiar.svg', 'utf8');
// `mark` is the share of the square the logo fills. Maskable icons keep it inside the central safe zone.
const icons = [
  { file: 'apple-touch-icon.png', size: 180, mark: 0.72 },
  { file: 'icon-192.png', size: 192, mark: 0.82, rounded: true },
  { file: 'icon-512.png', size: 512, mark: 0.82, rounded: true },
  { file: 'maskable-512.png', size: 512, mark: 0.6 },
];
// Windows picks the closest size for each surface: 16–24 in lists and the title bar,
// 32–48 on the taskbar and Start menu, 256 for large Explorer views.
const windowsSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const windowsMark = 0.82;

async function render(page, size, share, rounded = false) {
  const inner = Math.round(size * share);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}
    div{width:${size}px;height:${size}px;display:grid;place-items:center;background:${tile};border-radius:${rounded ? size * corner : 0}px}
    svg{width:${inner}px;height:${inner}px}</style><div>${mark}</div>`);
  return page.locator('div').screenshot({ omitBackground: true });
}

// Reads a rendered PNG back as RGBA pixels, top row first.
async function pixels(page, png) {
  return Buffer.from(await page.evaluate(async base64 => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, image.width, image.height).data];
  }, png.toString('base64')));
}

// 32-bit DIB icon entry: BGRA rows bottom-up, then an AND mask marking the transparent corners
// for readers that ignore alpha.
function bitmap(size, rgba) {
  const header = Buffer.alloc(40);
  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  const body = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = ((size - 1 - y) * size + x) * 4;
      body[to] = rgba[from + 2];
      body[to + 1] = rgba[from + 1];
      body[to + 2] = rgba[from];
      body[to + 3] = rgba[from + 3];
      if (rgba[from + 3] === 0) mask[(size - 1 - y) * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([header, body, mask]);
}

// Small sizes are stored as bitmaps for older readers such as NSIS; 256 px as PNG.
function ico(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, data }, index) => {
    const at = 6 + index * 16;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map(entry => entry.data)]);
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const icon of icons) await writeFile(`${out}/${icon.file}`, await render(page, icon.size, icon.mark, icon.rounded));
  const entries = [];
  for (const size of windowsSizes) {
    const png = await render(page, size, windowsMark, true);
    entries.push({ size, data: size === 256 ? png : bitmap(size, await pixels(page, png)) });
  }
  await writeFile('desktop/icon.ico', ico(entries));
} finally {
  await browser.close();
}
