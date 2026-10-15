import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
import folderFixture from '../fixtures/collection-folders.json' with { type: 'json' };
import deckFixture from '../fixtures/collection-decks.json' with { type: 'json' };

const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 6).map((deck, i) => ({ ...deck, id: String(980001 + i) }));
const makeSource = (id: string, name: string, ids: number[], path: string) => ({
  key: `folder:${id}`, kind: 'folder', value: id, name, url: `https://archidekt.com/folders/${id}`,
  checkedAt: '2026-10-04T12:00:00Z', knownIds: ids.map(i => decks[i].id), selectedIds: ids.map(i => decks[i].id),
  entries: ids.map(i => ({ id: decks[i].id, name: decks[i].name, image: decks[i].commanders[0].art, colors: decks[i].colors })),
  folderPath: path, connectionKey: 'account:birckk', connectionName: 'Birckk',
});
const sources = [makeSource('42', 'Mono-color', [0, 1, 2], 'Home / Test collection / Mono-color'), makeSource('43', 'Multicolor', [0, 3, 4], 'Home / Test collection / Multicolor')];
const fixture = { version: 1, starter: false, added: decks.slice(0, 5), hidden: [], excluded: [decks[0].id], sources, manualIds: [] };
// Less common collection actions live in the More menu beside each collection.
const menu = async (page: import('@playwright/test').Page, name: string, item: string) => {
  await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key, fixture });
  await page.goto('/');
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
});

