import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archidektFormat, formatOf, formatName, validFormat } from '../shared/formats.mjs';
import { parseCollection } from '../src/domain.ts';
import { validateDeck, coverOf, matchesDeck, EMPTY_FILTERS, pickerDecks } from '../src/domain.ts';
import { normalizeDeck } from '../server/api.mjs';
import { discoverSource } from '../server/sources.mjs';
import { importFolderSelection, showcaseDecks, rememberSource } from '../src/collection.ts';

const deck = JSON.parse(readFileSync(new URL('./fixtures/collection-decks.json', import.meta.url)))[0];
const modernRaw = JSON.parse(readFileSync(new URL('./fixtures/archidekt-modern.json', import.meta.url)));

test('Archidekt format map retains identities, including unknown and Commander variants', () => {
  for (const [id, name] of [[1, 'Standard'], [2, 'Modern'], [3, 'Commander'], [6, 'Pauper'], [13, 'Standard Brawl'], [17, 'Pauper EDH'], [20, 'Brawl'], [27, 'Tiny Leaders Reborn']]) {
    assert.equal(archidektFormat(id).name, name);
    assert.equal(formatName(archidektFormat(id).id), name);
    assert.ok(validFormat(archidektFormat(id)));
  }
  for (const id of [0, 19, 99, null, undefined, '3']) {
    assert.match(archidektFormat(id).name, /^Unknown/);
    assert.ok(validFormat(archidektFormat(id)));
  }
  assert.notEqual(archidektFormat(99).id, archidektFormat(100).id);
  assert.equal(formatName('unknown-99'), 'Unknown (99)');
  for (const bad of [{}, { ...archidektFormat(2), name: 'Commander' }, { ...archidektFormat(null), sourceId: -1 }, { ...archidektFormat(3), sourceId: -1 }]) assert.equal(validFormat(bad), false);
});

test('real Modern response uses featured artwork without inventing a commander', () => {
  const modern = normalizeDeck(modernRaw);
  assert.ok(validateDeck(modern));
  assert.equal(modern.format.id, 'modern');
  assert.deepEqual(modern.commanders, []);
  assert.equal(modern.cover.kind, 'featured');
  assert.equal(modern.cover.art, modernRaw.featured);
  // A featured card's printing says nothing about the deck, so it sets neither.
  assert.equal(modern.set, '');
  assert.equal(modern.releasedAt, '');
  assert.match(modern.cover.image, /\/grid\/front\//);
  assert.deepEqual(modern.colors, ['R']);
  assert.equal(modern.cardCount, 27, 'fixture is trimmed, not a complete decklist');
  assert.equal(coverOf(modern), modern.cover);
  assert.equal(coverOf(deck), deck.commanders[0]);
});

test('featured art given as an Archidekt storage crop still becomes the cover', () => {
  const uid = modernRaw.featured.match(/([a-f0-9-]{36})\.webp$/)[1];
  const modern = normalizeDeck({ ...modernRaw, featured: `https://storage.googleapis.com/archidekt-card-images/inr/${uid}_art_crop.jpg` });
  assert.equal(modern.cover.kind, 'featured');
  assert.equal(modern.cover.art, modernRaw.featured);
  assert.ok(validateDeck(modern));
  for (const featured of ['https://storage.googleapis.com/other-bucket/inr/' + uid + '_art_crop.jpg', 'https://example.com/' + uid + '_art_crop.jpg'])
    assert.equal(normalizeDeck({ ...modernRaw, featured }).cover.kind, 'fallback');
});
test('formats without featured art have a labelled fallback; sideboards do not affect identity or main count', () => {
  const raw = { ...modernRaw, featured: '', deckFormat: 99, cards: [...modernRaw.cards, { ...modernRaw.cards[0], quantity: 15, categories: ['Sideboard'], card: { ...modernRaw.cards[0].card, oracleCard: { name: 'Sideboard', colorIdentity: ['Blue'] } } }] };
  const unknown = normalizeDeck(raw);
  assert.ok(validateDeck(unknown));
  assert.equal(unknown.cover.kind, 'fallback');
  assert.equal(coverOf(unknown).name, 'No cover selected');
  assert.equal(unknown.format.sourceId, 99);
  assert.deepEqual(unknown.colors, ['R']);
  assert.equal(unknown.cardCount, 27);
  for (const cover of [{ ...unknown.cover, image: 'javascript:alert(1)' }, { ...unknown.cover, kind: 'featured' }, { ...unknown.cover, kind: 'other' }]) assert.equal(validateDeck({ ...unknown, cover }), false);
  assert.equal(validateDeck({ ...unknown, format: undefined }), false, 'legacy Commander decks cannot lose their commander');
});

test('all-format discovery removes account query restriction, retains unknown formats and excludes private decks', async t => {
  const calls = [];
  const rows = [3, 2, 1, 6, 99].map((deckFormat, index) => ({ id: index + 1, name: `Deck ${index}`, deckFormat, owner: { username: 'Example' }, colors: {}, private: false }));
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return { ok: true, json: async () => ({ results: [...rows, { ...rows[0], id: 7, private: true }], next: null }) }; });
  const all = await discoverSource('account', 'Example', { formatScope: 'all' });
  assert.equal(new URL(calls[0]).searchParams.has('deckFormat'), false);
  assert.deepEqual(all.entries.map(formatOf).map(f => f.id), ['commander', 'modern', 'standard', 'pauper', 'unknown-99']);
  assert.equal(all.formatScope, 'all');
  const legacy = await discoverSource('account', 'Example');
  assert.equal(new URL(calls[1]).searchParams.get('deckFormat'), '3');
  assert.deepEqual(legacy.knownIds, ['1']);
  await assert.rejects(discoverSource('account', 'Example', { strict: true, formatScope: 'all' }));
});

