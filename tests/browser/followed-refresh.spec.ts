import { test, expect, type Page } from '@playwright/test';
import fixture from '../fixtures/collection-decks.json' with { type: 'json' };
import folders from '../fixtures/collection-folders.json' with { type: 'json' };
import { existsSync } from 'node:fs';

const key = 'commander-archive.collection.v1';
const decks = fixture.slice(0, 4);
const entry = (d: typeof decks[number]) => ({ id: d.id, name: d.name, image: d.commanders[0].art, colors: d.colors });
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Followed folder', url: 'https://archidekt.com/folders/42',
  checkedAt: '2020-01-01T00:00:00Z', knownIds: decks.slice(0, 2).map(d => d.id), entries: decks.slice(0, 2).map(entry),
  selectedIds: [decks[0].id], ownedIds: decks.slice(0, 2).map(d => d.id), folderPath: 'Home / Followed folder' };
const { selectedIds: _selection, ownedIds: _ownership, ...listing } = source;
const found = { ...listing, checkedAt: new Date().toISOString(), entries: decks.slice(1, 3).map(entry), knownIds: decks.slice(1, 3).map(d => d.id) };
async function prepare(page: Page, options: { mode?: string; fail?: boolean; fresh?: boolean; prototype?: boolean; collection?: unknown } = {}) {
  const collection = options.collection ?? { version: 1, starter: false, added: decks.slice(0, 2), hidden: [decks[1].id], excluded: [decks[0].id],
    disabledGroups: ['folder:42'], sources: [{ ...source, ...(options.mode === 'legacy' ? {} : { membership: options.mode || 'follow' }), ...(options.fresh ? { checkedAt: new Date().toISOString() } : {}) }] };
  // prototype: false is the Settings switch turned off.
  const enabled = options.prototype !== false;
  await page.addInitScript(({ key, collection }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(collection)); }, { key, collection: enabled ? collection : { ...(collection as object), followOff: true } });
  // Use the bundled versions of fixture artwork; visual QA never waits on a CDN.
  await page.route('https://card-images.archidekt.com/**', route => {
    const match = /\/(art|grid)\/front\/[^/]+\/[^/]+\/([^/]+)\.webp/.exec(route.request().url());
    const path = match ? `public/images/${match[2]}-${match[1]}.webp` : '';
    return existsSync(path) ? route.fulfill({ path }) : route.abort();
  });
  await page.route('**/api/sources?*', route => options.fail ? route.fulfill({ status: 429, json: { error: 'Archidekt is rate limited.' } }) : route.fulfill({ json: found }));
  await page.route('**/api/decks/*', route => route.fulfill({ json: decks.find(d => d.id === new URL(route.request().url()).pathname.split('/').pop()) }));
  await page.goto('/');
}
async function screenshot(page: Page, path: string) {
  await page.locator('img').evaluateAll(async (images: HTMLImageElement[]) => {
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map(image => image.decode().catch(() => {})));
  });
  await page.screenshot({ path, fullPage: true });
}
async function openSource(page: Page) {
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Collection sources' });
  const foldersButton = nav.getByRole('button', { name: 'Followed folder', exact: true }).last();
  if (!(await foldersButton.isVisible())) await page.getByRole('button', { name: 'Sources and folders' }).click();
  await foldersButton.click();
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1500, height: 900 }, { width: 390, height: 844 }]) {
  test(`follow preserves exclusions and unlisted snapshots at ${viewport.width}`, async ({ page, browserName }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added.length, key)).toBe(3);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.added).toHaveLength(3);
    expect(saved.added.slice(0, 2)).toEqual(decks.slice(0, 2));
    expect(saved.sources[0].selectedIds).toEqual([decks[0].id, decks[2].id]);
    expect(saved.hidden).toEqual([decks[1].id]);
    expect(saved.disabledGroups).toEqual(['folder:42']);
    await openSource(page);
    await expect(page.locator('.source-refresh-status')).toContainText('1 new deck');
    await expect(page.getByText(/No longer listed .*saved copy kept/)).toBeVisible();
    await screenshot(page, `.codex-shots/${browserName}-follow-${viewport.width}.png`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  });
}