test('source selections survive reload without hiding overlaps or resetting picker exclusions', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  await nav.getByRole('button', { name: 'Mono-color', exact: true }).click();
  await page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true }).uncheck();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${decks[0].name}`, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await nav.getByRole('button', { name: 'Mono-color', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true })).not.toBeChecked();
  await nav.getByRole('button', { name: 'Multicolor', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /in picker/ })).toHaveCount(0);
});

test('search-scoped bulk selection and source switches keep other choices', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Mono-color', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a deck in collection settings' }).fill(decks[1].name);
  await page.getByRole('button', { name: 'Deselect all', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a deck in collection settings' }).clear();
  await expect(page.getByRole('checkbox', { name: `Show ${decks[2].name}`, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Only this', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('2 on display');
  await page.getByRole('switch', { name: 'Enable Mono-color', exact: true }).uncheck();
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await page.getByRole('switch', { name: 'Enable Mono-color', exact: true }).check();
  await expect(page.locator('.workspace-heading')).toContainText('2 on display');
});

test('failed refresh retains snapshots and hierarchy; Remove keeps decks other collections still have', async ({ page }) => {
  await page.route('**/api/sources?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Source unavailable.' }) }));
  await page.getByRole('navigation').getByRole('button', { name: 'Mono-color', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Source unavailable.');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources).toEqual(sources);
  expect(saved.added).toEqual(fixture.added);
  await menu(page, 'Mono-color', 'Remove…');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  // Deck 0 is also in Multicolor and stays; decks 1 and 2 only came from Mono-color.
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(after.sources.map((s: { key: string }) => s.key)).toEqual(['folder:43']);
  expect(after.added.map((d: { id: string }) => d.id)).toEqual([decks[0].id, decks[3].id, decks[4].id]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(undone.sources.map((s: { key: string }) => s.key).sort()).toEqual(['folder:42', 'folder:43']);
  expect(undone.added.map((d: { id: string }) => d.id).sort()).toEqual(fixture.added.map(d => d.id).sort());
});

test('new source entries stay staged until added and can be retried after failure', async ({ page }) => {
  const found = makeSource('42', 'Mono-color', [0, 1, 2, 5], 'Home / Test collection / Mono-color');
  await page.route('**/api/sources?*', route => route.fulfill({ json: found }));
  await page.route('**/api/decks/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: decks.find(d => d.id === id) });
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Mono-color', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const choice = page.getByRole('checkbox', { name: `Select ${decks[5].name}`, exact: true });
  await expect(choice).not.toBeChecked();
  await choice.check();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await page.route(`**/api/decks/${decks[5].id}`, route => route.fulfill({ status: 503, json: { error: 'Try again.' } }));
  await page.getByRole('button', { name: 'Add selected decks', exact: true }).click();
  await expect(page.locator('.manager-failures')).toContainText('Try again.');
  await page.unroute(`**/api/decks/${decks[5].id}`);
  await page.getByRole('button', { name: 'Add selected decks', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('6 on display');
});

test('the 30-deck folder fixture imports with hierarchy and a version-1 backup round trip', async ({ page }) => {
  const folders = folderFixture.folders.filter(f => f.source.value === '1916319' || f.path.includes('DeckShelf Test Collection /'));
  await page.route('**/api/source-folders?*', route => route.fulfill({ json: { name: 'DeckShelf Test Collection', folders } }));
  await page.route('**/api/decks/*', route => route.fulfill({ json: deckFixture.find(d => d.id === new URL(route.request().url()).pathname.split('/').pop()) }));
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await page.locator('#collection-source-input').fill('https://archidekt.com/folders/1916319');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which folders do you want to show?' })).toBeVisible();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Add 30 decks', exact: true }).click();
  await expect(page.locator('.manager-progress')).toHaveCount(0);
  await expect(page.locator('.workspace-heading')).toContainText('30 on display');
  await page.getByRole('navigation').getByRole('button', { name: '01 - Mono-color', exact: true }).click();
  await expect(page.locator('.workspace-tile')).toHaveCount(5);
  await page.getByRole('navigation').getByRole('button', { name: '02 - Multicolor', exact: true }).click();
  await expect(page.locator('.workspace-tile')).toHaveCount(24);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.version).toBe(1);
  expect(saved.added).toHaveLength(35);
  expect(saved.disabledGroups).toContain('folder:42');
  expect(saved.sources.find((s: { key: string }) => s.key === 'folder:1916320').folderPath).toContain('DeckShelf Test Collection / 01 - Mono-color');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('deckshelf-collection.json');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('30 on display');
  await page.screenshot({ path: 'qa/collection/imported-30.png', fullPage: true });
});

test('returning to browsing preserves gallery search and layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search decks', exact: true }).fill(decks[0].name);
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search decks', exact: true })).toHaveValue(decks[0].name);
  await expect(page.getByRole('button', { name: `View ${decks[0].name}`, exact: true })).toBeVisible();
});

test('overview is source-only and built-in collections can be paused, hidden and shown again', async ({ page }) => {
  const profile = { ...fixture, manualIds: [decks[4].id], hidden: [decks[1].id], demo: { snapshotAt: '2026-10-04T12:00:00Z', decks: decks.slice(0, 2), removed: false } };
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify(profile)), { key, profile });
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(page.locator('.workspace-tile')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Find a deck in collection settings' })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  for (const name of ['Official Commander precons', 'Individual decks']) {
    const control = nav.getByRole('switch', { name: `Enable ${name} in sidebar`, exact: true });
    await control.uncheck();
    await expect(control).not.toBeChecked();
    await control.check();
    await expect(control).toBeChecked();
  }
  await nav.getByRole('button', { name: 'Official Commander precons', exact: true }).click();
  await menu(page, 'Official Commander precons', 'Hide precons');
  await expect(page.locator('.collection-hidden-state')).toBeVisible();
  await page.screenshot({ path: 'qa/collection/precons-hidden-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'qa/collection/precons-hidden-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'More actions for Official Commander precons', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable all', exact: true }).click();
  await expect(nav.getByRole('switch', { name: 'Enable Official Commander precons in sidebar', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).demo.removed, key)).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await nav.getByRole('button', { name: /^Hidden/ }).click();
  await nav.getByRole('button', { name: 'Show Official Commander precons', exact: true }).click();
  await expect(nav.getByRole('switch', { name: 'Enable Official Commander precons in sidebar', exact: true })).toBeChecked();
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(restored.demo).toEqual(profile.demo);
  expect(restored.hidden).toEqual(profile.hidden);
  expect(restored.excluded).toEqual(profile.excluded);
  await nav.getByRole('button', { name: /All saved decks/ }).click();
  await expect(page.locator('.workspace-tile')).toHaveCount(5);
});

for (const width of [1440, 390, 320]) test(`workspace layouts, artwork selection and keyboard controls fit ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('heading', { name: 'My collection', exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `qa/collection/overview-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Expand collections', exact: true }).click();
  await expect(page.locator('.overview-folder-summary')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Mono-color', exact: true }).click();
  for (const layout of ['Details', 'Cards only', 'Compact', 'List']) {
    await page.getByRole('button', { name: layout, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const row = page.locator('.workspace-tile').first();
    const checkbox = row.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true });
    const link = row.getByRole('link', { name: `Open ${decks[0].name} on Archidekt`, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(row.locator('.workspace-tile-actions')).toHaveCount(0);
    await row.locator('.workspace-tile-art > img').click();
    await expect(checkbox).not.toBeChecked();
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.screenshot({ path: `qa/collection/workspace-${width}-${layout.replace(' ', '-')}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My collection', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Search decks', exact: true })).toBeVisible();
});


