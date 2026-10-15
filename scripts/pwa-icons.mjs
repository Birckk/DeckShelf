// Renders the PNG app icons in public/icons from the header mark, public/brand-familiar.svg,
// unchanged, on the app background. iOS needs a PNG apple-touch-icon; Android and desktop
// installs use the manifest icons. Usage: node scripts/pwa-icons.mjs
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const out = 'public/icons';
const background = '#111214';
const mark = await readFile('public/brand-familiar.svg', 'utf8');
// `mark` is the share of the square the logo fills. Maskable icons keep it inside the central safe zone.
const icons = [
  { file: 'apple-touch-icon.png', size: 180, mark: 0.72 },
  { file: 'icon-192.png', size: 192, mark: 0.76 },
  { file: 'icon-512.png', size: 512, mark: 0.76 },
  { file: 'maskable-512.png', size: 512, mark: 0.6 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const icon of icons) {
    const inner = Math.round(icon.size * icon.mark);
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(`<style>html,body{margin:0}
      div{width:${icon.size}px;height:${icon.size}px;display:grid;place-items:center;background:${background}}
      svg{width:${inner}px;height:${inner}px}</style><div>${mark}</div>`);
    await page.locator('div').screenshot({ path: `${out}/${icon.file}` });
  }
} finally {
  await browser.close();
}