test('fixed selections get a persistent notice, TTL avoids another check, and manual refresh is available', async ({ page }) => {
  let requests = 0;
  await prepare(page, { mode: 'selected', fresh: true });
  await page.route('**/api/sources?*', route => { requests++; return route.fulfill({ json: found }); });
  await openSource(page);
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('1 new deck');
  expect(requests).toBe(1);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.added).toEqual(decks.slice(0, 2));
  expect(saved.sources[0].selectedIds).toEqual([decks[0].id]);
  await page.reload();
  await openSource(page);
  await expect(page.locator('.source-refresh-status')).toContainText('1 new deck');
  expect(requests).toBe(1);
});

test('failed revisit keeps last successful check and snapshots, with backoff across reload', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, { fail: true });
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].refresh?.failures, key)).toBe(1);
  await openSource(page);
  await expect(page.locator('.source-refresh-status')).toContainText('Couldn’t check');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources[0].checkedAt).toBe(source.checkedAt);
  expect(saved.added).toEqual(decks.slice(0, 2));
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1500, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await screenshot(page, `.codex-shots/${browserName}-failure-${viewport.width}.png`);
  }
  let calls = 0;
  await page.route('**/api/sources?*', route => { calls++; return route.fulfill({ json: found }); });
  await page.reload();
  await openSource(page);
  await expect(page.locator('.source-refresh-status')).toContainText('Couldn’t check');
  expect(calls).toBe(0);
});

test('whole folders follow when added; hand-picked folders stay fixed', async ({ page, browserName }) => {
  await prepare(page, { mode: 'selected', fresh: true });
  await page.route('**/api/source-folders?*', route => route.fulfill({ json: { name: 'Test collection', folders: folders.folders.slice(0, 2) } }));
  await page.route('**/api/decks/*', route => route.fulfill({ json: fixture.find(d => d.id === new URL(route.request().url()).pathname.split('/').pop()) }));
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await page.getByRole('button', { name: 'Add decks', exact: true }).click();
  await page.locator('#collection-source-input').fill('https://archidekt.com/folders/1916319');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/new decks you put in it on Archidekt are added automatically/)).toBeVisible();
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1500, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await screenshot(page, `.codex-shots/${browserName}-setup-${viewport.width}.png`);
  }
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  const secondFolder = page.locator('.source-folder').nth(1);
  await secondFolder.getByText('Choose individual decks', { exact: true }).click();
  await secondFolder.locator('.source-folder-decks input').first().uncheck();
  await page.getByRole('button', { name: /^Add \d+ decks?$/ }).click();
  await expect(page.locator('.manager-progress')).toHaveCount(0);
  await expect.poll(() => page.evaluate(({ key, sourceKey }) => JSON.parse(localStorage.getItem(key)!).sources.filter((s: { key: string }) => s.key !== sourceKey).map((s: { membership: string }) => s.membership), { key, sourceKey: source.key })).toEqual(['follow', 'selected']);
});

test('choices made while discovery is in flight survive the functional refresh merge', async ({ page }) => {
  await prepare(page, { fresh: true, mode: 'follow' });
  await openSource(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sources?*', async route => { await gate; await route.fulfill({ json: found }); });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('Checking');
  await page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Enable Followed folder', exact: true }).check();
  release();
  await expect(page.locator('.source-refresh-status')).toContainText('1 new deck');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources[0].selectedIds).toEqual([decks[2].id]);
  expect(saved.disabledGroups).toEqual([]);
});

test('a failed new snapshot keeps the complete last-good source instead of committing a partial refresh', async ({ page }) => {
  await prepare(page, { fresh: true, mode: 'follow' });
  await page.route('**/api/sources?*', route => route.fulfill({ json: { ...found, entries: decks.map(entry), knownIds: decks.map(d => d.id) } }));
  await page.route(`**/api/decks/${decks[3].id}`, route => route.fulfill({ status: 429, json: { error: 'Slow down.' } }));
  await openSource(page);
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('Couldn’t check');
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(after.added).toEqual(before.added);
  expect(after.sources[0].entries).toEqual(before.sources[0].entries);
  expect(after.sources[0].checkedAt).toEqual(before.sources[0].checkedAt);
});