for (const width of [1440, 390]) test(`folder pills preserve subsets and scoped overlap status at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  await expect(nav.getByRole('switch', { name: 'Enable Mono-color in sidebar', exact: true })).toBeVisible();
  await nav.getByRole('checkbox', { name: 'Show folder switches' }).uncheck();
  await expect(nav.getByRole('switch', { name: 'Enable Mono-color in sidebar', exact: true })).toHaveCount(0);
  await nav.getByRole('checkbox', { name: 'Show folder switches' }).check();
  await nav.getByRole('switch', { name: 'Enable Mono-color in sidebar', exact: true }).uncheck();
  await expect(page.locator('.workspace-heading')).toContainText('3 on display');
  await expect(page.locator('.collection-box').first()).toContainText('Some');
  await expect(page.locator('.collection-box').first()).toContainText('3/5 active');
  await expect(nav.locator('.navigator-row').filter({ has: page.getByRole('button', { name: 'Mono-color', exact: true }) })).toContainText('0/3');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${decks[1].name}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `View ${decks[0].name}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await nav.getByRole('switch', { name: 'Enable Birckk in sidebar', exact: true }).uncheck();
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await expect(nav.getByRole('checkbox', { name: 'Show folder switches' })).toBeChecked();
  await nav.getByRole('switch', { name: 'Enable Birckk in sidebar', exact: true }).check();
  await expect(nav.getByRole('switch', { name: 'Enable Mono-color in sidebar', exact: true })).not.toBeChecked();
  await expect(page.locator('.workspace-heading')).toContainText('3 on display');
  await page.screenshot({ path: `qa/collection/folder-pills-${width}.png`, fullPage: true });
  await nav.getByRole('button', { name: 'Mono-color', exact: true }).click();
  await page.getByRole('combobox', { name: 'Deck display status' }).selectOption('shown');
  await expect(page.locator('.workspace-tile')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Deck display status' }).selectOption('all');
  await expect(page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true })).toBeChecked();
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await nav.getByRole('button', { name: 'Birckk', exact: true }).click();
  await menu(page, 'Birckk', 'All folders on');
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await menu(page, 'Birckk', 'All folders off');
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `qa/collection/folder-scope-${width}.png`, fullPage: true });
});


test('Ctrl-click parent pills enables all from partial state and then disables all', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  const child = nav.getByRole('switch', { name: 'Enable Mono-color in sidebar', exact: true });
  const parent = nav.getByRole('switch', { name: 'Enable Birckk in sidebar', exact: true });
  await child.uncheck();
  await parent.click({ modifiers: ['Control'] });
  await expect(child).toBeChecked();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await parent.click({ modifiers: ['Control'] });
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await page.getByRole('switch', { name: 'Enable Birckk in overview' }).click({ modifiers: ['Control'] });
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await child.uncheck();
  await page.getByRole('switch', { name: 'Enable Birckk in overview' }).click({ modifiers: ['Meta'] });
  await expect(child).toBeChecked();
  await nav.getByRole('button', { name: 'Birckk', exact: true }).click();
  await page.getByRole('switch', { name: 'Enable Birckk folders', exact: true }).click({ modifiers: ['Control'] });
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
});


