import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

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
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await expect(page).toHaveTitle('DeckShelf');
    await expect(page.getByRole('link', { name: 'DeckShelf home' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My collection/ })).toBeVisible();
    await page.goto(new URL('/help/about', base).href);
    await expect(page.getByText('Your decks, ready for game night.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to collection' }).click();
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `qa/web/${viewport.width}.png`, fullPage: false });
    await context.close();
  }
  expect(errors).toEqual([]);
  console.log('Web smoke passed: health, routes, desktop and mobile collection.');
} finally {
  await browser.close();
}
