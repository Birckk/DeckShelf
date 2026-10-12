// Renders each illustration HTML in this folder to docs/images/<name>.webp at 2x.
// Usage: node scripts/illustrations/render.mjs [name]
import { chromium } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const names = process.argv[2] ? [process.argv[2]] : (await readdir(here)).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 2 });
  for (const name of names) {
    await page.goto(pathToFileURL(join(here, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
    const png = await page.locator('.frame').screenshot({ omitBackground: true });
    // Playwright only writes PNG/JPEG; let Chromium encode WebP, which keeps transparency at a fraction of the size.
    const webp = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', 0.88).split(',')[1];
    }, png.toString('base64'));
    await writeFile(join(here, '../../docs/images', `${name}.webp`), Buffer.from(webp, 'base64'));
    console.log(`docs/images/${name}.webp`);
  }
} finally {
  await browser.close();
}
