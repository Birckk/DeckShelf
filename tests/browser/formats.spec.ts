import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import seed from '../fixtures/collection-decks.json' with { type: 'json' };
import { archidektFormat } from '../../shared/formats.mjs';
import { cardImage, parseCollection, type Deck } from '../../src/domain';

const key = 'commander-archive.collection.v1';
const commander = { ...seed[0], id: '982001', name: 'Commander partners', commanders: [seed[0].commanders[0], seed[1].commanders[0]] };
const decks = [commander, ...[2, 1, 6, 99].map((id, index) => ({
  ...seed[index + 1], id: String(982002 + index), name: `${archidektFormat(id).name} deck`,
  format: archidektFormat(id), commanders: [],
  cover: id === 99 ? { kind: 'fallback', name: 'No cover selected', image: '', art: '', artist: '' }
    : { ...seed[index + 1].commanders[0], kind: 'featured' },
}))] as Deck[];
const fixture = { version: 1, hidden: ['999'], excluded: [decks[1].id], added: decks, manualIds: decks.map(d => d.id) };
const source = { key: 'folder:88', kind: 'folder', value: '88', name: 'Mixed formats', url: 'https://archidekt.com/folders/88', checkedAt: new Date().toISOString(), formatScope: 'all', entries: decks.map(d => ({ id: d.id, name: d.name, image: d.commanders[0]?.art || d.cover?.art || '', colors: d.colors, format: d.format ?? archidektFormat(3) })), knownIds: decks.map(d => d.id) };
const commanderSource = { ...source, formatScope: 'commander', entries: source.entries.slice(0, 1), knownIds: [commander.id] };
async function mockDiscovery(page: Page, calls: string[] = []) {
  await page.route('**/api/source-folders?*', route => {
    const scope = new URL(route.request().url()).searchParams.get('formats')!;
    calls.push(scope);
    return route.fulfill({ json: { name: source.name, folders: [{ source: scope === 'all' ? source : commanderSource, path: source.name, root: true }] } });
  });
}
async function startFolderImport(page: Page) {
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await page.getByLabel('Username, profile, folder or deck link').fill(source.url);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function browse(page: Page, format: string) {
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Format', { exact: true }).selectOption(format);
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
}
async function init(page: Page, profile: object = fixture) {
  await page.addInitScript(({ key, profile }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(profile)); }, { key, profile });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
}
test('Commander default, all-format browsing, featured cards, fallback and explicit picker scopes', async ({ page }) => {
  await init(page);
  await expect(page.locator('.collection-tile')).toHaveCount(1);
  await expect(page.locator('.result-count')).toHaveText('1 of 5 decks');
  await browse(page, 'all');
  await expect(page.locator('.collection-tile')).toHaveCount(5);
  await page.getByRole('button', { name: 'View Modern deck', exact: true }).click();
  await expect(page.locator('.detail-cards img')).toHaveCount(1);
  await expect(page.locator('.detail-commander')).toContainText('Featured card');
  await expect(page.locator('.detail-set')).toContainText('Modern');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'View Unknown (99) deck', exact: true }).click();
  await expect(page.locator('.detail-cards .art-fallback')).toContainText('No cover selected');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await browse(page, 'modern');
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(page.locator('.studio-caption')).toContainText('Modern');
  await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByLabel('Pick format', { exact: true })).toHaveValue('modern');
  await expect(page.locator('.spin-button')).toHaveAttribute('title', 'Each eligible deck has a 1 in 1 chance.');
  await expect(page.locator('.helix-card').first()).toHaveAttribute('aria-label', /Modern deck/);
  await page.locator('.spin-button').click();
  await expect(page.locator('.revealed-card')).toHaveAttribute('aria-label', 'View winning deck Modern deck');
  await page.getByLabel('Pick format', { exact: true }).selectOption('unknown-99');
  await expect(page.locator('.helix-card').first()).toHaveAttribute('aria-label', /Unknown \(99\) deck/);
  await expect(page.getByLabel('Pick format', { exact: true }).locator('option[value=all]')).toHaveCount(0);
});

for (const identity of [
  { colors: ['W', 'U', 'B', 'R', 'G'], name: 'White, Blue, Black, Red, Green' },
  { colors: [], name: 'Colorless' },
]) {
  test(`colour identity is one named image: ${identity.name}`, async ({ page }) => {
    await init(page, { ...fixture, added: [{ ...commander, colors: identity.colors }] });
    await page.getByRole('button', { name: 'View Commander partners', exact: true }).click();
    const identityImage = page.getByRole('dialog').getByRole('img', { name: identity.name, exact: true });
    await expect(identityImage).toHaveCount(1);
    await expect(identityImage).toMatchAriaSnapshot(`- img "${identity.name}"`);
    for (const symbol of await identityImage.locator('img').all()) {
      await expect(symbol).toHaveAttribute('alt', '');
      await expect(symbol).toHaveAttribute('aria-hidden', 'true');
    }
  });
}

