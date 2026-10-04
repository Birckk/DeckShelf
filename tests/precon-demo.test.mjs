import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog, updateCatalog } from '../scripts/precon-catalog.mjs';
import { discoverSource } from '../server/sources.mjs';
import { parseCollection, validateDeck } from '../src/domain.ts';
import { freshCollection, addDemo, removeDemo, collectionDecks, showcaseDecks, showcaseGroups, enableGroup, onlyGroup, saveSnapshots, selectSourceDecks, disconnectSource } from '../src/collection.ts';
const legacy = JSON.parse(readFileSync(new URL('../src/data/decks.json', import.meta.url)));
const snapshot = JSON.parse(readFileSync(new URL('../src/data/precons.json', import.meta.url)));
const deck = snapshot.decks[0];
const visible = c => showcaseDecks(c, legacy, collectionDecks(c, legacy));
const ids = decks => decks.map(d => d.id).sort();
const old = { version: 1, hidden: [], excluded: [], added: [] };
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Personal', url: 'https://archidekt.com/folders/42', checkedAt: snapshot.snapshotAt, entries: [{ id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors }], knownIds: [deck.id], selectedIds: [deck.id] };

test('bundled snapshot has complete unique valid metadata, provenance and artwork for every entry', () => {
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.decks.length, snapshot.expectedCount);
  assert.ok(snapshot.decks.length > 29);
  assert.equal(new Set(snapshot.decks.map(d => d.id)).size, snapshot.expectedCount);
  assert.ok(snapshot.decks.every(validateDeck));
  assert.equal(snapshot.account, 'Archidekt_Precons');
  assert.equal(snapshot.sourceUrl, 'https://archidekt.com/commander-precons');
  assert.ok(Number.isFinite(Date.parse(snapshot.snapshotAt)));
  assert.deepEqual(snapshot.unavailable, []);
});
test('fresh profiles show just the full demo; removing and restoring round trips choices', () => {
  const fresh = freshCollection(snapshot);
  assert.deepEqual(ids(visible(fresh)), ids(snapshot.decks));
  const chosen = { ...fresh, hidden: [deck.id], excluded: [snapshot.decks[1].id] };
  const removed = removeDemo(chosen);
  assert.deepEqual(visible(removed), []);
  assert.deepEqual(parseCollection(JSON.stringify(removed)), removed);
  const restored = addDemo(removed, { ...snapshot, decks: [] });
  assert.deepEqual(ids(visible(restored)), ids(visible(chosen)));
  assert.deepEqual(restored.excluded, chosen.excluded);
  assert.deepEqual(visible(enableGroup(chosen, 'demo', false)), []);
  assert.deepEqual(ids(visible(enableGroup(chosen, 'demo', true))), ids(visible(chosen)));
});
test('legacy starter-only and personalized v1 backups never expand automatically', () => {
  for (const profile of [old, { ...old, hidden: [legacy[0].id], excluded: [legacy[1].id] }, { ...old, added: [deck], manualIds: [deck.id], sources: [source], disabledGroups: ['starter', source.key] }]) {
    const restored = parseCollection(JSON.stringify(profile));
    assert.deepEqual(restored, profile);
    assert.deepEqual(ids(visible(restored)), ids(visible(profile)));
    assert.equal(restored.demo, undefined);
  }
  assert.equal(visible(parseCollection(JSON.stringify(old))).length, 29);
});
test('personal source and manual overlaps survive demo removal, backup and disconnect', () => {
  const fresh = freshCollection(snapshot);
  let c = { ...saveSnapshots(fresh, [deck]), sources: [source] };
  c = selectSourceDecks(c, source.key, [deck.id], collectionDecks(c, legacy));
  assert.deepEqual(ids(visible(removeDemo(c))), [deck.id]);
  const paused = enableGroup(removeDemo(c), source.key, false);
  assert.deepEqual(visible(paused), []);
  const manual = { ...paused, manualIds: [deck.id] };
  assert.deepEqual(ids(visible(manual)), [deck.id]);
  assert.deepEqual(parseCollection(JSON.stringify(manual)), manual);
  const disconnected = disconnectSource(c, source.key, legacy, collectionDecks(c, legacy));
  assert.deepEqual(ids(visible(removeDemo(disconnected))), [deck.id]);
  const only = onlyGroup(c, source.key, showcaseGroups(c, legacy, collectionDecks(c, legacy)));
  assert.deepEqual(ids(visible(only)), [deck.id]);
  // Refreshing a demo card is metadata, not a personal import.
  assert.deepEqual(visible(removeDemo(saveSnapshots(fresh, [deck]))), []);
});
test('explicit demo opt-in preserves paused legacy groups and all profile choices', () => {
  const c = { ...old, hidden: [deck.id], excluded: [legacy[0].id], disabledGroups: ['starter'], sources: [source] };
  const next = addDemo(c, snapshot);
  assert.deepEqual(next.hidden, c.hidden);
  assert.deepEqual(next.excluded, c.excluded);
  assert.deepEqual(next.disabledGroups, c.disabledGroups);
  assert.deepEqual(next.sources, c.sources);
  assert.deepEqual(parseCollection(JSON.stringify(next)), next);
});
test('invalid demo backups fail validation rather than silently defaulting', () => {
  const fresh = freshCollection(snapshot);
  for (const demo of [null, {}, { ...fresh.demo, removed: 'yes' }, { ...fresh.demo, decks: [deck, deck] }, { ...fresh.demo, snapshotAt: 'invalid' }, { ...fresh.demo, decks: [{ ...deck, commanders: [] }] }])
    assert.throws(() => parseCollection(JSON.stringify({ ...fresh, demo })));
});
const raw = id => ({ id, name: `Precon ${id}`, owner: { username: 'Archidekt_Precons' }, deckFormat: 3, cards: [{ categories: ['Commander'], quantity: 1, card: { uid: '687a2b76-3f05-4732-bd9b-513d06d16300', artist: 'Artist', oracleCard: { name: 'Commander', colorIdentity: ['Blue'] }, edition: { editionname: 'Sample' } } }] });
const listing = { entries: [{ id: '1', name: 'One' }, { id: '2', name: 'Two' }], expectedCount: 2, pages: 1 };
const options = { discover: async () => listing, readDeck: async id => raw(id), pause: async () => {} };
test('snapshot updates are sequential, validate ownership, and reject changed membership', async () => {
  let active = 0, maximum = 0;
  const result = await buildCatalog({ ...options, readDeck: async id => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 1)); active--; return raw(id); } });
  assert.equal(maximum, 1);
  assert.deepEqual(ids(result.decks), ['1', '2']);
  await assert.rejects(buildCatalog({ ...options, readDeck: async id => ({ ...raw(id), owner: { username: 'other' } }) }), /Unexpected/);
  let calls = 0;
  await assert.rejects(buildCatalog({ ...options, discover: async () => ++calls === 1 ? listing : { ...listing, entries: [{ id: '3' }] } }), /membership changed/);
});
test('upstream and partial failures leave the last usable snapshot byte-for-byte intact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'deckshelf-catalog-'));
  const path = join(dir, 'snapshot.json');
  try {
    const previous = JSON.stringify({ decks: [deck] });
    await writeFile(path, previous);
    for (const opts of [{ ...options, discover: async () => { throw new Error('offline'); } }, { ...options, readDeck: async id => { if (id === '2') throw new Error('HTTP 503'); return raw(id); } }]) {
      await assert.rejects(updateCatalog(path, opts));
      assert.equal(await readFile(path, 'utf8'), previous);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('strict catalog pagination rejects truncated counts, duplicate IDs and changing counts', async t => {
  const row = id => ({ id, name: 'Precon', deckFormat: 3, owner: { username: 'Archidekt_Precons' } });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ count: 2, results: [row(1)], next: null }) }));
  await assert.rejects(discoverSource('account', 'Archidekt_Precons', { strict: true }), /Incomplete/);
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ count: 2, results: [row(1), row(1)], next: null }) }));
  await assert.rejects(discoverSource('account', 'Archidekt_Precons', { strict: true }), /duplicate/);
  let calls = 0;
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ count: ++calls === 1 ? 2 : 3, results: [row(calls)], next: calls === 1 ? 'next' : null }) }));
  await assert.rejects(discoverSource('account', 'Archidekt_Precons', { strict: true }), /changed/);
});
