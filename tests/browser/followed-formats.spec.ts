import { test, expect } from '@playwright/test';
import fixture from '../fixtures/collection-decks.json' with { type: 'json' };
import modernRaw from '../fixtures/archidekt-modern.json' with { type: 'json' };
import { normalizeDeck } from '../../server/api.mjs';
import { coverOf, formatOf, type Deck } from '../../src/domain';

const key = 'commander-archive.collection.v1';
const modern = normalizeDeck(modernRaw);
const decks = [fixture[0], modern] as Deck[];
const entry = (deck: Deck) => ({ id: deck.id, name: deck.name, image: coverOf(deck).art, colors: deck.colors, format: formatOf(deck) });

for (const trial of [false, true]) test(`All-formats refresh preserves scope with trial ${trial}`, async ({ page }) => {
  const source = { key: 'folder:88', kind: 'folder', value: '88', name: 'Mixed formats', url: 'https://archidekt.com/folders/88', formatScope: 'all',
    checkedAt: trial ? '2020-01-01T00:00:00Z' : new Date().toISOString(), entries: decks.map(entry), knownIds: decks.map(deck => deck.id), selectedIds: decks.map(deck => deck.id), ownedIds: decks.map(deck => deck.id), membership: 'follow' };
  const collection = { version: 1, starter: false, added: decks, hidden: [], excluded: [], sources: [source], ...(trial ? {} : { followOff: true }) };
  await page.addInitScript(({ key, collection }) => {
    localStorage.setItem(key, JSON.stringify(collection));
  }, { key, collection });
  const scopes: string[] = [];
  await page.route('**/api/sources?*', route => {
    const scope = new URL(route.request().url()).searchParams.get('formats') || 'commander';
    scopes.push(scope);
    const entries = scope === 'all' ? source.entries : source.entries.slice(0, 1);
    return route.fulfill({ json: { ...source, entries, knownIds: entries.map(entry => entry.id), checkedAt: new Date().toISOString() } });
  });
  await page.route('**/api/decks/*', route => route.fulfill({ json: decks.find(deck => new URL(route.request().url()).pathname.endsWith(deck.id)) }));
  await page.route('https://card-images.archidekt.com/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await page.getByRole('navigation', { name: 'Collection sources' }).getByRole('button', { name: 'Mixed formats', exact: true }).click();
  if (trial) await expect.poll(() => scopes).toEqual(['all']);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => scopes.length).toBe(trial ? 2 : 1);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].entries.length, key)).toBe(2);
  expect(scopes.every(scope => scope === 'all')).toBe(true);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.sources[0].formatScope).toBe('all');
  expect(saved.sources[0].lastChange?.unlisted || []).toEqual([]);
  expect(saved.added.map((deck: { id: string }) => deck.id)).toEqual(decks.map(deck => deck.id));
});
