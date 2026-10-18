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
      await expect(sort.locator('option')).toHaveText(['Collection order', 'Name', 'Commander', 'Release', 'Colors', 'Format', 'Collection name']);
      if (width <= 700) await controls.getByRole('button', { name: 'Size and sort' }).click();
      for (const [name, layout] of [['Details', 'grid'], ['Cards only', 'art'], ['Compact', 'compact'], ['List', 'list']]) {
        await controls.getByRole('button', { name, exact: true }).click();
        const tiles = page.locator(surface === 'manager' ? '.workspace-tile' : '.collection-tile');
        await expect(tiles).toHaveCount(decks.length);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (surface === 'manager') {
          const checkbox = tiles.first().getByRole('checkbox');
          const link = tiles.first().getByRole('link');
          // Tiles put the link before the checkbox; the List table starts each row with its checkbox.
          const [toCheckbox, toLink] = layout === 'list' ? ['Shift+Tab', 'Tab'] : ['Tab', 'Shift+Tab'];
          await link.focus();
          await page.keyboard.press(toCheckbox);
          await expect(checkbox).toBeFocused();
          expect(await checkbox.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
          // WebKit's default keyboard navigation skips links, so focus the link directly there.
          if (browserName === 'webkit') await link.focus();
          else await page.keyboard.press(toLink);
          await expect(link).toBeFocused();
          expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
          if (layout === 'grid' || layout === 'list') {
            const title = await tiles.first().locator('h4').boundingBox();
            const tile = await tiles.first().boundingBox();
            const actions = await tiles.first().locator('.workspace-tile-controls').boundingBox();
            if (layout === 'grid') expect(title!.width).toBeCloseTo(tile!.width, 0);
            // Tiles stack the title and actions; table rows keep them in separate columns.
            if (layout === 'list') expect(title!.x + title!.width).toBeLessThanOrEqual(actions!.x);
            else expect(title!.y >= actions!.y + actions!.height || title!.y + title!.height <= actions!.y).toBe(true);
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

for (const width of [1500, 390]) test(`List is a sortable table on both pages at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const phone = width <= 700;
  const byName = decks.map(d => d.name).sort((a, b) => a.localeCompare(b));
  for (const surface of ['shelf', 'manager']) {
    if (surface === 'manager') await openManager(page, phone);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const table = page.getByRole('table');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(decks.length);
    await expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Colors' })).toBeVisible();
    // Phones keep artwork, name and colors; the commander moves under the name and release drops.
    for (const column of ['Commander', 'Release']) {
      if (phone) await expect(table.getByRole('columnheader', { name: column })).toBeHidden();
      else await expect(table.getByRole('columnheader', { name: column })).toBeVisible();
    }
    const commander = decks[0].commanders[0].name;
    if (phone) await expect(rows.first().locator('.deck-table-name')).toContainText(commander);
    else await expect(rows.first().locator('.deck-table-commander')).toHaveText(commander);

    // Headers, the field menu and its direction button share one sort; a second header click reverses it.
    // Phones fold the menu away, so read it without requiring it to be visible.
    const sort = page.locator('select[aria-label="Sort decks"]');
    const direction = page.locator('.sort-direction');
    const nameHeader = table.getByRole('columnheader', { name: 'Name' });
    await nameHeader.getByRole('button').click();
    await expect(sort).toHaveValue('name');
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(rows.first()).toContainText(byName[0]);
    await nameHeader.getByRole('button').click();
    await expect(sort).toHaveValue('name');
    await expect(direction).toHaveText('Z–A');
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first()).toContainText(byName.at(-1)!);
    if (!phone) {
      const byCommander = [...decks].sort((a, b) => a.commanders[0].name.localeCompare(b.commanders[0].name));
      const commanderHeader = table.getByRole('columnheader', { name: 'Commander' });
      await commanderHeader.getByRole('button').click();
      await expect(sort).toHaveValue('commander');
      await expect(commanderHeader).toHaveAttribute('aria-sort', 'ascending');
      await expect(rows.first()).toContainText(byCommander[0].commanders[0].name);
      await commanderHeader.getByRole('button').click();
      await expect(rows.first()).toContainText(byCommander.at(-1)!.commanders[0].name);
    }
    if (phone) await page.getByRole('button', { name: 'Size and sort' }).click();
    // Picking a field starts at its natural order; the direction button names and flips it.
    const colorsHeader = table.getByRole('columnheader', { name: 'Colors' });
    await sort.selectOption('colors');
    await expect(nameHeader).not.toHaveAttribute('aria-sort');
    await expect(colorsHeader).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Sort order: Fewest', exact: true }).click();
    await expect(colorsHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(direction).toHaveText('Most');
    // Collection order keeps its direction button too, so the toolbar never shifts: As listed or Reversed.
    await sort.selectOption('collection');
    await expect(direction).toHaveText('As listed');
    await expect(rows.first()).toContainText(decks[0].name);
    await direction.click();
    await expect(direction).toHaveText('Reversed');
    await expect(rows.first()).toContainText(decks.at(-1)!.name);
    await direction.click();
    await expect(rows.first()).toContainText(decks[0].name);
    if (phone) await page.getByRole('button', { name: 'Size and sort' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    if (surface === 'shelf') {
      // A row click selects while choosing a few, and the shortlist number shows in the row.
      await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
      await rows.nth(1).locator('.deck-table-colors').click();
      await expect(rows.nth(1)).toHaveClass(/is-shortlisted/);
      await expect(rows.nth(1).locator('.shortlist-mark')).toHaveText('01');
      await expect(page.getByRole('button', { name: `Select ${decks[1].name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    } else {
      // A row click toggles its checkbox, and Select all follows.
      const box = rows.first().getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true });
      const all = page.getByRole('checkbox', { name: 'Select all', exact: true });
      await rows.first().locator('h4').click();
      await expect(box).not.toBeChecked();
      await expect(rows.first()).toHaveClass(/is-hidden/);
      expect(await all.evaluate(el => (el as HTMLInputElement).indeterminate)).toBe(true);
      await rows.first().locator('h4').click();
      await expect(box).toBeChecked();
      await expect(rows.first().getByRole('link', { name: `Open ${decks[0].name} on Archidekt`, exact: true })).toHaveAttribute('target', '_blank');
    }
  }
});

test('List shows Tags only when a deck in the results has them', async ({ page }) => {
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const tags = page.getByRole('table').getByRole('columnheader', { name: 'Tags' });
  await expect(tags).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr').first().locator('.deck-table-tags')).toHaveText(decks[0].tags.slice(0, 3).join(' · '));
  await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify({ ...fixture, added: fixture.added.map(d => ({ ...d, tags: [] })) })), { key: collectionKey, fixture });
  await page.reload();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(decks.length);
  await expect(tags).toHaveCount(0);
});