test('folder selection filters actual formats, imports mixed decks and round trips backups', async ({ page }) => {
  await init(page, { ...fixture, added: [], manualIds: [] });
  const calls: string[] = [];
  await mockDiscovery(page, calls);
  await page.route('**/api/decks/*', route => route.fulfill({ json: decks.find(d => route.request().url().endsWith(d.id)) }));
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await expect(page.getByLabel('Import formats')).toHaveCount(0);
  await page.getByLabel('Username, profile, folder or deck link').fill('https://archidekt.com/folders/88');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.source-choice-heading')).toContainText('1 decks');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByLabel('Format', { exact: true }).selectOption('all');
  await expect(page.locator('.source-choice-heading')).toContainText('5 decks');
  await page.getByLabel('Format', { exact: true }).selectOption('modern');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByLabel('Format', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Add 5 decks', exact: true }).click();
  expect(calls).toEqual(['commander', 'all']);
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadEvent;
  const restored = parseCollection(readFileSync((await download.path())!, 'utf8'));
  expect(restored.added).toHaveLength(5);
  expect(restored.hidden).toEqual(['999']);
  expect(restored.excluded).toEqual([decks[1].id]);
  expect(restored.sources?.[0].formatScope).toBe('all');
  await page.locator('input[type=file]').setInputFiles({ name: 'mixed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('5 on display');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await browse(page, 'all');
  await expect(page.locator('.collection-tile')).toHaveCount(5);
});

test('Compact uses featured artwork for decks without commanders on both collection pages', async ({ page }) => {
  await init(page);
  await browse(page, 'all');
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  const modern = page.getByRole('button', { name: 'View Modern deck', exact: true });
  await expect(modern.locator('img')).toHaveAttribute('src', cardImage(decks[1].cover!.art));
  await expect(page.getByRole('button', { name: 'View Unknown (99) deck', exact: true }).getByRole('img', { name: /No cover selected/ })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: /All saved decks/ }).click();
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  const tile = page.locator('.workspace-tile').filter({ has: page.getByRole('checkbox', { name: 'Show Modern deck', exact: true }) });
  await expect(tile.locator('.workspace-tile-art > img')).toHaveAttribute('src', cardImage(decks[1].cover!.art));
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1500, height: 900 }, { width: 390, height: 844 }]) {
  test(`format views fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await init(page);
    mkdirSync('.codex-shots', { recursive: true });
    const shot = async (name: string) => {
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.codex-shots/${name}-${viewport.width}.png`, fullPage: !name.startsWith('detail-') });
    };
    await browse(page, 'all');
    await shot('collection-all');
    await page.getByRole('button', { name: 'View Unknown (99) deck', exact: true }).click();
    await shot('detail-fallback');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await shot('cards-all');
    await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Pick a deck', exact: true }).click();
    // Phones keep the picker's controls in its Options menu.
    if (viewport.width < 550) await page.getByRole('button', { name: /^Picker options/ }).click();
    await page.getByLabel('Pick format', { exact: true }).selectOption('modern');
    await shot('picker-modern');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    if (viewport.width < 700) await page.getByRole('button', { name: 'Sources and folders' }).click();
    await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: 'Individual decks', exact: true }).click();
    await shot('collection-settings');
    await page.getByRole('button', { name: 'Add decks', exact: true }).click();
    await mockDiscovery(page);
    await page.getByLabel('Username, profile, folder or deck link').fill('https://archidekt.com/folders/88');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Format', { exact: true }).selectOption('all');
    await expect(page.locator('.source-choice-heading')).toContainText('5 decks');
    await page.locator('.source-folder summary').click();
    await shot('import-all');
    for (const section of ['adding', 'picking', 'faq']) {
      await page.goto(`/help/${section}`);
      if (section === 'faq') {
        await page.getByText('Why is one of my decks missing?', { exact: true }).click();
        await page.getByText('Can I add formats other than Commander?', { exact: true }).click();
      }
      await shot(`help-${section}`);
    }
  });
}

