import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
import { mkdir } from 'node:fs/promises';

const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 7);
const profile = { version: 1, starter: false, hidden: [], excluded: [], added: decks, manualIds: decks.map(d => d.id) };

// Settings folds its groups into rows; open the ones a test uses. Open rows are remembered across visits.
const unfoldSettings = async (page: Page) => {
  for (const name of [/^Card backs/, /^Artwork/]) {
    const row = page.getByRole('button', { name });
    if (await row.getAttribute('aria-expanded') === 'false') await row.click();
  }
};
const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const menu = page.locator('.help-mobile-toggle');
  if (await menu.isVisible()) await menu.click(); // Phones list Help's sections behind a menu.
  await page.getByRole('navigation', { name: 'Help sections' }).getByRole('link', { name: 'Settings', exact: true }).click();
  await unfoldSettings(page);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, profile }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(profile));
  }, { key, profile });
  await page.route(/\/(images\/|.*cards\.scryfall\.io\/)/, route => route.abort());
});

test('Settings in Help supports keyboard selection, reload, history and v1 backup restore', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/help\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
  await unfoldSettings(page);
  const nest = page.getByRole('radio', { name: 'Dragon nest Default' });
  const wedges = page.getByRole('radio', { name: 'Art deco wedges' });
  await expect(nest).toBeChecked();
  await nest.focus();
  await page.keyboard.press('ArrowRight');
  await expect(wedges).toBeChecked();
  const samples = page.locator('.card-back-option').last().locator('svg.identity-art');
  await expect(samples).toHaveCount(4);
  for (const [i, count] of [1, 2, 5, 0].entries()) await expect(samples.nth(i).locator('[data-on]')).toHaveCount(count);
  await expect(samples.last().locator('[data-slot="C"]')).toHaveCount(1);
  await page.reload();
  await expect(wedges).toBeChecked();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page).toHaveURL(/\/help\/start$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/help\/settings$/);
  await expect(wedges).toBeChecked();
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  await expect(page.locator('.collection-card [data-card-back="wedges"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const backup = await download;
  const stream = await backup.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const saved = JSON.parse(Buffer.concat(chunks).toString());
  expect(saved.version).toBe(1);
  expect(saved.cardBack).toBe('wedges');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...saved, cardBack: 'nest' })) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await openSettings(page);
  await expect(nest).toBeChecked();
});

