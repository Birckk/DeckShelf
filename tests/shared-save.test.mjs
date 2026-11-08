import { saveSharedCollectionToStorage, saveSharedCollectionWithLock } from '../src/shared-collection-storage.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectionDecks, saveSharedCollection, saveSharedShelf, showcaseGroups, showcaseDecks, removeSources, rememberSource } from '../src/collection.ts';
import { parseCollection, validateSource } from '../src/domain.ts';

const seed = JSON.parse(readFileSync(new URL('./fixtures/collection-decks.json', import.meta.url)));
const deck = { ...seed[0], id: '987001' };
const fresh = { ...seed[1], id: '987002' };
const source = {
  key: 'folder:42', kind: 'folder', value: '42', name: 'Public shelf',
  url: 'https://archidekt.com/folders/42', checkedAt: '2026-10-01T00:00:00Z',
  entries: [deck, fresh].map(d => ({ id: d.id, name: d.name, image: d.commanders[0].art, colors: d.colors })),
  knownIds: [deck.id, fresh.id],
};
function save(collection, shared = source) {
  return saveSharedCollection(collection, shared, [ { ...deck, name: 'Changed upstream' }, fresh ], collectionDecks(collection));
}
const base = () => ({ version: 1, added: [deck], hidden: [], excluded: [], sources: [], disabledGroups: [], archivedGroups: [] });

test('shared Save never claims a legacy individual deck or replaces its snapshot', () => {
  const original = base(); // v1 collections can omit manualIds.
  const saved = save(original);
  assert.equal(saved.added[0], deck);
  assert.deepEqual(saved.manualIds, [deck.id]);
  assert.deepEqual(showcaseGroups(saved, collectionDecks(saved)).find(g => g.key === 'manual').ids, [deck.id]);
  assert.deepEqual(saved.sources[0].ownedIds, [fresh.id]);
  assert.deepEqual(saved.sources[0].selectedIds, [fresh.id]);
  assert.ok(validateSource(saved.sources[0]));
  assert.deepEqual(parseCollection(JSON.stringify(saved)), saved);
  assert.deepEqual(removeSources(saved, [source.key]), { ...original, manualIds: [deck.id] });
});

test('shared Save preserves overlapping hidden choices and individual membership', () => {
  const original = { ...base(), hidden: [deck.id], excluded: [deck.id], manualIds: [deck.id] };
  const saved = save(original);
  assert.deepEqual(saved.hidden, original.hidden);
  assert.deepEqual(saved.excluded, original.excluded);
  assert.deepEqual(saved.manualIds, original.manualIds);
  assert.deepEqual(removeSources(saved, [source.key]), original);
});

