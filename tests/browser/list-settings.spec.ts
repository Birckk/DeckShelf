import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };

const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 6);
const fixture = { version: 1, starter: false, added: decks, hidden: [], excluded: [], sources: [], manualIds: decks.map(d => d.id) };
const saved = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
// Visible column titles, leaving out the artwork, Shown and link columns that only have screen-reader names.
const headers = (page: Page) => page.getByRole('table').locator('thead th:visible:not(:has(> .sr-only))').allInnerTexts();

// Settings folds its groups; open List when it is closed (folds are remembered between visits).
async function openListSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const fold = page.getByRole('button', { name: /^List/ });
  if (await fold.count() && await fold.getAttribute('aria-expanded') === 'false') await fold.click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    localStorage.setItem('commander-archive.display.v1', JSON.stringify({ layout: 'list', size: 1 }));
    localStorage.setItem('commander-archive.manager-display.v1', JSON.stringify({ layout: 'list', size: 1 }));
  }, { key, fixture });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Settings › List chooses the table columns, phone column and row artwork on both pages', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/');
  expect(await headers(page)).toEqual(['Name', 'Commander', 'Colors', 'Tags', 'Release']);
  expect((await saved(page)).list).toBeUndefined();

  await openListSettings(page);
  const list = page.getByRole('group', { name: 'List' });
  await expect(list.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
  await list.getByRole('checkbox', { name: 'Commander' }).uncheck();
  await list.getByRole('checkbox', { name: 'Collection' }).check();
  await list.getByRole('radio', { name: 'Release' }).check();
  await list.getByRole('radio', { name: 'Wide art strip' }).check();
  // Keyboard focus shows on the whole choice.
  await list.getByRole('checkbox', { name: 'Commander' }).focus();
  await page.keyboard.press('Tab');
  await expect(list.getByRole('checkbox', { name: 'Colors' })).toBeFocused();
  expect(await list.getByRole('checkbox', { name: 'Colors' }).evaluate(el => getComputedStyle(el.closest('label')!).outlineStyle)).toBe('solid');
  expect((await saved(page)).list).toEqual({ columns: ['colors', 'format', 'tags', 'release', 'collection'], phoneColumn: 'release', art: 'strip' });

  for (const surface of ['shelf', 'manager']) {
    await page.goto('/');
    if (surface === 'manager') {
      await page.getByRole('button', { name: 'My collection', exact: true }).click();
      await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: /All saved decks/ }).click();
    }
    const table = page.getByRole('table');
    expect(await headers(page)).toEqual(['Name', 'Colors', 'Tags', 'Release', 'Collection']);
    const row = table.locator('tbody tr').first();
    // Without a Commander column the commander sits under the name, and the strip replaces the square.
    await expect(row.locator('.deck-table-sub')).toBeVisible();
    await expect(row.locator('.deck-table-sub')).toHaveText(decks[0].commanders[0].name);
    await expect(row.locator('.deck-table-collection')).toHaveText('Individual decks');
    // The Collection column sorts from its header, like the others.
    const collection = table.getByRole('columnheader', { name: 'Collection' });
    await collection.getByRole('button').click();
    await expect(collection).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('select[aria-label="Sort decks"]')).toHaveValue('collection-name');
    await page.locator('select[aria-label="Sort decks"]').selectOption('collection');
    const art = (await row.locator('.deck-table-art img').boundingBox())!;
    expect(art.width).toBeGreaterThan(art.height * 2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  // Phones show the chosen column instead of colors.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await headers(page)).toEqual(['Name', 'Release']);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // No artwork drops the column; going back to the defaults saves nothing again.
  await page.setViewportSize({ width: 1500, height: 900 });
  await openListSettings(page);
  await list.getByRole('radio', { name: 'No artwork' }).check();
  await page.goto('/');
  await expect(page.getByRole('table').locator('.deck-table-art')).toHaveCount(0);
  await openListSettings(page);
  await list.getByRole('checkbox', { name: 'Commander' }).check();
  await list.getByRole('checkbox', { name: 'Collection' }).uncheck();
  await list.getByRole('radio', { name: 'Colors' }).check();
  await list.getByRole('radio', { name: 'Square thumbnail' }).check();
  expect((await saved(page)).list).toBeUndefined();
});