test('new snapshot batches stop at ten and keep the remainder for the next manual check', async ({ page }) => {
  await prepare(page, { fresh: true, mode: 'follow' });
  const extra = Array.from({ length: 15 }, (_, index) => ({ ...decks[2], id: String(990000 + index) }));
  await page.route('**/api/sources?*', route => route.fulfill({ json: { ...found, entries: [...decks.slice(0, 2), ...extra].map(entry), knownIds: [...source.knownIds, ...extra.map(d => d.id)] } }));
  let requests = 0;
  // Refresh also updates saved decks (?refresh=1); count only new-deck downloads.
  await page.route('**/api/decks/*', route => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const deck = extra.find(d => d.id === id);
    if (!url.searchParams.has('refresh')) requests++;
    return route.fulfill({ json: deck ?? decks.find(d => d.id === id) });
  });
  await openSource(page);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('5 still downloading');
  expect(requests).toBe(10);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].pendingIds.length, key)).toBe(0);
  expect(requests).toBe(15);
});

test('a revisit checks only four stale sources and never starts overlapping discovery requests', async ({ page }) => {
  const six = Array.from({ length: 6 }, (_, index) => ({ ...source, key: `folder:${42 + index}`, value: String(42 + index), url: `https://archidekt.com/folders/${42 + index}`, membership: 'selected' }));
  await page.addInitScript(({ key, six, decks }) => { localStorage.setItem(key, JSON.stringify({ version: 1, starter: false, added: decks.slice(0, 2), hidden: [], excluded: [], sources: six })); }, { key, six, decks });
  let requests = 0, active = 0, peak = 0;
  await page.route('**/api/sources?*', async route => {
    requests++; active++; peak = Math.max(peak, active);
    const value = new URL(route.request().url()).searchParams.get('value');
    const saved = six.find(s => s.value === value)!;
    await route.fulfill({ json: { ...saved, checkedAt: new Date().toISOString() } });
    active--;
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources.filter((s: { checkedAt: string }) => s.checkedAt !== '2020-01-01T00:00:00Z').length, key)).toBe(4);
  expect(requests).toBe(4);
  expect(peak).toBe(1);
});

test('folders saved before Follow keep hand-picked choices fixed and follow when whole', async ({ page }) => {
  const whole = { ...source, selectedIds: source.knownIds };
  const picked = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', name: 'Picked folder', folderPath: undefined, checkedAt: new Date().toISOString() };
  await prepare(page, { collection: { version: 1, starter: false, added: decks.slice(0, 2), hidden: [], excluded: [], sources: [picked, whole] } });
  await openSource(page);
  await expect(page.locator('.source-refresh-status')).toContainText('1 new deck added');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources.map((s: { membership?: string }) => s.membership)).toEqual([undefined, 'follow']);
  expect(saved.sources[1].selectedIds).toContain(decks[2].id);
  expect(saved.sources[0].selectedIds).toEqual(source.selectedIds);
});

test('Settings switch: off means no checks and no folder status until it is turned on', async ({ page }) => {
  let requests = 0;
  await prepare(page, { prototype: false });
  await page.route('**/api/sources?*', route => { requests++; return route.fulfill({ json: found }); });
  await openSource(page);
  await expect(page.locator('.source-refresh-status')).toHaveCount(0);
  expect(requests).toBe(0);
  await page.goto('/settings');
  await page.getByRole('button', { name: /New decks.*Only when you press Refresh/ }).click();
  const toggle = page.getByRole('checkbox', { name: /Add new decks automatically/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect.poll(() => requests).toBe(1);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).followOff, key)).toBeUndefined();
});