for (const width of [1440, 390]) test(`temporary shortlist picks from the active shelf at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByRole('button', { name: /Exclude .* from picker/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  await page.getByRole('button', { name: `Select ${decks[0].name}`, exact: true }).click();
  await page.getByRole('button', { name: `Select ${decks[2].name}`, exact: true }).click({ modifiers: ['Shift'] });
  await expect(page.locator('.is-shortlisted')).toHaveCount(3);
  await expect(page.locator('.shortlist-controls')).toContainText('3 selected');
  await expect(page.locator('.collection-tile')).toHaveCount(5);
  await page.screenshot({ path: `qa/collection/shortlist-${width}.png`, fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Picker', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck picker', exact: true })).toBeAttached();
  await expect(page.locator('.result-count')).not.toContainText('selected');
  await expect(page.getByRole('button', { name: '3 selected', exact: true })).toBeVisible();
  expect(await page.locator('.helix-card').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('aria-label')))].sort())).toEqual(decks.slice(0, 3).map(deck => 'View ' + deck.name).sort());
  await page.getByRole('textbox', { name: 'Search decks', exact: true }).fill(decks[4].name);
  await expect(page.locator('.helix-card')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search decks', exact: true }).clear();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.locator('.result-count')).not.toContainText('selected');
  expect(await page.locator('.helix-card').evaluateAll(nodes => new Set(nodes.map(node => node.getAttribute('aria-label'))).size)).toBe(5);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved).toEqual(fixture);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toHaveCount(0);
  await expect(page.locator('.collection-tile')).toHaveCount(5);
});


for (const width of [1440, 390]) test(`quick choice stays anchored and All toggles without exiting at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  const toolbar = page.getByRole('group', { name: 'Quick deck choice' });
  const trigger = page.getByRole('button', { name: 'Choose a few', exact: true });
  const triggerSize = await trigger.boundingBox();
  const typography = await trigger.evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight, getComputedStyle(el).lineHeight]);
  const before = await toolbar.boundingBox();
  const layoutBefore = await page.getByRole('button', { name: 'Cards only', exact: true }).boundingBox();
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  const activeTrigger = page.getByRole('button', { name: 'Select cards', exact: true });
  expect(await activeTrigger.evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight, getComputedStyle(el).lineHeight])).toEqual(typography);
  const after = await toolbar.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(await page.getByRole('button', { name: 'Cards only', exact: true }).boundingBox()).toEqual(layoutBefore);
  {
    // Close takes its space from the entry, so the two cover the idle entry's width. Desktop keeps
    // the group's left edge (actions extend right); phones keep its right edge (actions extend left).
    const close = (await page.getByRole('button', { name: 'Clear selection', exact: true }).boundingBox())!, active = (await activeTrigger.boundingBox())!;
    expect(after!.height).toBe(before!.height);
    expect(active.height).toBe(triggerSize!.height);
    expect(active.x + active.width - close.x).toBeCloseTo(triggerSize!.width, 0);
    if (width > 700) {
      expect(after!.x).toBe(before!.x);
      expect(close.x).toBeCloseTo(triggerSize!.x, 0);
    } else {
      expect(after!.x + after!.width).toBeCloseTo(before!.x + before!.width, 0);
    }
  }
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  await expect(page.locator('.is-shortlisted')).toHaveCount(5);
  await page.getByRole('button', { name: 'Deselect visible', exact: true }).click();
  await expect(page.locator('.is-shortlisted')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select cards', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Select visible', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose a few', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `qa/collection/choice-anchored-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose a few', exact: true })).toBeVisible();
});