test('mixed imports, filters, picker and v1 backups preserve format identity and overlapping selections', () => {
  const modern = normalizeDeck(modernRaw);
  const unknown = normalizeDeck({ ...modernRaw, id: 99, deckFormat: 99, featured: '' });
  const source = { key: 'folder:1', kind: 'folder', value: '1', name: 'Mixed', url: 'https://archidekt.com/folders/1', checkedAt: modern.fetchedAt, formatScope: 'all', entries: [deck, modern, unknown].map(d => ({ id: d.id, name: d.name, colors: d.colors, image: coverOf(d).art, format: formatOf(d) })), knownIds: [deck.id, modern.id, unknown.id] };
  const base = { version: 1, hidden: ['999'], excluded: [modern.id], added: [] };
  let c = importFolderSelection(base, [source], [deck, modern, unknown], []);
  c = importFolderSelection(c, [{ ...source, key: 'folder:2', value: '2', url: 'https://archidekt.com/folders/2' }], [modern], c.added);
  const restored = parseCollection(JSON.stringify(c));
  assert.deepEqual(restored, c);
  assert.deepEqual(restored.hidden, ['999']);
  assert.deepEqual(restored.excluded, [modern.id]);
  const all = showcaseDecks(restored, restored.added);
  assert.equal(all.length, 3);
  assert.deepEqual(all.filter(d => matchesDeck(d, EMPTY_FILTERS)).map(d => d.id), [deck.id]);
  assert.equal(all.filter(d => matchesDeck(d, { ...EMPTY_FILTERS, format: 'all' })).length, 3);
  assert.deepEqual(all.filter(d => matchesDeck(d, { ...EMPTY_FILTERS, format: 'modern' })).map(d => d.id), [modern.id]);
  assert.deepEqual(pickerDecks(all, 'commander').map(d => d.id), [deck.id]);
  assert.deepEqual(pickerDecks(all, 'modern', [deck.id, modern.id]).map(d => d.id), [modern.id]);
  assert.deepEqual(pickerDecks(all, 'modern', [unknown.id]), []);
  assert.deepEqual(pickerDecks(all, 'all'), []);
  assert.deepEqual(pickerDecks(all, 'unknown-99').map(d => d.id), [unknown.id]);
  const refreshed = rememberSource(c, { ...source, entries: [], knownIds: [] });
  assert.deepEqual(refreshed.sources.find(s => s.key === source.key).selectedIds, [deck.id, modern.id, unknown.id]);
  assert.equal(parseCollection(JSON.stringify(refreshed)).sources.find(s => s.key === source.key).formatScope, 'all');
});