for (const flow of ['individual', 'folders', 'selected']) test(`background snapshots survive an asynchronous ${flow} import`, async ({ page }) => {
  const current = { ...source, membership: 'selected', checkedAt: new Date().toISOString(), ...(flow === 'selected' ? { knownIds: [...source.knownIds, decks[3].id], entries: [...source.entries, entry(decks[3])] } : {}) };
  const background = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', name: 'Background folder', folderPath: undefined, membership: 'follow', checkedAt: new Date().toISOString() };
  const changed = { ...background, checkedAt: new Date().toISOString(), entries: [...source.entries, entry(decks[2])], knownIds: [...source.knownIds, decks[2].id] };
  await prepare(page, { collection: { version: 1, starter: false, added: decks.slice(0, 2), hidden: [], excluded: [], sources: [current, background] } });
  let releaseC!: () => void, releaseB!: () => void, requestedB = false;
  const cGate = new Promise<void>(resolve => { releaseC = resolve; });
  const bGate = new Promise<void>(resolve => { releaseB = resolve; });
  await page.route('**/api/sources?*', route => route.fulfill({ json: changed }));
  await page.route(`**/api/decks/${decks[2].id}`, async route => { await cGate; await route.fulfill({ json: decks[2] }); });
  await page.route(`**/api/decks/${decks[3].id}`, async route => { requestedB = true; await bGate; await route.fulfill({ json: decks[3] }); });
  await openSource(page);
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: 'Background folder', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  if (flow === 'selected') {
    await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: 'Followed folder', exact: true }).last().click();
    await page.getByRole('checkbox', { name: `Select ${decks[3].name}`, exact: true }).check();
    await page.getByRole('button', { name: 'Add selected decks', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Add decks', exact: true }).click();
    if (flow === 'folders') {
      const folder = { ...source, key: 'folder:100', value: '100', url: 'https://archidekt.com/folders/100', entries: [entry(decks[3])], knownIds: [decks[3].id], selectedIds: undefined, ownedIds: undefined };
      await page.route('**/api/source-folders?*', route => route.fulfill({ json: { name: 'Import folder', folders: [{ source: folder, path: 'Import folder', root: true }] } }));
      await page.locator('#collection-source-input').fill('https://archidekt.com/folders/100');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Select all', exact: true }).click();
      await page.getByRole('button', { name: 'Add 1 deck', exact: true }).click();
    } else {
      await page.locator('#collection-source-input').fill(`https://archidekt.com/decks/${decks[3].id}`);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
  }
  await expect.poll(() => requestedB).toBe(true);
  releaseC();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).added.some((d: { id: string }) => d.id === id), { key, id: decks[2].id })).toBe(true);
  releaseB();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added.length, key)).toBe(4);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources.find((s: { key: string }) => s.key === background.key).checkedAt).toBe(changed.checkedAt);
  expect(saved.sources.find((s: { key: string }) => s.key === background.key).selectedIds).toContain(decks[2].id);
});

test('restoring a backup invalidates an in-flight refresh, even for the same source key', async ({ page }) => {
  await prepare(page, { fresh: true });
  let release!: () => void, requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const aborted = page.waitForEvent('requestfailed', request => request.url().includes(`/api/decks/${decks[2].id}`));
  await page.route(`**/api/decks/${decks[2].id}`, async route => { requested = true; await gate; await route.fulfill({ json: decks[2] }).catch(() => {}); });
  await openSource(page);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('Checking');
  await expect.poll(() => requested).toBe(true);
  const backup = { version: 1, starter: false, added: [decks[3]], hidden: [], excluded: [], sources: [{ ...source, membership: 'selected', entries: [entry(decks[3])], knownIds: [decks[3].id], selectedIds: [decks[3].id], ownedIds: [decks[3].id] }] };
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  release();
  await aborted;
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(backup);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(backup);
});

