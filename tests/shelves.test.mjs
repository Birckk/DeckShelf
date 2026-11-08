import test from 'node:test';
import assert from 'node:assert/strict';
import seed from './fixtures/collection-decks.json' with { type: 'json' };
import { addRecent, applyShelfView, keepShelf, putShelfView, readShelfViews, shelfCollection, shelfFromFolders, readKept, readRecent, shelfId, shelfRef, shelfViewOf, writeKept, writeRecent, writeShelfViews, KEPT_KEY, RECENT_KEY, RECENT_LIMIT, VIEWS_KEY, VIEWS_LIMIT } from '../src/shelves.ts';
import { enableGroups, setShown, setSourceSelection, showcaseDecks } from '../src/collection.ts';

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
  assert.deepEqual([...storage.data.keys()].sort((a, b) => a.localeCompare(b)), ['commander-archive.collection.v1', KEPT_KEY, RECENT_KEY].sort((a, b) => a.localeCompare(b)));
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

const friendShelf = () => {
  const decks = seed.slice(0, 3);
  const folder = (key, items) => ({ ...source(key, 'folder'), key: `folder:${key}`, value: key, entries: items.map(d => ({ id: d.id, name: d.name })), knownIds: items.map(d => d.id) });
  return { source: source('Friend'), decks, folders: [
    { source: folder('1', decks.slice(0, 2)), path: 'Friend', root: true },
    { source: folder('2', decks.slice(2)), path: 'Friend / Second', root: false },
  ] };
};

test('a friend\'s shelf starts with everything on and keeps your choices as a small record', () => {
  const shelf = friendShelf();
  const base = shelfCollection(shelf);
  assert.equal(showcaseDecks(base, shelf.decks).length, 3);
  assert.deepEqual(shelfViewOf(base), {});
  const off = enableGroups(base, ['folder:2'], false);
  assert.deepEqual(showcaseDecks(off, shelf.decks).map(d => d.id), shelf.decks.slice(0, 2).map(d => d.id));
  const again = applyShelfView(base, shelfViewOf(off));
  assert.deepEqual(showcaseDecks(again, shelf.decks).map(d => d.id), shelf.decks.slice(0, 2).map(d => d.id));
});

test('single decks switched off stay off, while decks the friend adds later arrive on', () => {
  const shelf = friendShelf();
  const base = shelfCollection(shelf);
  const [first, second] = shelf.decks;
  const off = setSourceSelection(base, ['folder:1'], [first.id], false, shelf.decks);
  const view = shelfViewOf(off);
  assert.deepEqual(view.off, { 'folder:1': [first.id] });
  assert.ok(!showcaseDecks(applyShelfView(base, view), shelf.decks).some(d => d.id === first.id));
  const hidden = shelfViewOf(setShown(base, [second.id], false));
  assert.ok(!showcaseDecks(applyShelfView(base, hidden), shelf.decks).some(d => d.id === second.id));
  // The friend's folder gains a deck: it isn't named in `off`, so it shows.
  const extra = { ...seed[5], id: '555001' };
  const grown = { ...shelf, decks: [...shelf.decks, extra], folders: shelf.folders.map((f, i) => i ? f : { ...f, source: { ...f.source, knownIds: [...f.source.knownIds, extra.id], entries: [...f.source.entries, { id: extra.id, name: extra.name }] } }) };
  assert.ok(showcaseDecks(applyShelfView(shelfCollection(grown), view), grown.decks).some(d => d.id === extra.id));
});

test('per-friend choices save apart, drop bad data and stop growing', () => {
  const storage = memoryStorage();
  assert.deepEqual(readShelfViews(storage), {});
  const views = putShelfView({}, 'account:friend', { disabledGroups: ['folder:2'] });
  assert.ok(writeShelfViews(storage, views));
  assert.deepEqual(readShelfViews(storage), views);
  assert.deepEqual([...storage.data.keys()], [VIEWS_KEY]);
  assert.deepEqual(putShelfView(views, 'account:friend', {}), {});
  storage.setItem(VIEWS_KEY, JSON.stringify({ good: { hidden: ['1'] }, bad: { hidden: 'nope' }, worse: 3, list: [] }));
  assert.deepEqual(readShelfViews(storage), { good: { hidden: ['1'] } });
  storage.setItem(VIEWS_KEY, 'not json');
  assert.deepEqual(readShelfViews(storage), {});
  let many = {};
  for (let i = 0; i < VIEWS_LIMIT + 5; i++) many = putShelfView(many, `account:${i}`, { hidden: ['1'] });
  assert.equal(Object.keys(many).length, VIEWS_LIMIT);
  assert.ok(!many['account:0'] && many[`account:${VIEWS_LIMIT + 4}`]);
  assert.equal(writeShelfViews(undefined, {}), false);
});
