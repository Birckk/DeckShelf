import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4319';
await expect.poll(async () => {
  try { return (await fetch(`${base}/healthz`)).status; } catch { return 0; }
}).toBe(200);
const health = await fetch(`${base}/healthz`);
expect(health.status).toBe(200);
expect(await health.json()).toEqual({ status: 'ok' });
expect((await fetch(`${base}/api/unknown`)).status).toBe(404);
expect((await fetch(`${base}/missing.js`)).status).toBe(404);
expect((await fetch(base, { method: 'POST' })).status).toBe(405);
const browser = await chromium.launch();
const errors = [];
await mkdir('qa/web', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const phone = viewport.width < 768;
    const context = await browser.newContext({ viewport, hasTouch: phone, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await expect(page).toHaveTitle('DeckShelf');
    await expect(page.getByRole('link', { name: 'DeckShelf home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible();
    // Only phones and tablets can install the site; desktop browsers don't offer it.
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(phone ? 1 : 0);
    await page.goto(new URL('/help/about', base).href);
    await expect(page.getByText('Your decks, ready for game night.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to collection' }).click();
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `qa/web/${viewport.width}.png`, fullPage: false });
    await context.close();
  }
  await offlineSmoke(browser);
  expect(errors).toEqual([]);
  console.log('Web smoke passed: health, routes, desktop and mobile collection, offline shell and update.');
} finally {
  await browser.close();
}

// Installable shell: a previously loaded app opens offline with artwork it has shown, sources
// are never served from cache, and an update waits for Reload. The update step needs a server reading this checkout's dist/.
async function offlineSmoke(browser) {
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  expect(manifest.headers.get('content-type')).toContain('application/manifest+json');
  const { display, icons } = await manifest.json();
  expect(display).toBe('standalone');
  for (const { src } of icons) expect((await fetch(base + src)).status, src).toBe(200);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Chrome's install banner stays away; installing is left to the browser menu.
  expect(await page.evaluate(() => !dispatchEvent(new Event('beforeinstallprompt', { cancelable: true })))).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const loadedArt = () => page.locator('img[src^="https://cards.scryfall.io/"]').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth > 0).length);
  await expect.poll(loadedArt).toBeGreaterThan(3);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('deckshelf-art-v1')).keys()).length)).toBeGreaterThan(3);
  // Without the browser's HTTP cache, offline artwork can only come from the worker's art cache.
  await (await context.newCDPSession(page)).send('Network.clearBrowserCache');
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('DeckShelf');
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible();
  await expect.poll(loadedArt).toBeGreaterThan(3);
  expect(await page.evaluate(async () => (await fetch('/brand-familiar.svg')).ok)).toBe(true);
  expect(await page.evaluate(() => fetch('/api/decks/1').then(() => 'served', () => 'network'))).toBe('network');
  await context.setOffline(false);
  const file = new URL('../dist/sw.js', import.meta.url);
  const original = await readFile(file, 'utf8').catch(() => null);
  if (original !== null && original === await (await fetch(`${base}/sw.js`)).text()) {
    try {
      await writeFile(file, original.replace(/const VERSION = "(\w+)"/, 'const VERSION = "$1-next"'));
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload', exact: true }).click()]);
      // The old shell is removed; viewed artwork survives the update.
      await expect.poll(() => page.evaluate(async () => (await caches.keys()).sort())).toEqual(['deckshelf-art-v1', expect.stringMatching(/^deckshelf-shell-.*-next$/)]);
    } finally {
      await writeFile(file, original);
    }
  }
  await context.close();
}
