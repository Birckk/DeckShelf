import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import seed from '../fixtures/collection-decks.json' with { type: 'json' };
import precons from '../../src/data/precons.json' with { type: 'json' };

const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 2).map((deck, i) => ({ ...deck, id: String(990101 + i) }));
const current = { version: 1, added: decks, hidden: [], excluded: [] };
const replacement = { ...current, added: decks.slice(0, 1) };
const file = (value: unknown) => ({ name: 'collection.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
async function open(page: Page, raw = JSON.stringify(current), fault = '') {
  await page.addInitScript(({ key, raw, fault }) => {
    const state = window as typeof window & { readBlocked: boolean; writeBlocked: boolean };
    if (!sessionStorage.getItem('fixture')) { localStorage.setItem(key, raw); sessionStorage.setItem('fixture', '1'); }
    state.readBlocked = fault === 'read'; state.writeBlocked = fault === 'write';
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(k) { if (k === key && state.readBlocked) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, k); };
    Storage.prototype.setItem = function(k, v) { if (k === key && state.writeBlocked) throw new DOMException('Full', 'QuotaExceededError'); set.call(this, k, v); };
  }, { key, raw, fault });
  await page.goto('/');
}
async function manager(page: Page) { await page.getByRole('button', { name: 'Library', exact: true }).click(); }
async function upload(page: Page, value: unknown) { await page.locator('input[type=file]').setInputFiles(file(value)); }

test('corrupt raw data survives interaction and downloads exactly; session export stays valid', async ({ page }) => {
  const raw = '{broken data';
  await open(page, raw);
  await expect(page.getByRole('alert')).toContainText('data is damaged');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery data' }).click();
  expect(await readFile((await (await downloaded).path())!, 'utf8')).toBe(raw);
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  expect(JSON.parse(await readFile((await (await backup).path())!, 'utf8')).version).toBe(1);
  await manager(page);
  await page.getByRole('button', { name: 'Enable all', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  await upload(page, replacement);
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.result-count')).toContainText('1');
});

test('storage read errors never overwrite unread existing data or offer a false raw export', async ({ page }) => {
  await open(page, JSON.stringify(current), 'read');
  await expect(page.getByRole('alert')).toContainText('storage could not be read');
  await expect(page.getByRole('button', { name: 'Download recovery data' })).toHaveCount(0);
  await manager(page);
  await page.getByRole('button', { name: 'Enable all', exact: true }).click();
  await page.evaluate(() => { (window as any).readBlocked = false; });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(current);
});

test('failed writes preserve saved choices and allow an explicit retry', async ({ page }) => {
  await open(page, JSON.stringify(current), 'write');
  await expect(page.getByRole('alert')).toContainText('could not save');
  await manager(page);
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: /All saved decks/ }).click();
  await page.getByRole('checkbox', { name: `Show ${current.added[0].name}`, exact: true }).uncheck();
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).hidden).toEqual([]);
  const download = page.waitForEvent('download');
  await page.getByRole('main', { name: 'Library', exact: true }).getByRole('button', { name: 'Export backup', exact: true }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(exported.hidden).toContain(current.added[0].id);
  await page.evaluate(() => { (window as any).writeBlocked = false; });
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).hidden).toContain(current.added[0].id);
  await page.reload();
  await expect(page.locator('.result-count')).toContainText('1');
});

test('failed restore leaves current memory and storage intact, keeps preview, and can retry', async ({ page }) => {
  await open(page); await manager(page); await upload(page, replacement);
  await page.evaluate(() => { (window as any).writeBlocked = true; });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('backup could not be saved');
  await expect(page.locator('.workspace-heading')).toContainText('2 on display');
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).added).toHaveLength(2);
  await expect(page.getByRole('region', { name: 'Restore collection backup' })).toBeVisible();
  await page.evaluate(() => { (window as any).writeBlocked = false; });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('1 on display');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.result-count')).toContainText('1');
});

for (const [label, value] of [['invalid JSON', '{'], ['invalid deck data', { ...replacement, added: [{}] }], ['unsupported version', { ...replacement, version: 2 }], ['oversized file', ' '.repeat(5_000_001)]] as const) {
  test(`${label} clears a previous valid restore preview without replacing current choices`, async ({ page }) => {
    await open(page); await manager(page); await upload(page, replacement);
    await expect(page.getByRole('region', { name: 'Restore collection backup' })).toBeVisible();
    await upload(page, value);
    await expect(page.getByRole('region', { name: 'Restore collection backup' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).added).toHaveLength(2);
  });
}
for (const [width, height] of [[1920, 1080], [1500, 900], [390, 844]]) test(`recovery controls remain visible at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  await open(page, '{broken');
  await page.screenshot({ path: `.codex-shots/recovery-${width}.png` });
  await manager(page);
  await page.screenshot({ path: `.codex-shots/backup-controls-${width}.png`, fullPage: true });
  await upload(page, replacement);
  await expect(page.getByRole('region', { name: 'Restore collection backup' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.codex-shots/restore-${width}.png`, fullPage: true });
  await page.goto('/help/saving');
  await expect(page.getByRole('heading', { name: 'Saving and devices', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.codex-shots/saving-help-${width}.png`, fullPage: true });
  await page.goto('/help/faq');
  await page.getByText('What if my collection cannot be saved or read?', { exact: true }).click();
  await expect(page.locator('details').filter({ hasText: 'What if my collection cannot be saved or read?' }).getByRole('link', { name: /Saving and devices/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.codex-shots/recovery-faq-${width}.png`, fullPage: true });
});