test('v1 migration keeps legacy bytes and overlapping memberships, hidden and excluded IDs', () => {
  const source = id => ({ key: `folder:${id}`, kind: 'folder', value: id, name: 'Test', url: `https://archidekt.com/folders/${id}`, checkedAt: deck.fetchedAt, entries: [{ id: deck.id, name: deck.name, image: '', colors: [] }], knownIds: [deck.id], selectedIds: [deck.id], ownedIds: [deck.id] });
  const legacy = { version: 1, hidden: [deck.id], excluded: [deck.id], added: [deck], sources: [source('1'), source('2')], demo: { snapshotAt: deck.fetchedAt, removed: true, decks: [deck] } };
  const restored = parseCollection(JSON.stringify(legacy));
  assert.deepEqual(restored, legacy);
  assert.equal(formatOf(restored.added[0]).id, 'commander');
  assert.equal(formatOf(restored.demo.decks[0]).id, 'commander');
  assert.equal(formatOf(restored.sources[0].entries[0]).id, 'commander');
  const explicit = { ...legacy, added: [{ ...deck, format: archidektFormat(2) }] };
  assert.deepEqual(parseCollection(JSON.stringify(explicit)), explicit);
  assert.throws(() => parseCollection(JSON.stringify({ ...explicit, added: [{ ...deck, format: { ...archidektFormat(2), id: 'commander' } }] })));
});

test('widening a legacy source keeps unticked saved decks in paused Individual decks', () => {
  const modern = normalizeDeck(modernRaw);
  const entry = d => ({ id: d.id, name: d.name, image: coverOf(d).art, colors: d.colors, format: formatOf(d) });
  const source = { key: 'folder:1', kind: 'folder', value: '1', name: 'Legacy', url: 'https://archidekt.com/folders/1', checkedAt: deck.fetchedAt, entries: [entry(deck)], knownIds: [deck.id] };
  const base = { version: 1, hidden: ['999'], excluded: [modern.id], added: [deck, modern], sources: [source], manualIds: [modern.id], disabledGroups: ['manual'] };
  const widened = { ...source, formatScope: 'all', entries: [entry(deck), entry(modern)], knownIds: [deck.id, modern.id] };
  const result = importFolderSelection(base, [widened], [deck], base.added);
  assert.deepEqual(result.sources[0].knownIds, [deck.id, modern.id]);
  assert.deepEqual(result.sources[0].selectedIds, [deck.id]);
  assert.deepEqual(result.sources[0].ownedIds, [deck.id]);
  assert.deepEqual(showcaseDecks(result, result.added).map(d => d.id), [deck.id]);
  assert.deepEqual(result.hidden, base.hidden);
  assert.deepEqual(result.excluded, base.excluded);
  assert.deepEqual(result.manualIds, [modern.id]);
  assert.deepEqual(parseCollection(JSON.stringify(result)), result);
  assert.equal(base.sources[0].selectedIds, undefined, 'original legacy profile is unchanged');
});

test('re-adding Commander decks preserves an all-format connection and its other entries', () => {
  const modern = normalizeDeck(modernRaw);
  const entry = d => ({ id: d.id, name: d.name, image: coverOf(d).art, colors: d.colors, format: formatOf(d) });
  const source = { key: 'folder:1', kind: 'folder', value: '1', name: 'Mixed', url: 'https://archidekt.com/folders/1', checkedAt: deck.fetchedAt, formatScope: 'all', entries: [entry(deck), entry(modern)], knownIds: [deck.id, modern.id], selectedIds: [deck.id, modern.id] };
  const base = { version: 1, hidden: [], excluded: [], added: [deck, modern], sources: [source] };
  const commanderOnly = { ...source, formatScope: 'commander', entries: [entry(deck)], knownIds: [deck.id] };
  const result = importFolderSelection(base, [commanderOnly], [deck], base.added);
  assert.equal(result.sources[0].formatScope, 'all');
  assert.deepEqual(result.sources[0].entries, source.entries);
  assert.deepEqual(result.sources[0].selectedIds, source.selectedIds);
  assert.deepEqual(result.sources[0].knownIds, source.knownIds);
  assert.deepEqual(parseCollection(JSON.stringify(result)), result);
});