for (const selectedIds of [[], [deck.id], undefined]) test(`shared Save preserves existing source selection ${JSON.stringify(selectedIds)} and pause`, () => {
  const priorSource = { ...source, entries: source.entries.slice(0, 1), knownIds: [deck.id],
    ...(selectedIds !== undefined ? { selectedIds } : {}) };
  const original = { ...base(), hidden: [deck.id], sources: [priorSource, { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', entries: [], knownIds: [] }], disabledGroups: [source.key],
    archivedGroups: [source.key], pausedGroups: [{ keys: [source.key, 'folder:43'], enabled: [] }] };
  const saved = save(original);
  assert.deepEqual(saved.hidden, original.hidden);
  assert.deepEqual(saved.disabledGroups, original.disabledGroups);
  assert.deepEqual(saved.archivedGroups, original.archivedGroups);
  assert.deepEqual(saved.pausedGroups, original.pausedGroups);
  assert.deepEqual(saved.sources[0].selectedIds, selectedIds === undefined ? undefined : [...selectedIds, fresh.id]);
  assert.deepEqual(saved.sources[0].ownedIds, [deck.id, fresh.id]);
  assert.equal(saved.sources[0].entries[0], priorSource.entries[0]);
  assert.equal(saved.added[0], deck);
  const overlapping = saveSharedCollection(original, source, [deck], collectionDecks(original));
  const expected = { ...original, sources: [{ ...priorSource, ownedIds: priorSource.knownIds }, original.sources[1]],
    ...(selectedIds?.length === 0 ? { manualIds: [deck.id] } : {}) };
  assert.deepEqual(overlapping, expected);
});

test('shared Save leaves a known deselected listing without a snapshot deselected', () => {
  const prior = { ...source, selectedIds: [], ownedIds: [] };
  const original = { ...base(), added: [], sources: [prior], disabledGroups: [source.key] };
  assert.equal(save(original), original);
});

test('new connection cannot claim a deselected deck already belonging to another source', () => {
  const prior = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [], ownedIds: [deck.id], knownIds: [deck.id], entries: source.entries.slice(0, 1) };
  const original = { ...base(), sources: [prior], disabledGroups: ['folder:43'] };
  const saved = save(original);
  assert.equal(saved.sources[0], prior);
  assert.deepEqual(removeSources(saved, [source.key]), original);
});

test('shared Save connects an entirely overlapping source without taking existing membership', () => {
  const original = base();
  const saved = saveSharedCollection(original, source, [deck], collectionDecks(original));
  assert.deepEqual(saved.sources[0].knownIds, []);
  assert.deepEqual(saved.sources[0].selectedIds, []);
  assert.deepEqual(saved.sources[0].ownedIds, []);
  assert.ok(validateSource(saved.sources[0]));
  assert.deepEqual(removeSources(saved, [source.key]), { ...original, manualIds: [deck.id] });
});

test('shared Save keeps hidden precons and explicit missing membership independent of new sources', () => {
  const original = { ...base(), added: [], hidden: [deck.id], manualIds: [deck.id],
    demo: { snapshotAt: source.checkedAt, decks: [deck], removed: true } };
  const saved = save(original);
  assert.equal(saved.demo, original.demo);
  assert.deepEqual(saved.sources[0].knownIds, [fresh.id]);
  assert.deepEqual(removeSources(saved, [source.key]), original);
});

test('shared Save refuses to exceed a source listing limit without mutating saved data', () => {
  const entries = Array.from({ length: 1000 }, (_, i) => ({ ...source.entries[0], id: String(10000 + i) }));
  const prior = { ...source, entries, knownIds: entries.map(entry => entry.id), selectedIds: [] };
  const original = { ...base(), added: [], sources: [prior] };
  assert.throws(() => save(original), /too much history/);
  assert.equal(original.sources[0], prior);
  assert.deepEqual(original.added, []);
});

test('a later listing refresh and source removal cannot take a legacy individual deck', () => {
  const original = base();
  const saved = save(original);
  const refreshed = rememberSource(saved, source);
  const restored = removeSources(refreshed, [source.key]);
  assert.deepEqual(restored, { ...original, manualIds: [deck.id] });
  assert.deepEqual(showcaseGroups(restored, collectionDecks(restored)), showcaseGroups(original, collectionDecks(original)));
});

const emptyConnection = { ...source, entries: [], knownIds: [], selectedIds: [], ownedIds: [] };
const retainedIds = Array.from({ length: 2000 }, (_, index) => String(100000 + index));
const overlappingSource = { ...source, entries: source.entries.slice(0, 1), knownIds: [deck.id] };
const bundledSource = { ...overlappingSource, entries: [{ ...source.entries[0], id: seed[0].id }], knownIds: [seed[0].id] };
const otherTabDeck = { ...fresh, id: '987003' };
const invariantFixtures = [
  { name: 'latest storage replaces a shared tab stale snapshot', collection: { ...base(), added: [deck, otherTabDeck], hidden: [deck.id], manualIds: [deck.id, otherTabDeck.id] }, shared: source, decks: [deck, fresh], stale: base() },
  { name: 'deselected saved snapshot must stay invisible', collection: { ...base(), added: [seed[0]], sources: [{ ...bundledSource, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [] }] }, shared: bundledSource, decks: [seed[0]] },
  { name: 'retained deselected listing keeps a hidden choice without a snapshot', collection: { ...base(), added: [], hidden: [deck.id], sources: [{ ...overlappingSource, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [] }] } },
  { name: 'unassigned saved snapshot is not claimed by a shared listing', collection: { ...base(), added: [seed[0]] }, shared: bundledSource, decks: [seed[0]] },
  { name: 'legacy Individual deck and new connection', collection: base() },
  { name: 'legacy overlap alongside a new shared deck', collection: base(), shared: source, decks: [deck, fresh] },
  { name: 'paused Individual decks with hidden overlap', collection: { ...base(), hidden: [deck.id], disabledGroups: ['manual'] } },
  { name: 'overlap with a retained deselected paused source', collection: { ...base(), sources: [{ ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [], ownedIds: [deck.id] }], disabledGroups: ['folder:43'], archivedGroups: ['folder:43'] } },
  { name: 'existing connection without new decks', collection: { ...base(), sources: [emptyConnection], disabledGroups: [source.key] } },
  { name: 'hidden Official precon', collection: { ...base(), added: [], hidden: [deck.id], excluded: [deck.id], demo: { snapshotAt: source.checkedAt, decks: [deck], removed: false } } },
  { name: 'hidden Official precon collection', collection: { ...base(), added: [], hidden: [deck.id], demo: { snapshotAt: source.checkedAt, decks: [deck], removed: true }, disabledGroups: ['demo'] } },
  { name: 'membership limit including existing Individual deck', collection: { ...base(), manualIds: [deck.id, ...retainedIds.slice(1)] } },
  { name: 'membership overflow on new connection', collection: { ...base(), manualIds: retainedIds }, fails: true },
  { name: 'membership overflow on existing connection', collection: { ...base(), manualIds: retainedIds, sources: [emptyConnection] }, fails: true },
];

// Removing S intentionally disconnects S even if it already existed. Compare all
// retained groups and choices, and compare inferred versus explicit membership by
// its meaning rather than the presence of a legacy manualIds field.
function retainedState(collection) {
  return {
    added: collection.added,
    decks: collectionDecks(collection),
    demo: collection.demo,
    hidden: collection.hidden,
    excluded: collection.excluded,
    visible: showcaseDecks(collection, collectionDecks(collection)).map(deck => deck.id).sort(),
    groups: showcaseGroups(collection, collectionDecks(collection))
      .filter(group => group.key !== source.key).map(({ key, ids, enabled }) => ({ key, ids, enabled })),
    sources: (collection.sources || []).filter(item => item.key !== source.key),
    disabledGroups: (collection.disabledGroups || []).filter(key => key !== source.key),
    archivedGroups: (collection.archivedGroups || []).filter(key => key !== source.key),
  };
}

for (const fixture of invariantFixtures) test(`save/refresh/remove invariant: ${fixture.name}`, () => {
  const original = fixture.collection;
  const before = JSON.stringify(original);
  assert.doesNotThrow(() => parseCollection(before), 'the starting v1 fixture must be valid');
  const shared = fixture.shared || overlappingSource;
  const storage = { raw: before, writes: 0,
    getItem() { return this.raw; },
    setItem(_key, raw) { this.raw = raw; this.writes++; },
  };
  const runSave = () => fixture.stale
    ? saveSharedCollectionToStorage(storage, 'collection', shared, fixture.decks || [deck], () => fixture.stale)
    : saveSharedCollection(original, shared, fixture.decks || [deck], collectionDecks(original));
  if (fixture.fails) {
    assert.throws(runSave, /saved collection limits/);
  } else {
    const saved = runSave();
    assert.doesNotThrow(() => parseCollection(JSON.stringify(saved)));
    const existingIds = new Set(collectionDecks(original).map(deck => deck.id));
    const visibleBefore = showcaseDecks(original, collectionDecks(original)).map(deck => deck.id).sort();
    assert.deepEqual(showcaseDecks(saved, collectionDecks(saved)).filter(deck => existingIds.has(deck.id)).map(deck => deck.id).sort(), visibleBefore, 'Save cannot activate or hide existing decks');
    assert.deepEqual(saved.hidden, original.hidden);
    assert.deepEqual(saved.disabledGroups, original.disabledGroups);
    assert.deepEqual(saved.archivedGroups, original.archivedGroups);
    for (const prior of original.sources || []) {
      const same = saved.sources.find(item => item.key === prior.key);
      assert.deepEqual(same.selectedIds, prior.selectedIds);
      assert.deepEqual(same.ownedIds, prior.ownedIds);
    }
    if (original.manualIds) assert.deepEqual(saved.manualIds.slice(0, original.manualIds.length), original.manualIds);
    const refreshed = rememberSource(saved, shared);
    assert.doesNotThrow(() => parseCollection(JSON.stringify(refreshed)));
    const removed = removeSources(refreshed, [source.key]);
    assert.doesNotThrow(() => parseCollection(JSON.stringify(removed)));
    assert.deepEqual(retainedState(removed), retainedState(original));
  }
  if (fixture.stale) {
    assert.equal(storage.writes, 1);
    assert.deepEqual(parseCollection(storage.raw).hidden, original.hidden);
    assert.ok(parseCollection(storage.raw).added.some(item => item.id === otherTabDeck.id));
  }
  assert.equal(JSON.stringify(original), before, 'Save must be atomic and never mutate its input');
});

test('storage reconciliation refuses invalid or over-limit latest data without writing', () => {
  for (const raw of ['unreadable', JSON.stringify({ ...base(), manualIds: retainedIds })]) {
    const storage = { getItem: () => raw, setItem: () => assert.fail('failed Save must never write') };
    assert.throws(() => saveSharedCollectionToStorage(storage, 'collection', source, [deck, fresh], base));
    assert.equal(storage.getItem(), raw);
  }
});

test('removal retains snapshots and hidden choices referenced by a deselected listing', () => {
  const owned = { ...overlappingSource, selectedIds: [deck.id], ownedIds: [deck.id] };
  const retained = { ...overlappingSource, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [] };
  const original = { ...base(), hidden: [deck.id], sources: [owned, retained] };
  assert.doesNotThrow(() => parseCollection(JSON.stringify(original)));
  const removed = removeSources(original, [source.key]);
  assert.deepEqual(removed.added, original.added);
  assert.deepEqual(removed.hidden, original.hidden);
  assert.deepEqual(removed.sources, [retained]);
  assert.deepEqual(showcaseDecks(removed, collectionDecks(removed)), []);
  assert.doesNotThrow(() => parseCollection(JSON.stringify(removed)));
});

test('extending a paused legacy source preserves its effective ownership on removal', () => {
  const legacy = { ...overlappingSource, selectedIds: [deck.id] };
  const original = { ...base(), sources: [legacy], disabledGroups: [legacy.key] };
  const saved = saveSharedCollection(original, source, [deck, fresh], collectionDecks(original));
  assert.deepEqual(saved.sources[0].ownedIds, [deck.id, fresh.id]);
  assert.deepEqual(showcaseDecks(saved, collectionDecks(saved)), []);
  const removed = removeSources(rememberSource(saved, source), [source.key]);
  const baseline = removeSources(original, [source.key]);
  assert.deepEqual(retainedState(removed), retainedState(baseline));
  assert.deepEqual(removed.added, []);
});

// xorshift32: the seed and case index identify every generated fixture.
function seededRandom(initial) {
  let state = initial >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}
const propertySeed = 0x24de5e1f;
const random = seededRandom(propertySeed);
const choose = items => items.filter(() => random() < 0.55);
const pool = [seed[0], seed[1], ...seed.slice(0, 4).map((item, index) => ({ ...item, id: String(988001 + index) }))];
function randomSource(value, candidates) {
  const rows = choose(candidates);
  const knownIds = rows.map(deck => deck.id);
  return { key: `folder:${value}`, kind: 'folder', value, name: `Folder ${value}`, url: `https://archidekt.com/folders/${value}`, checkedAt: source.checkedAt,
    entries: rows.map(deck => ({ id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors })), knownIds,
    ...(random() < 0.65 ? { selectedIds: choose(knownIds) } : {}),
    ...(random() < 0.5 ? { ownedIds: choose(knownIds) } : {}) };
}

for (let index = 0; index < 72; index++) {
  const sources = ['43', '44', ...(index % 2 === 0 ? ['42'] : [])].map(value => randomSource(value, pool));
  const original = { version: 1, added: choose(pool), hidden: choose(pool.map(deck => deck.id)), excluded: choose(pool.map(deck => deck.id)), sources,
    ...(random() < 0.5 ? { manualIds: choose(pool.map(deck => deck.id)) } : {}),
    ...(random() < 0.5 ? { demo: { snapshotAt: source.checkedAt, decks: [pool[0]], removed: random() < 0.5 } } : {}) };
  const groups = ['manual', 'demo', ...sources.map(source => source.key)];
  original.disabledGroups = choose(groups);
  original.archivedGroups = choose(groups);
  if (random() < 0.5) original.pausedGroups = [{ keys: sources.map(source => source.key), enabled: choose(sources.map(source => source.key)) }];
  const sharedRows = [...choose(pool), ...(index % 3 !== 0 ? [{ ...fresh, id: String(989000 + index) }] : [])];
  const shared = { ...source, entries: sharedRows.map(deck => ({ id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors })), knownIds: sharedRows.map(deck => deck.id) };
  test(`seeded save/refresh/remove invariant seed=${propertySeed.toString(16)} case=${index}`, () => {
    const before = JSON.stringify(original);
    assert.doesNotThrow(() => parseCollection(before), `generated v1 fixture must be valid: ${before}`);
    const existingIds = new Set(collectionDecks(original).map(deck => deck.id));
    const saved = saveSharedCollection(original, shared, sharedRows, collectionDecks(original));
    assert.doesNotThrow(() => parseCollection(JSON.stringify(saved)));
    const oldVisible = collection => showcaseDecks(collection, collectionDecks(collection)).filter(deck => existingIds.has(deck.id)).map(deck => deck.id).sort();
    assert.deepEqual(oldVisible(saved), oldVisible(original), 'Save preserves the visible set of existing decks');
    const beforeGroups = showcaseGroups(original, collectionDecks(original));
    const savedGroups = showcaseGroups(saved, collectionDecks(saved));
    for (const group of beforeGroups) {
      const after = savedGroups.find(item => item.key === group.key);
      assert.deepEqual(after.ids.filter(id => existingIds.has(id)), group.ids, 'Save preserves effective membership even for hidden or paused groups');
      assert.equal(after.enabled, group.enabled);
    }
    if (!original.sources.some(item => item.key === shared.key))
      assert.deepEqual(savedGroups.find(item => item.key === shared.key).ids.filter(id => existingIds.has(id)), [], 'a new source does not claim existing decks');
    assert.deepEqual(saved.hidden, original.hidden);
    assert.deepEqual(saved.excluded, original.excluded);
    assert.deepEqual(saved.disabledGroups, original.disabledGroups);
    assert.deepEqual(saved.archivedGroups, original.archivedGroups);
    assert.deepEqual(saved.pausedGroups, original.pausedGroups);
    for (const prior of original.sources) {
      const next = saved.sources.find(source => source.key === prior.key);
      const originalIds = new Set(prior.knownIds);
      assert.deepEqual((next.selectedIds ?? next.knownIds).filter(id => originalIds.has(id)), prior.selectedIds ?? prior.knownIds);
      assert.deepEqual((next.ownedIds ?? next.knownIds).filter(id => originalIds.has(id)), prior.ownedIds ?? prior.knownIds);
    }
    const refreshed = rememberSource(saved, shared);
    const removed = removeSources(refreshed, [shared.key]);
    // Existing sources are intentionally removed. Their baseline is removal
    // before Save, rather than retaining the removed connection's own decks.
    const baseline = original.sources.some(source => source.key === shared.key) ? removeSources(original, [shared.key]) : original;
    assert.doesNotThrow(() => parseCollection(JSON.stringify(removed)));
    assert.deepEqual(retainedState(removed), retainedState(baseline), `fixture=${before}`);
    assert.equal(JSON.stringify(original), before, 'no input mutation');
  });
}


test('shared Saves serialize a reentrant read/merge/write across tabs', async () => {
  let tail = Promise.resolve();
  const locks = { request(name, callback) {
    assert.equal(name, 'deckshelf-collection');
    const result = tail.then(callback);
    tail = result.catch(() => {});
    return result;
  } };
  const secondSource = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43' };
  const initial = () => ({ ...base(), added: [] });
  let raw = JSON.stringify(initial());
  /** @type {Promise<void> | undefined} */
  let second;
  let reads = 0;
  const storage = {
    getItem() {
      const snapshot = raw;
      // The other tab attempts Save after this tab reads, before it writes.
      if (++reads === 1) second = saveSharedCollectionWithLock(storage, 'collection', secondSource, [fresh], initial, locks);
      return snapshot;
    },
    setItem(_key, value) { raw = value; },
  };
  await saveSharedCollectionWithLock(storage, 'collection', source, [deck], initial, locks);
  await second;
  const saved = parseCollection(raw);
  assert.deepEqual(saved.added.map(d => d.id), [deck.id, fresh.id]);
  assert.deepEqual(saved.sources.map(s => s.key), [source.key, secondSource.key]);
  assert.equal(reads, 2);
});

test('shared Save keeps the storage transaction fallback when Web Locks are unavailable', async () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const saved = await saveSharedCollectionWithLock(storage, 'collection', source, [fresh], base, null);
  assert.deepEqual(parseCollection(raw), saved);
  assert.deepEqual(saved.added.map(d => d.id), [deck.id, fresh.id]);
});

