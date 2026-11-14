import { test, expect, type Page } from '@playwright/test';
import seed from '../fixtures/collection-decks.json' with { type: 'json' };

// The website draws shelves from Archidekt's folder listings and reads a deck in full only when
// it is opened (#169). The Windows app's full fetch is covered in share-links and followed-refresh.
const key = 'commander-archive.collection.v1';
const deck = { ...seed[0], id: '987001', name: 'Shared Commander', tags: ['Tokens'] };
const hidden = { ...seed[1], id: '987003', name: 'Private deck' };
const listed = [deck, hidden].map(d => ({ id: d.id, name: d.name, image: d.commanders[0].art, colors: d.colors, tags: d.tags, cardCount: 100, updatedAt: '2026-11-01T00:00:00Z' }));
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Public shelf', url: 'https://archidekt.com/folders/42',
  checkedAt: new Date().toISOString(), entries: listed, knownIds: listed.map(e => e.id) };
const tree = { name: source.name, folders: [{ source, path: source.name, root: true }] };

function countRequests(page: Page) {
  const seen = { decks: [] as string[], listings: 0 };
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/decks/')) seen.decks.push(path.split('/').pop()!);
    if (path === '/api/source-folders') seen.listings++;
  });
  return seen;
}

test('a shared shelf on the website is drawn from the listing and reads a deck only when opened', async ({ page }) => {
  const seen = countRequests(page);
  await page.route('**/api/source-folders?*', route => route.fulfill({ json: tree }));
  await page.route('**/api/decks/987001', route => route.fulfill({ json: deck }));
  await page.route('**/api/decks/987003', route => route.fulfill({ status: 424, json: { error: 'Use a public deck from Archidekt.', retry: false } }));
  await page.goto('/f/42');
  const count = page.locator('.result-count');
  // Complete from the listing: no loading count, and Save is ready at once.
  await expect(count).toHaveText('2 decks');
  await expect(page.getByRole('button', { name: 'View Shared Commander', exact: true })).toBeVisible();
  // React's development mode may start (and abort) the first read twice; nothing reads it again after.
  const listings = seen.listings;
  await page.getByRole('button', { name: 'Public shelf library', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save to my library', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back to Public shelf', exact: true }).click();
  expect(seen.decks).toEqual([]);

  await page.getByRole('button', { name: 'View Shared Commander', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Deck details' });
  // The listing's tag is there before the details arrive; the commander comes with them.
  await expect(details.getByRole('button', { name: 'Tokens' })).toBeVisible();
  await expect(details.getByText(deck.commanders[0].name)).toBeVisible();
  await expect(details.getByText('100 cards')).toBeVisible();
  expect(seen.decks).toEqual(['987001']);
  await page.keyboard.press('Escape');

  // A deck that cannot load stays on the shelf and says why.
  await page.getByRole('button', { name: 'View Private deck', exact: true }).click();
  await expect(details.getByText('Details couldn’t load. Use a public deck from Archidekt.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(count).toHaveText('2 decks');

  // Opening the loaded deck again costs nothing.
  await page.getByRole('button', { name: 'View Shared Commander', exact: true }).click();
  await expect(details.getByText(deck.commanders[0].name)).toBeVisible();
  expect(seen.decks).toEqual(['987001', '987003']);
  expect(seen.listings).toBe(listings);
});

test('a bookmarked listing shelf opens from its snapshot without reading Archidekt', async ({ page }) => {
  const seen = countRequests(page);
  const decks = listed.map(entry => ({ format: { id: 'commander', name: 'Commander', sourceId: 3 }, cover: { kind: 'featured', name: '', artist: '', image: entry.image, art: entry.image },
    id: entry.id, name: entry.name, set: '', colors: entry.colors, theme: '', tags: entry.tags, description: '', commanders: [],
    sourceUrl: `https://archidekt.com/decks/${entry.id}`, sourceName: 'Archidekt', cardCount: 100, releasedAt: '', fetchedAt: '', partial: true, updatedAt: entry.updatedAt }));
  await page.addInitScript(kept => localStorage.setItem('deckshelf.kept-shelves.v1', JSON.stringify(kept)),
    [{ source: { ...source, formatScope: 'all' }, decks, folders: tree.folders, keptAt: new Date().toISOString() }]);
  await page.route('**/api/**', route => route.fulfill({ status: 500, json: { error: 'unexpected' } }));
  await page.goto('/f/42');
  await expect(page.locator('.result-count')).toHaveText('2 decks');
  expect(seen.listings).toBe(0);
  expect(seen.decks).toEqual([]);
});

test('on the website a followed folder adds new decks from its listing without reading them', async ({ page }) => {
  const seen = countRequests(page);
  const [first, second] = listed;
  const saved = { version: 1, hidden: [], excluded: [], added: [{ ...seed[0], id: first.id, name: first.name }],
    sources: [{ ...source, checkedAt: '2020-01-01T00:00:00Z', entries: [first], knownIds: [first.id], membership: 'follow' }] };
  await page.addInitScript(({ key, saved }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved)); }, { key, saved });
  await page.route('**/api/sources?*', route => route.fulfill({ json: { ...source, entries: [first, second], knownIds: [first.id, second.id] } }));
  await page.route('**/api/decks/*', route => route.fulfill({ status: 500, json: { error: 'unexpected' } }));
  await page.goto('/');
  await expect.poll(async () => (await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added, key))
    .map((d: { id: string; partial?: boolean; tags: string[] }) => [d.id, !!d.partial, d.tags.join()])).toEqual([[first.id, false, ''], [second.id, true, '']]);
  // The full deck saved before this listing had no edit time; it keeps its details and learns it.
  const added = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added, key);
  expect(added[0].commanders.length).toBeGreaterThan(0);
  expect(added[0].updatedAt).toBe(first.updatedAt);
  expect(seen.decks).toEqual([]);
});
