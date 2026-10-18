import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };

const collectionKey = 'commander-archive.collection.v1';
const shelfKey = 'commander-archive.display.v1';
const managerKey = 'commander-archive.manager-display.v1';
const decks = seed.slice(0, 12);
const fixture = { version: 1, starter: false, added: decks, hidden: [], excluded: [], sources: [], manualIds: decks.map(d => d.id) };
const openManager = async (page: Page, phone = false) => {
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  if (phone) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: /All saved decks/ }).click();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: collectionKey, fixture });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

for (const [width, height] of [[1920, 1080], [1500, 900], [390, 844], [320, 844]]) {
  test(`shared controls and full-width captions at ${width}px`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height });
    for (const surface of ['shelf', 'manager']) {
      if (surface === 'manager') await openManager(page, width <= 700);
      const controls = page.locator('.shared-view-controls');
      await expect(controls.locator('.collection-layout-switch button')).toHaveText(['Details', 'Cards only', 'Compact', 'List']);
      if (width <= 700) {
        const switchBox = (await controls.locator('.collection-layout-switch').boundingBox())!;
        const toggleBox = (await controls.getByRole('button', { name: 'Size and sort' }).boundingBox())!;
        expect(toggleBox.height).toBeCloseTo(switchBox.height, 0);
        expect(toggleBox.y).toBeCloseTo(switchBox.y, 0);
        // Narrow phones show four equal icon buttons; the active one must not widen.
        if (width < 380) {
          const widths = await controls.locator('.collection-layout-switch button').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
          expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
        }
      }
      const slider = controls.getByRole('slider', { name: 'Collection item size' });
      const sort = controls.getByRole('combobox', { name: 'Sort decks' });
      if (width <= 700) {
        await expect(slider).toBeHidden();
        await expect(sort).toBeHidden();
        await controls.getByRole('button', { name: 'Size and sort' }).click();
      }
      await expect(slider).toBeVisible();
      await expect(sort).toBeVisible();
      await slider.focus();
      await page.keyboard.press('End');
      await expect(slider).toHaveValue('2');
      await expect(slider).toHaveAttribute('aria-valuetext', 'Large');
      await page.keyboard.press('Home');
      await expect(slider).toHaveAttribute('aria-valuetext', 'Small');
      const firstTile = page.locator(surface === 'manager' ? '.workspace-tile' : '.collection-tile').first();
      const smallWidth = (await firstTile.boundingBox())!.width;
      await page.screenshot({ path: `.codex-shots/${surface}-small-${width}.png` });
      await page.keyboard.press('ArrowRight');
      await expect(slider).toHaveAttribute('aria-valuetext', 'Medium');
      if (width > 320) expect((await firstTile.boundingBox())!.width).toBeGreaterThan(smallWidth);
      await expect(sort.locator('option')).toHaveText(['Collection order', 'Name: A–Z', 'Newest releases', 'Number of colors']);
      if (width <= 700) await controls.getByRole('button', { name: 'Size and sort' }).click();
      for (const [name, layout] of [['Details', 'grid'], ['Cards only', 'art'], ['Compact', 'compact'], ['List', 'list']]) {
        await controls.getByRole('button', { name, exact: true }).click();
        const tiles = page.locator(surface === 'manager' ? '.workspace-tile' : '.collection-tile');
        await expect(tiles).toHaveCount(decks.length);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (surface === 'manager') {
          const checkbox = tiles.first().getByRole('checkbox');
          const link = tiles.first().getByRole('link');
          await link.focus();
          await page.keyboard.press('Tab');
          await expect(checkbox).toBeFocused();
          expect(await checkbox.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
          // WebKit's default keyboard navigation skips links, so focus the link directly there.
          if (browserName === 'webkit') await link.focus();
          else await page.keyboard.press('Shift+Tab');
          await expect(link).toBeFocused();
          expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
          if (layout === 'grid' || layout === 'list') {
            const title = await tiles.first().locator('h4').boundingBox();
            const tile = await tiles.first().boundingBox();
            const actions = await tiles.first().locator('.workspace-tile-controls').boundingBox();
            if (layout === 'grid') expect(title!.width).toBeCloseTo(tile!.width, 0);
            expect(title!.y >= actions!.y + actions!.height || title!.y + title!.height <= actions!.y).toBe(true);
          }
        }
        await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); scrollTo(0, 0); });
        await page.screenshot({ path: `.codex-shots/${surface}-${layout}-${width}.png` });
      }
      if (width <= 700) {
        await controls.getByRole('button', { name: 'Size and sort' }).click();
        await page.screenshot({ path: `.codex-shots/${surface}-options-${width}.png` });
      }
    }
  });
}

