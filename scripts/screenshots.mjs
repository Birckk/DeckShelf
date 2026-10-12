// Regenerates the README screenshots from a fresh profile (precon demo only, no personal data).
// Usage: npm run dev (or npm start), then: node scripts/screenshots.mjs [baseURL]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:4317';
const out = 'docs/images';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const artworkLoaded = page => page.waitForFunction(() => {
  const images = [...document.images].filter(i => i.getBoundingClientRect().top < innerHeight);
  return images.length > 4 && images.every(i => i.complete && i.naturalWidth > 0);
}, null, { timeout: 30_000 });
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 });

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  await page.goto(base);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await artworkLoaded(page);
  await shot(page, 'collection');

  await desktop.close();

  const motion = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const helix = await motion.newPage();
  await helix.goto(base);
  await helix.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await artworkLoaded(helix);
  await helix.waitForTimeout(2500);
  await shot(helix, 'helix');
  await motion.close();

  const reveal = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const picker = await reveal.newPage();
  await picker.goto(base);
  await picker.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await picker.locator('.spin-button').click();
  await picker.getByRole('button', { name: /^View winning deck/ }).waitFor();
  await picker.waitForTimeout(1200);
  await shot(picker, 'picker');
  await reveal.close();

  console.log(`Screenshots written to ${out}/`);
} finally {
  await browser.close();
}