test('an individual non-Commander link imports in its own format', async ({ page }) => {
  await init(page, { ...fixture, added: [], manualIds: [] });
  await page.route('**/api/decks/*', route => route.fulfill({ json: decks[1] }));
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await page.getByLabel('Username, profile, folder or deck link').fill(`https://archidekt.com/decks/${decks[1].id}`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('1 on display');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await browse(page, 'modern');
  await expect(page.getByRole('button', { name: 'View Modern deck', exact: true })).toBeVisible();
});

test('a mixed shortlist never mixes formats or falls back outside the shortlist', async ({ page }) => {
  await init(page);
  await browse(page, 'all');
  await page.getByRole('button', { name: 'Choose a few', exact: true }).click();
  await page.getByRole('button', { name: 'Select Commander partners', exact: true }).click();
  await page.getByRole('button', { name: 'Select Modern deck', exact: true }).click();
  await page.getByRole('button', { name: 'Picker', exact: true }).click();
  await expect(page.getByLabel('Pick format', { exact: true })).toHaveValue('commander');
  await expect(page.locator('.helix-card').first()).toHaveAttribute('aria-label', /Commander partners/);
  await expect(page.locator('.spin-button')).toHaveAttribute('title', 'Each eligible deck has a 1 in 1 chance.');
  await page.getByLabel('Pick format', { exact: true }).selectOption('modern');
  await expect(page.locator('.helix-card').first()).toHaveAttribute('aria-label', /Modern deck/);
  await page.getByLabel('Pick format', { exact: true }).selectOption('unknown-99');
  await expect(page.locator('.helix-card')).toHaveCount(0);
  await expect(page.locator('.spin-button')).toBeDisabled();
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.locator('.helix-card').first()).toHaveAttribute('aria-label', /Unknown \(99\) deck/);
  await page.locator('.spin-button').click();
  await expect(page.locator('.revealed-card .art-fallback')).toContainText('No cover selected');
});

test('default folder import keeps Commander-only discovery on refresh', async ({ page }) => {
  await init(page, { ...fixture, added: [], manualIds: [] });
  const calls: string[] = [];
  await mockDiscovery(page, calls);
  await page.route('**/api/decks/*', route => route.fulfill({ json: commander }));
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await page.getByLabel('Username, profile, folder or deck link').fill('https://archidekt.com/folders/88');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Add 1 deck', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('1 on display');
  // The profile is written after render; WebKit can read it a moment before that.
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  await expect.poll(async () => (await read()).sources?.length).toBe(1);
  const saved = await read();
  expect(saved.sources[0].formatScope).toBe('commander');
  expect(saved.sources[0].entries.map((e: { id: string }) => e.id)).toEqual([commander.id]);
  expect(saved.sources[0].knownIds).toEqual([commander.id]);
  expect(calls).toEqual(['commander']);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1500, height: 900 }, { width: 390, height: 844 }]) {
  test(`returning from a Modern preview resets the folder list and adds a pasted Pauper link at ${viewport.width}px`, async ({ page, browserName }) => {
    await page.setViewportSize(viewport);
    await init(page, { ...fixture, added: [], manualIds: [] });
    await mockDiscovery(page);
    const pauper = decks[3];
    await page.route('**/api/decks/*', route => route.fulfill({ json: pauper }));
    await startFolderImport(page);
    await page.getByLabel('Format', { exact: true }).selectOption('all');
    await expect(page.locator('.source-choice-heading')).toContainText('5 decks');
    await page.getByLabel('Format', { exact: true }).selectOption('modern');
    await page.getByRole('button', { name: 'Change source', exact: true }).click();
    await expect(page.getByLabel('Format', { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync('.codex-shots', { recursive: true });
    await page.screenshot({ path: `.codex-shots/import-form-${browserName}-${viewport.width}.png`, fullPage: true });
    await page.getByLabel('Username, profile, folder or deck link').fill(`https://archidekt.com/decks/${pauper.id}`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('.workspace-heading')).toContainText('1 on display');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added.map((d: { id: string }) => d.id), key)).toEqual([pauper.id]);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.added.map((d: { id: string }) => d.id)).toEqual([pauper.id]);
    expect(saved.hidden).toEqual(fixture.hidden);
    expect(saved.excluded).toEqual(fixture.excluded);
    await startFolderImport(page);
    await expect(page.getByLabel('Format', { exact: true })).toHaveValue('commander');
  });
}