test('layout and size persist independently across visits and reloads without changing collection data', async ({ page }) => {
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await page.getByRole('slider', { name: 'Collection item size' }).fill('0');
  await openManager(page);
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider')).toHaveValue('1');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('slider').fill('2');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider')).toHaveValue('0');
  await openManager(page);
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider')).toHaveValue('2');
  await page.reload();
  await expect(page.getByRole('slider')).toHaveValue('0');
  await openManager(page);
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider')).toHaveValue('2');
  const saved = await page.evaluate(keys => keys.map(key => JSON.parse(localStorage.getItem(key)!)), [shelfKey, managerKey, collectionKey]);
  expect(saved.slice(0, 2)).toEqual([{ layout: 'grid', size: 0 }, { layout: 'list', size: 2 }]);
  expect(saved[2].added).toEqual(decks);
  expect(saved[2].hidden).toEqual([]);
});

test('My collection reuses sorting without changing selection or source order', async ({ page }) => {
  await openManager(page);
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  const names = page.locator('.workspace-tile h4');
  const sort = page.getByRole('combobox', { name: 'Sort decks' });
  for (const order of ['name', 'release', 'colors', 'collection']) {
    await sort.selectOption(order);
    const expected = [...decks].sort((a, b) => order === 'name' ? a.name.localeCompare(b.name)
      : order === 'release' ? b.releasedAt.localeCompare(a.releasedAt)
      : order === 'colors' ? a.colors.length - b.colors.length || a.name.localeCompare(b.name) : 0);
    await expect(names).toHaveText(expected.map(d => d.name));
    await expect(page.locator('.workspace-tile input:checked')).toHaveCount(decks.length);
  }
});

for (const value of ['{broken', JSON.stringify({ layout: 'mosaic', size: 200 })]) {
  test(`invalid display preferences fall back safely: ${value}`, async ({ page }) => {
    await page.evaluate(({ shelfKey, managerKey, value }) => {
      localStorage.setItem(shelfKey, value); localStorage.setItem(managerKey, value);
    }, { shelfKey, managerKey, value });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Cards only', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('slider')).toHaveValue('1');
    await openManager(page);
    await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('slider')).toHaveValue('1');
  });
}

test('display controls work when browser storage rejects access', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.includes('display.v1')) throw new Error('Storage unavailable'); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.includes('display.v1')) throw new Error('Storage unavailable'); return set.call(this, key, value); };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openManager(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('slider').fill('2');
  await expect(page.getByRole('slider')).toHaveValue('2');
});

test('Select all reflects and sets the selection of the current results', async ({ page }) => {
  await openManager(page);
  const all = page.getByRole('checkbox', { name: 'Select all', exact: true });
  await expect(all).toBeChecked();
  await page.locator('.workspace-tile').first().getByRole('checkbox').uncheck();
  expect(await all.evaluate(el => (el as HTMLInputElement).indeterminate)).toBe(true);
  await all.click();
  await expect(all).toBeChecked();
  await expect(page.locator('.workspace-tile input:checked')).toHaveCount(decks.length);
  await all.click();
  await expect(all).not.toBeChecked();
  await expect(page.locator('.workspace-tile input:checked')).toHaveCount(0);
});

test('switching to a layout with other artwork starts each picture fresh', async ({ page }) => {
  // Chrome keeps painting an <img>'s old picture until a new src loads, which showed
  // full cards squeezed into Compact's squares. A fresh element shows the tile background instead.
  for (const surface of ['shelf', 'manager']) {
    if (surface === 'manager') await openManager(page);
    const images = page.locator(surface === 'manager' ? '.workspace-tile-art > img' : '.collection-card > img');
    await page.getByRole('button', { name: 'Cards only', exact: true }).click();
    await images.evaluateAll(imgs => imgs.forEach(img => img.setAttribute('data-old', '')));
    await page.getByRole('button', { name: 'Compact', exact: true }).click();
    await expect(images.first()).toBeVisible();
    expect(await images.evaluateAll(imgs => imgs.filter(img => img.hasAttribute('data-old')).length)).toBe(0);
  }
});