for (const [width, height] of [[1920, 1080], [1500, 900], [390, 844]]) test(`failed restore stays visible below a long collection at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  const longCollection = { ...current, added: Array.from({ length: 80 }, (_, i) => ({ ...decks[i % decks.length], id: String(991000 + i) })) };
  await open(page, JSON.stringify(longCollection)); await manager(page);
  const sources = page.getByRole('button', { name: 'Sources and folders', exact: true });
  if (await sources.isVisible()) await sources.click();
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: /All saved decks/ }).click();
  await upload(page, replacement);
  const region = page.getByRole('region', { name: 'Restore collection backup' });
  await expect(region).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(height);
  const restoreButton = region.getByRole('button', { name: 'Restore this backup', exact: true });
  await page.evaluate(() => { (window as any).writeBlocked = true; });
  await restoreButton.focus(); await restoreButton.press('Enter');
  await expect(region.getByRole('alert')).toContainText('backup could not be saved');
  await expect(region.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await expect(restoreButton).toBeInViewport({ ratio: 1 });
  await expect(restoreButton).toBeFocused();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(longCollection);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.codex-shots/failed-restore-${width}.png` });
  await region.getByRole('button', { name: 'Cancel restore', exact: true }).click();
  await upload(page, replacement);
  await expect(region.getByRole('alert')).toHaveCount(0);
  await restoreButton.click();
  await expect(region.getByRole('alert')).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => { (window as any).writeBlocked = false; });
  await restoreButton.click();
  await expect(region).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.result-count')).toContainText('1');
});

test('export stays collection-only and cancelling or restoring preserves display preferences', async ({ page }) => {
  const displayKey = 'commander-archive.display.v1';
  const display = { layout: 'list', size: 2 };
  await page.addInitScript(({ displayKey, display }) => localStorage.setItem(displayKey, JSON.stringify(display)), { displayKey, display });
  await open(page); await manager(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  expect(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).toEqual(current);
  await upload(page, replacement);
  await expect(page.getByRole('region', { name: 'Restore collection backup' })).toContainText('does not merge');
  await page.getByRole('button', { name: 'Cancel restore', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(current);
  await upload(page, replacement);
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), displayKey)).toEqual(display);
});

test('a restored backup loads details again for a deck that already loaded once', async ({ page }) => {
  const full = decks[0];
  const partial = { ...full, partial: true as const, description: '', tags: [] };
  const profile = { ...current, added: [partial, decks[1]] };
  let requests = 0;
  await page.route(`**/api/decks/${full.id}`, route => { requests++; return route.fulfill({ json: full }); });
  await open(page, JSON.stringify(profile));
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added[0].partial ?? false, key);
  await expect.poll(stored).toBe(false);
  await manager(page); await upload(page, profile);
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(stored).toBe(false);
});

for (const [label, profile, count] of [
  ['older precon snapshot', { version: 1, added: [], hidden: [], excluded: [], demo: { removed: false, snapshotAt: precons.snapshotAt, decks: precons.decks.slice(0, 2) } }, 2],
] as const) test(`${label} restores and reloads without silently expanding to the current catalog`, async ({ page }) => {
  await open(page); await manager(page); await upload(page, profile);
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await page.reload();
  await expect(page.locator('.result-count')).toHaveText(`${count} decks`);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(profile);
});

test('a slow earlier file cannot replace a newer rejected file', async ({ page }) => {
  await open(page); await manager(page);
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = function() {
      if (this.name !== 'slow.json') return read.call(this);
      return new Promise<string>(resolve => { (window as any).releaseFile = () => read.call(this).then(resolve); });
    };
  });
  await page.locator('input[type=file]').setInputFiles({ ...file(replacement), name: 'slow.json' });
  await upload(page, '{');
  await expect(page.getByRole('alert')).toBeVisible();
  const error = await page.getByRole('alert').textContent();
  await page.evaluate(() => (window as any).releaseFile());
  await expect(page.getByRole('region', { name: 'Restore collection backup' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText(error!);
});
