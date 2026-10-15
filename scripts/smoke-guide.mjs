import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:4319';
const browser = await chromium.launch();
await mkdir('qa/guide', { recursive: true });
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(base);
    const nav = page.getByRole('group', { name: 'Collection view' });
    const collection = nav.getByRole('button', { name: 'Collection', exact: true });
    await expect(collection).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    for (const name of ['Cards', 'Pick a deck']) {
      await nav.getByRole('button', { name, exact: true }).click();
      await page.getByRole('link', { name: 'DeckShelf home' }).click();
      await expect(collection).toHaveAttribute('aria-pressed', 'true');
      await expect(nav.locator('[aria-pressed="true"]')).toHaveCount(1);
    }
    // Help replaces Guide and About at every width; the guide is its Start here section.
    const trigger = page.getByRole('button', { name: 'Help', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/help\/start$/);
    const bounds = [];
    for (let step = 0; step < 3; step++) {
      await page.waitForFunction(() => [...document.querySelectorAll('.guide-picture img')].every(i => i.complete && i.naturalWidth > 0));
      bounds.push(await page.evaluate(() => {
        const d = document.querySelector('.collection-guide').getBoundingClientRect();
        return [d.x, d.y, d.width, d.height, document.querySelector('.guide-actions').getBoundingClientRect().y];
      }));
      await page.screenshot({ path: `qa/guide/${width}-${step}.png` });
      if (step < 2) await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    expect(bounds[0]).toEqual(bounds[1]);
    expect(bounds[0]).toEqual(bounds[2]);
    const saved = await page.evaluate(() => localStorage.getItem('commander-archive.collection.v1'));
    await page.getByRole('button', { name: 'View official precons', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('commander-archive.collection.v1'))).toBe(saved);
    await context.close();
    console.log(`${width}px: Help guide, stable geometry, catalog preservation and home navigation passed`);
  }
} finally { await browser.close(); }