test('shortlist numbers follow displayed order after reverse selection and sorting', async ({ page }) => {
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  for (const i of [4, 2, 0]) await page.getByRole('button', { name: `Select ${decks[i].name}`, exact: true }).click();
  await expect(page.locator('.shortlist-mark')).toHaveText(['01', '02', '03']);
  await page.getByRole('combobox', { name: 'Sort decks' }).selectOption('name');
  await expect(page.locator('.shortlist-mark')).toHaveText(['01', '02', '03']);
  await page.getByRole('button', { name: `Select ${decks[0].name}`, exact: true }).click();
  await expect(page.locator('.shortlist-mark')).toHaveText(['01', '02']);
});


for (const width of [1440, 390]) test(`remove an imported collection asks first and removes its decks at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const box = page.locator('.collection-box').filter({ has: page.getByRole('button', { name: 'Open Birckk', exact: true }) });
  await menu(page, 'Birckk', 'Remove…');
  await expect(page.getByRole('dialog', { name: 'Remove…' })).toContainText('Remove Birckk and its 5 saved decks?');
  await page.screenshot({ path: `qa/collection/remove-collection-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Birckk', exact: true })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources).toEqual([]);
  expect(saved.added).toEqual([]);
  expect(saved.excluded).toEqual(fixture.excluded);
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Birckk', exact: true })).toHaveCount(0);
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
});


test('folder folds and overview expansion survive navigation and reload without search changing them', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  await nav.getByRole('button', { name: 'Collapse Home', exact: true }).click();
  await page.getByRole('button', { name: 'Expand collections', exact: true }).click();
  await nav.getByRole('textbox', { name: 'Find a source or folder' }).fill('Mono');
  await expect(nav.getByRole('button', { name: 'Mono-color', exact: true })).toBeVisible();
  await nav.getByRole('textbox', { name: 'Find a source or folder' }).clear();
  await expect(nav.getByRole('button', { name: 'Expand Home', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Expand Home', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse collections', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Expand Home', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse collections', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Expand Home', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Collapse Home', exact: true })).toBeVisible();
});