// Shared accounts and folder trees save like Add decks: one source per folder (#24).
const folderSource = (id, name, decks) => ({
  key: `folder:${id}`, kind: 'folder', value: String(id), name, url: `https://archidekt.com/folders/${id}`,
  checkedAt: '2026-10-18T00:00:00Z', formatScope: 'all',
  entries: decks.map(d => ({ id: d.id, name: d.name, image: d.commanders[0]?.art || '', colors: d.colors })), knownIds: decks.map(d => d.id),
});
const third = { ...seed[2], id: '987003' };
const account = { key: 'account:birckk', kind: 'account', value: 'Birckk', name: 'Birckk', url: 'https://archidekt.com/u/Birckk', checkedAt: '2026-10-18T00:00:00Z', formatScope: 'all', entries: [], knownIds: [] };
const folders = [
  { source: folderSource(1, 'Home', []), path: 'Home', root: true },
  { source: folderSource(2, 'Owned', [deck]), path: 'Home / Owned', root: false },
  { source: folderSource(3, 'New', [fresh, third]), path: 'Home / New', root: false },
];

test('shared Save stores a folder tree under its account, skipping folders with nothing new', () => {
  const original = { ...base(), hidden: [deck.id], manualIds: [deck.id] };
  const saved = saveSharedShelf(original, account, [deck, fresh, third], folders);
  assert.deepEqual(saved.sources.map(s => [s.key, s.folderPath, s.connectionKey, s.connectionName]), [['folder:3', 'Home / New', 'account:birckk', 'Birckk']]);
  assert.deepEqual(saved.sources[0].ownedIds, [fresh.id, third.id]);
  assert.deepEqual(saved.hidden, [deck.id]);
  assert.deepEqual(saved.manualIds, [deck.id]);
  assert.equal(saved.added[0], deck);
  parseCollection(JSON.stringify(saved));
  // Removing the saved connection brings back exactly the original decks.
  const removed = removeSources(saved, saved.sources.map(s => s.key));
  assert.deepEqual(collectionDecks(removed).map(d => d.id), collectionDecks(original).map(d => d.id));
});

test('shared Save widens a Commander-only folder that gains other formats without dropping decks', () => {
  const modern = { ...fresh, format: { id: 'modern', name: 'Modern', sourceId: 2 }, commanders: [], cover: { ...fresh.commanders[0], kind: 'featured' } };
  const owned = { ...folderSource(3, 'New', [third]), formatScope: undefined, selectedIds: [third.id], ownedIds: [third.id] };
  const original = { ...base(), added: [deck, third], sources: [owned] };
  const saved = saveSharedShelf(original, account, [modern, third], [{ source: folderSource(3, 'New', [modern, third]), path: 'Home / New', root: false }]);
  assert.equal(saved.sources[0].formatScope, 'all');
  assert.deepEqual(saved.sources[0].selectedIds, [third.id, modern.id]);
  assert.deepEqual(saved.added.map(d => d.id), [deck.id, third.id, modern.id]);
});