test('widening a legacy source does not select an unticked deck saved in paused Individual decks', async ({ page }) => {
  const legacy = { ...commanderSource };
  await init(page, { ...fixture, added: decks.slice(0, 2), manualIds: [decks[1].id], sources: [legacy], disabledGroups: ['manual'] });
  await mockDiscovery(page);
  await startFolderImport(page);
  await page.getByLabel('Format', { exact: true }).selectOption('all');
  await expect(page.locator('.source-choice-heading')).toContainText('5 decks');
  await page.locator('.source-folder summary').click();
  await page.locator('.source-folder-decks label').filter({ hasText: commander.name }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Add 1 deck', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('1 on display');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources[0].selectedIds).toEqual([commander.id]);
  expect(saved.sources[0].formatScope).toBe('all');
  expect(saved.manualIds).toEqual([decks[1].id]);
  expect(saved.disabledGroups).toContain('manual');
  expect(saved.excluded).toEqual(fixture.excluded);
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await browse(page, 'all');
  await expect(page.locator('.collection-tile')).toHaveCount(1);
});

test('re-adding Commander decks retains an all-format connection and refreshes its Modern deck', async ({ page }) => {
  // Fixed (not following), so Refresh updates saved decks without adding the three new ones.
  const connected = { ...source, membership: 'selected', entries: source.entries.slice(0, 2), knownIds: decks.slice(0, 2).map(d => d.id), selectedIds: decks.slice(0, 2).map(d => d.id) };
  await init(page, { ...fixture, added: decks.slice(0, 2), manualIds: [], sources: [connected] });
  await mockDiscovery(page);
  await startFolderImport(page);
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByRole('button', { name: 'Add 1 deck', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('2 on display');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources[0].formatScope).toBe('all');
  expect(saved.sources[0].selectedIds).toEqual(connected.selectedIds);
  expect(saved.sources[0].entries).toEqual(connected.entries);
  const refreshed: string[] = [];
  await page.route('**/api/sources?*', route => {
    expect(new URL(route.request().url()).searchParams.get('formats')).toBe('all');
    return route.fulfill({ json: source });
  });
  await page.route('**/api/decks/*', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!;
    refreshed.push(id);
    return route.fulfill({ json: { ...decks.find(d => d.id === id), name: `Updated ${id}` } });
  });
  // Open the folder beneath its identically named connection heading.
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: source.name, exact: true }).last().click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.manager-progress')).toHaveCount(0);
  expect(refreshed).toEqual(expect.arrayContaining(connected.selectedIds));
  // The new-deck check that follows the update records the full listing.
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].entries.length, key)).toBe(5);
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(after.added.find((d: { id: string }) => d.id === decks[1].id).name).toBe(`Updated ${decks[1].id}`);
  expect(after.sources[0].entries).toHaveLength(5);
  expect(after.sources[0].selectedIds).toEqual(connected.selectedIds);
});

test('a large non-Commander tree leaves default Commander discovery and selections usable', async ({ page }) => {
  await init(page, { ...fixture, added: [], manualIds: [] });
  const calls: string[] = [];
  await page.route('**/api/source-folders?*', route => {
    const scope = new URL(route.request().url()).searchParams.get('formats')!;
    calls.push(scope);
    return scope === 'all'
      ? route.fulfill({ status: 502, json: { error: 'This collection has more than 1,000 decks. Paste a smaller folder link.' } })
      : route.fulfill({ json: { name: source.name, folders: [{ source: commanderSource, path: source.name, root: true }] } });
  });
  await page.route('**/api/decks/*', route => route.fulfill({ json: commander }));
  await startFolderImport(page);
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add 1 deck', exact: true })).toBeEnabled();
  expect(calls).toEqual(['commander']);
  await page.getByLabel('Format', { exact: true }).selectOption('all');
  await expect(page.getByRole('alert')).toContainText('1,000 decks');
  await expect(page.getByLabel('Format', { exact: true })).toHaveValue('commander');
  await expect(page.getByRole('button', { name: 'Add 1 deck', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add 1 deck', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('1 on display');
  expect(calls).toEqual(['commander', 'all']);
});

test('a scope stays explicit and empty when its collection is switched off', async ({ page }) => {
  await init(page);
  await browse(page, 'modern');
  await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('switch', { name: 'Enable Individual decks in sidebar', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByLabel('Pick format', { exact: true })).toHaveValue('modern');
  await expect(page.getByLabel('Pick format', { exact: true }).locator('option:checked')).toHaveText('Modern (0)');
  await expect(page.locator('.spin-button')).toBeDisabled();
  await expect(page.locator('.picker-scope-count')).toHaveText('0 eligible');
});

test('List adds a Format column only when the results hold a format other than Commander', async ({ page }) => {
  await init(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'Format' })).toHaveCount(0);
  await browse(page, 'all');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.getByRole('columnheader', { name: 'Format' })).toBeVisible();
  const modern = table.locator('tbody tr', { hasText: 'Modern deck' });
  await expect(modern.locator('.deck-table-format')).toHaveText('Modern');
  // Decks without commanders show a dash, and their featured card stands in as the thumbnail.
  await expect(modern.locator('.deck-table-commander')).toHaveText('—');
  await expect(modern.locator('.deck-table-art img')).toHaveCount(1);
});