for (const [width, height] of [[1920, 1080], [1500, 900], [390, 844]]) {
  test(`card backs across views at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/help/settings');
    await unfoldSettings(page);
    await page.getByRole('radio', { name: 'Art deco wedges' }).check();
    await mkdir('.codex-shots', { recursive: true });
    await page.screenshot({ path: `.codex-shots/settings-${width}.png`, fullPage: true });
    for (const [view, selector] of [['Collection', '.collection-card'], ['Cards', '.studio-card'], ['Pick a deck', '.helix-card']]) {
      await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: view, exact: true }).click();
      await expect(page.locator(`${selector} [data-card-back="wedges"]`).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.codex-shots/${view.replaceAll(' ', '-')}-${width}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await page.getByRole('button', { name: `View ${decks[0].name}`, exact: true }).click();
    await expect(page.locator('dialog [data-card-back="wedges"]').first()).toBeVisible();
    await page.screenshot({ path: `.codex-shots/details-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    await expect(page.locator('.collection-box [data-card-back="wedges"]').first()).toBeVisible();
    await page.screenshot({ path: `.codex-shots/collections-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Open Individual decks', exact: true }).click();
    await expect(page.locator('.workspace-tile [data-card-back="wedges"]').first()).toBeVisible();
    await page.screenshot({ path: `.codex-shots/saved-decks-${width}.png`, fullPage: true });
  });
}
for (const width of [1920, 390]) {
  test(`utility pages keep shared search and filters at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    for (const path of ['/settings', '/help/start']) {
      await page.goto(path);
      const search = page.getByRole('textbox', { name: 'Search decks', exact: true });
      await expect(search).toBeVisible();
      await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
      await search.pressSequentially('Giada');
      await expect(page).toHaveURL(/\/$/);
      await expect(search).toHaveValue('Giada');
      await expect(search).toBeFocused();
      await expect(page.locator('.collection-card')).toHaveCount(1);
      await page.goto(path);
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByLabel('Number of colors', { exact: true }).selectOption('5');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByLabel('Number of colors', { exact: true })).toHaveValue('5');
      await expect(page.locator('.collection-card')).toHaveCount(0);
    }
    await page.goto('/help/start');
    await mkdir('.codex-shots', { recursive: true });
    await page.screenshot({ path: `.codex-shots/help-search-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`unsaved source entries with no image use the chosen card back at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    await page.goto('/settings');
    await unfoldSettings(page);
    await page.getByRole('radio', { name: 'Art deco wedges' }).check();
    await page.evaluate(key => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.sources = [{ key: 'folder:123', kind: 'folder', value: '123', name: 'Empty artwork', url: 'https://archidekt.com/folders/123', checkedAt: new Date().toISOString(), knownIds: ['987654'], selectedIds: [], entries: [{ id: '987654', name: 'Unsaved deck', image: '', colors: ['U', 'R'] }] }];
      localStorage.setItem(key, JSON.stringify(saved));
    }, key);
    await page.reload();
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    await page.getByRole('button', { name: 'Open Empty artwork', exact: true }).click();
    const tile = page.locator('.workspace-tile').filter({ hasText: 'Unsaved deck' });
    await expect(tile.locator('[data-card-back="wedges"]')).toBeVisible();
    await expect(tile.locator('[data-on]')).toHaveCount(2);
    await expect(tile.locator('img')).toHaveCount(2); // Mana icons only; no empty image request.
    await page.screenshot({ path: `.codex-shots/empty-art-${width}.png`, fullPage: true });
    await openSettings(page);
    await page.getByRole('radio', { name: 'Dragon nest Default' }).check();
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    await expect(tile.locator('[data-card-back="nest"]')).toBeVisible();
  });
}

test('Help, including Settings, returns to the previous browsing view', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('group', { name: 'Collection view' });
  for (const view of ['Cards', 'Pick a deck']) {
    await nav.getByRole('button', { name: view, exact: true }).click();
    await openSettings(page);
    await expect(page).toHaveURL(/\/help\/settings$/);
    await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
    await expect(nav.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  }
});


test('Show card backs instead of artwork stops every artwork request and survives reload', async ({ page }) => {
  const art: string[] = [];
  page.on('request', r => { if (/\/images\/|cards\.scryfall\.io/.test(r.url())) art.push(r.url()); });
  await page.goto('/help/settings');
  await unfoldSettings(page);
  const toggle = page.getByRole('checkbox', { name: /Show card backs instead of artwork/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.reload();
  await expect(toggle).toBeChecked();
  art.length = 0;
  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.locator('.collection-card [data-card-back]').first()).toBeVisible();
  await expect(page.locator('.collection-card img:not(.mana)')).toHaveCount(0);
  for (const view of ['Cards', 'Pick a deck']) {
    await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: view, exact: true }).click();
    await expect(page.locator('[data-card-back]').first()).toBeVisible();
  }
  await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByRole('button', { name: `View ${decks[0].name}`, exact: true }).click();
  await expect(page.locator('dialog [data-card-back]').first()).toBeVisible();
  expect(art).toEqual([]);
});

test('Settings folds into one row per group that shows its value, opens from the keyboard and stays open', async ({ page }) => {
  await page.goto('/settings');
  const rows = page.locator('.settings-fold h3 button');
  await expect(rows).toHaveCount(4);
  expect(await rows.evaluateAll(els => els.map(el => el.getAttribute('aria-expanded')))).toEqual(['false', 'false', 'false', 'false']);
  await expect(rows.nth(0)).toContainText('Dragon nest');
  await expect(rows.nth(1)).toContainText('Commander artwork');
  await expect(rows.nth(2)).toContainText('6 columns · Colors on phones · Square thumbnail');
  await expect(rows.nth(3)).toContainText('Added automatically');
  await rows.nth(2).focus();
  await page.keyboard.press('Enter');
  await expect(rows.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('radio', { name: 'Release' }).check();
  await expect(rows.nth(2)).toContainText('Release on phones');
  await page.reload();
  await expect(rows.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('radio', { name: 'Release' })).toBeChecked();
  await rows.nth(2).click();
  await expect(page.getByRole('radio', { name: 'Release' })).toHaveCount(0);
});