for (const width of [1440, 390, 320]) test(`clearing a shortlist keeps the scene size and reclaims phone space at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  await page.getByRole('button', { name: `Select ${decks[0].name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Picker', exact: true }).click();
  const stage = page.getByRole('region', { name: 'Random deck picker' });
  const before = await stage.boundingBox();
  const motion = await page.getByRole('group', { name: 'Picker motion' }).boundingBox();
  await page.screenshot({ path: `qa/collection/picker-clear-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  const after = (await stage.boundingBox())!;
  if (width > 700) {
    expect(after).toEqual(before);
    expect(await page.getByRole('group', { name: 'Picker motion' }).boundingBox()).toEqual(motion);
  } else {
    expect(after.x).toBe(before!.x);
    expect(after.width).toBe(before!.width);
    expect(after.height).toBe(before!.height);
    // The shortlist shares the motion row, so clearing it never moves the scene.
    expect(after.y).toBe(before!.y);
    expect(after.y).toBeLessThan(180);
    await expect(page.getByRole('group', { name: 'Quick deck choice' })).toBeHidden();
  }
  await expect(page.getByText('All matching decks', { exact: true })).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `qa/collection/picker-stable-${width}.png`, fullPage: true });
});


test('browsing views share the same desktop toolbar baseline and height', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  const initial = await page.locator('.results-toolbar').boundingBox();
  const count = await page.locator('.result-count').boundingBox();
  for (const name of ['Cards', 'Pick a deck', 'Collection']) {
    await page.getByRole('group', { name: 'Collection view', exact: true }).getByRole('button', { name, exact: true }).click();
    expect(await page.locator('.results-toolbar').boundingBox()).toEqual(initial);
    expect(await page.locator('.result-count').boundingBox()).toEqual(count);
    await page.screenshot({ path: `qa/collection/aligned-${name.replaceAll(' ', '-')}.png`, fullPage: true });
  }
});


test('instant picking leaves drift independent and paused dragging coasts after release', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Instant pick', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Pause drift', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Pause drift', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume drift', exact: true })).toBeEnabled();
  const stage = await page.locator('.helix-stage').boundingBox();
  await page.mouse.move(stage!.x + 30, stage!.y + stage!.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 160, stage!.y + stage!.height / 2 + 70, { steps: 8 });
  await page.mouse.up();
  const samples = await page.locator('.helix-card').first().evaluate(async el => {
    const values = [];
    for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); values.push((el as HTMLElement).style.transform); }
    return values;
  });
  expect(new Set(samples).size).toBeGreaterThan(2);
  await expect(page.getByRole('button', { name: 'Resume drift', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Resume drift', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Instant pick', exact: true })).toBeChecked();
});


for (const width of [1440, 390, 320]) test(`selected-count control, logo and search keep their metrics across every view at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  await page.getByRole('button', { name: `Select ${decks[0].name}`, exact: true }).click();
  const measure = async () => {
    await page.evaluate(() => scrollTo(0, 0));
    return page.getByRole('button', { name: '1 selected', exact: true }).evaluate((el, phone) => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      const logo = document.querySelector('.studio-header .brand img')!.getBoundingClientRect();
      // The count stays fixed, and so does the group's aligned edge: left on desktop, right on phones.
      const group = el.closest('.shortlist-controls')!.getBoundingClientRect(), count = document.querySelector('.result-count')!.getBoundingClientRect();
      // Measured from the toolbar's edge: WebKit ignores scrollbar-gutter, so page width can differ by view.
      const row = el.closest('.results-toolbar')!.getBoundingClientRect();
      const edge = phone ? [row.right - group.right] : [group.x, box.x];
      return [...edge, group.y, group.height, box.y, box.width, box.height, count.x, count.y, style.fontSize, style.fontWeight, style.justifyContent, logo.width, logo.height];
    }, width <= 700);
  };
  // Search icon, text field and Filters share the bar's vertical centre.
  const middles = await page.evaluate(() => ['.studio-toolbar > .studio-search', '.studio-search > svg', '.studio-search input', '.filters-trigger']
    .map(s => { const b = document.querySelector(s)!.getBoundingClientRect(); return Math.round(b.y + b.height / 2); }));
  expect(new Set(middles).size).toBe(1);
  const original = await measure();
  for (const name of ['Cards', 'Pick a deck', 'Collection']) {
    await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name, exact: true }).click();
    expect(await measure()).toEqual(original);
    await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toBeVisible();
  }
});

for (const width of [1440, 390]) test('My collection remembers pages and folder scopes at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  const openNav = async () => { if (width < 700) await page.getByRole('button', { name: 'Sources and folders' }).click(); };
  const reopen = async () => {
    await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
  };
  await openNav();
  await nav.getByRole('button', { name: 'Mono-color', exact: true }).click();
  await reopen();
  await expect(page.getByRole('heading', { name: 'Mono-color', exact: true })).toBeVisible();
  await openNav();
  await nav.getByRole('button', { name: 'Test collection', exact: true }).click();
  await reopen();
  await expect(page.getByRole('heading', { name: 'Test collection', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More actions for Test collection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await openNav();
  await nav.getByRole('button', { name: /All saved decks/ }).click();
  await reopen();
  await expect(page.getByRole('heading', { name: 'All saved decks', exact: true })).toBeVisible();
});

for (const width of [1440, 390]) test('hidden collections stay out of bulk enabling at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const box = page.locator('.collection-box').filter({ has: page.getByRole('button', { name: 'Open Birckk', exact: true }) });
  await menu(page, 'Birckk', 'Hide');
  await page.getByRole('button', { name: 'Enable all', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('0 on display');
  await expect(page.getByRole('button', { name: 'Open Birckk', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'qa/collection/hidden-' + width + '.png', fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  if (width < 751) await page.getByRole('button', { name: 'Sources and folders' }).click();
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  await nav.getByRole('button', { name: /^Hidden/ }).click();
  await nav.getByRole('button', { name: 'Birckk', exact: true }).click();
  await page.getByRole('button', { name: 'Show', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await expect(page.locator('.workspace-tile').getByRole('button', { name: /^(Disable|Enable) / })).toHaveCount(0);

});
