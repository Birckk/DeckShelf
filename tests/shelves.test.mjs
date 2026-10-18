import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../src/data/decks.json' with { type: 'json' };
import { addRecent, keepShelf, shelfFromFolders, readKept, readRecent, shelfId, shelfRef, writeKept, writeRecent, KEPT_KEY, RECENT_KEY, RECENT_LIMIT } from '../src/shelves.ts';

const source = (value, kind = 'account') => ({ key: `${kind}:${value.toLowerCase()}`, kind, value, name: value, url: `https://archidekt.com/u/${value}`, checkedAt: '2026-10-18T00:00:00Z', entries: [], knownIds: [] });
const memoryStorage = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }; };

test('recently viewed puts the latest first, once, within the limit', () => {
  let list = [];
  for (let i = 0; i < RECENT_LIMIT + 3; i++) list = addRecent(list, shelfRef({ source: source(`user${i}`), decks: seed.slice(0, 2) }));
  list = addRecent(list, shelfRef({ source: source('USER5'), decks: [] }));
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(shelfId(list[0]), 'account:user5');
  assert.equal(list.filter(ref => shelfId(ref) === 'account:user5').length, 1);
});

test('keeping a shelf again refreshes its snapshot in place', () => {
  const a = { source: source('Birckk'), decks: seed.slice(0, 3) }, b = { source: source('42', 'folder'), decks: seed.slice(3, 4) };
  let kept = keepShelf(keepShelf([], a, '2026-10-01T00:00:00Z'), b);
  kept = keepShelf(kept, { ...a, decks: seed.slice(0, 1) }, '2026-10-18T00:00:00Z');
  assert.deepEqual(kept.map(shelf => shelfId(shelf.source)), ['account:birckk', 'folder:42']);
  assert.equal(kept[0].decks.length, 1);
  assert.equal(kept[0].keptAt, '2026-10-01T00:00:00Z');
});

test('stored lists round trip and drop damaged entries without failing', () => {
  const storage = memoryStorage();
  const shelf = { source: source('Birckk'), decks: seed.slice(0, 2) };
  assert.ok(writeKept(storage, keepShelf([], shelf)));
  assert.ok(writeRecent(storage, [shelfRef(shelf)]));
  assert.deepEqual(readKept(storage)[0].decks, shelf.decks);
  assert.equal(readRecent(storage)[0].name, 'Birckk');
  const good = JSON.parse(storage.getItem(RECENT_KEY))[0];
  storage.setItem(RECENT_KEY, JSON.stringify([good, { ...good, art: ['javascript:alert(1)'] }, { ...good, kind: 'deck' }, null]));
  storage.setItem(KEPT_KEY, JSON.stringify([{ source: source('x'), decks: [{ id: 'nope' }], keptAt: '2026-10-18T00:00:00Z' }]));
  assert.equal(readRecent(storage).length, 1);
  assert.deepEqual(readKept(storage), []);
  storage.setItem(KEPT_KEY, '{not json');
  assert.deepEqual(readKept(storage), []);
  assert.deepEqual(readKept(undefined), []);
});

test('shelf lists never touch the saved collection and survive a full or blocked storage', () => {
  const storage = memoryStorage();
  storage.setItem('commander-archive.collection.v1', '{"version":1}');
  writeKept(storage, keepShelf([], { source: source('Birckk'), decks: seed.slice(0, 1) }));
  writeRecent(storage, []);
  assert.equal(storage.getItem('commander-archive.collection.v1'), '{"version":1}');
  assert.deepEqual([...storage.data.keys()].sort(), ['commander-archive.collection.v1', KEPT_KEY, RECENT_KEY].sort());
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.equal(writeKept(full, []), false);
  assert.equal(writeRecent(undefined, []), false);
});

test('a shared account becomes the union of its public folders, in every format', () => {
  const folder = (id, decks, root = false) => ({ path: `Home${root ? '' : ' / ' + id}`, root, source: {
    key: `folder:${id}`, kind: 'folder', value: String(id), name: String(id), url: `https://archidekt.com/folders/${id}`, checkedAt: '2026-10-18T00:00:00Z', formatScope: 'all',
    entries: decks.map(d => ({ id: d.id, name: d.name, image: '', colors: d.colors })), knownIds: decks.map(d => d.id) } });
  const found = { name: 'Birckk', folders: [folder(1, seed.slice(0, 1), true), folder(2, seed.slice(0, 3))] };
  const { source, folders } = shelfFromFolders({ kind: 'account', value: 'Birckk' }, found);
  assert.equal(source.key, 'account:birckk');
  assert.equal(source.formatScope, 'all');
  assert.deepEqual(source.knownIds, seed.slice(0, 3).map(d => d.id));
  assert.deepEqual(folders.map(f => f.path), ['Home', 'Home / 2']);
  assert.equal(shelfFromFolders({ kind: 'folder', value: '1' }, found).source.key, 'folder:1');
  assert.throws(() => shelfFromFolders({ kind: 'folder', value: '2' }, found));
  assert.throws(() => shelfFromFolders({ kind: 'account', value: 'Birckk' }, { ...found, folders: found.folders.map(f => ({ ...f, root: true })) }));
  assert.throws(() => shelfFromFolders({ kind: 'account', value: 'Birckk' }, { name: 'Birckk', folders: [] }));
  assert.throws(() => shelfFromFolders({ kind: 'account', value: 'Birckk' }, null));
});