for (const action of ['bulk', 'individual']) test(`${action} deselection excludes an unsaved Follow deck across refresh and reload`, async ({ page }) => {
  await prepare(page, { fresh: true });
  const extra = Array.from({ length: 11 }, (_, index) => ({ ...decks[2], id: String(991000 + index), name: `Pending trial ${index}` }));
  const last = extra[10];
  await page.route('**/api/sources?*', route => route.fulfill({ json: { ...found, entries: [...decks.slice(0, 2), ...extra].map(entry), knownIds: [...source.knownIds, ...extra.map(d => d.id)] } }));
  let snapshots = 0;
  await page.route('**/api/decks/*', route => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const deck = extra.find(d => d.id === id);
    if (!url.searchParams.has('refresh')) snapshots++;
    return route.fulfill({ json: deck ?? decks.find(d => d.id === id) });
  });
  await openSource(page);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.source-refresh-status')).toContainText('1 still downloading');
  expect(snapshots).toBe(10);
  const checkbox = page.getByRole('checkbox', { name: `Select ${last.name}`, exact: true });
  if (action === 'bulk') {
    // Select all, then clear: the bulk path through the one Select all box.
    const all = page.getByRole('checkbox', { name: 'Select all', exact: true });
    await all.check();
    await all.uncheck();
  } else {
    await checkbox.check();
    await checkbox.uncheck();
  }
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sources[0].excludedIds?.includes(id), { key, id: last.id })).toBe(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].lastChange.added.length, key)).toBe(0);
  expect(snapshots).toBe(10);
  const beforeReload = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(beforeReload.added).toHaveLength(12);
  expect(beforeReload.sources[0].selectedIds).not.toContain(last.id);
  expect(beforeReload.sources[0].pendingIds).not.toContain(last.id);
  await page.reload();
  await openSource(page);
  await expect(checkbox).not.toBeChecked();
  expect(snapshots).toBe(10);
  await checkbox.check();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sources[0].pendingIds?.includes(id), { key, id: last.id })).toBe(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added.length, key)).toBe(13);
  expect(snapshots).toBe(11);
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(after.sources[0].selectedIds).toContain(last.id);
  expect(after.sources[0].excludedIds).not.toContain(last.id);
  if (action === 'bulk') expect(after.sources[0].selectedIds).toEqual([last.id]);
});

test('restored stale sources refresh on later visibility revisits while the old queue stays cancelled', async ({ page }) => {
  const queued = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', membership: 'selected' };
  const initial = { version: 1, starter: false, added: decks.slice(0, 2), hidden: [], excluded: [], sources: [{ ...source, membership: 'follow' }, queued] };
  await page.addInitScript(({ key, initial }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)); }, { key, initial });
  const restored = { ...source, key: 'folder:44', value: '44', url: 'https://archidekt.com/folders/44', membership: 'selected', entries: [entry(decks[3])], knownIds: [decks[3].id], selectedIds: [decks[3].id], ownedIds: [decks[3].id] };
  // A fresh copy of the queued source stays connected; only the retired queue would check it.
  const backup = { version: 1, starter: false, added: [decks[3]], hidden: [], excluded: [], sources: [restored, { ...queued, checkedAt: new Date().toISOString() }] };
  let release!: () => void, requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await page.route('https://card-images.archidekt.com/**', route => route.abort());
  await page.route('**/api/sources?*', route => {
    const value = new URL(route.request().url()).searchParams.get('value')!;
    requests.push(value);
    return route.fulfill({ json: value === '42' ? found : { ...(value === '44' ? restored : queued), checkedAt: new Date().toISOString() } });
  });
  await page.route(`**/api/decks/${decks[2].id}`, async route => { requested = true; await gate; await route.fulfill({ json: decks[2] }).catch(() => {}); });
  await page.addInitScript(id => {
    const state = window as typeof window & { retiredSnapshotAborted?: boolean };
    const fetch = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).includes(`/api/decks/${id}`)) init?.signal?.addEventListener('abort', () => { state.retiredSnapshotAborted = true; }, { once: true });
      return fetch.call(window, input, init);
    };
  }, decks[2].id);
  await page.goto('/');
  await expect.poll(() => requested).toBe(true);
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  async function restore() {
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(backup);
  }
  await restore();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { retiredSnapshotAborted?: boolean }).retiredSnapshotAborted)).toBe(true);
  release();
  for (let revisit = 1; revisit <= 2; revisit++) {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].checkedAt, key)).not.toBe(source.checkedAt);
    expect(requests.filter(value => value === '44')).toHaveLength(revisit);
    expect(requests).not.toContain('43');
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.added).toEqual(backup.added);
    expect(saved.sources[0].selectedIds).toEqual(restored.selectedIds);
    if (revisit === 1) await restore();
  }
});
