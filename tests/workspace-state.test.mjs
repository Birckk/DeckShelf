import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCollection } from '../src/domain.ts';
import { enableGroups, enableGroup, onlyGroup, rememberSource, setSourceSelection, showcaseDecks, showcaseGroups, removeSources } from '../src/collection.ts';
const deck = JSON.parse(readFileSync(new URL('./fixtures/collection-decks.json', import.meta.url)))[0];
const makeSource = id => ({ key: `folder:${id}`, kind: 'folder', value: id, name: `Folder ${id}`, url: `https://archidekt.com/folders/${id}`, checkedAt: '2026-10-04T12:00:00Z', knownIds: [deck.id], selectedIds: [deck.id], entries: [{ id: deck.id, name: deck.name, colors: deck.colors, image: deck.commanders[0].art }] });
const base = { version: 1, added: [deck], hidden: [], excluded: [deck.id], sources: [makeSource('42'), makeSource('43')] };

test('source deselection preserves overlaps and does not leak into Individual decks', () => {
  const one = setSourceSelection(base, ['folder:42'], [deck.id], false, [deck]);
  assert.equal(showcaseDecks(one, [deck]).length, 1);
  const neither = setSourceSelection(one, ['folder:43'], [deck.id], false, [deck]);
  assert.deepEqual(showcaseDecks(neither, [deck]), []);
  assert.deepEqual(showcaseGroups(neither, [deck]).find(g => g.key === 'manual').ids, []);
  assert.deepEqual(neither.excluded, [deck.id]);
  const restored = parseCollection(JSON.stringify(neither));
  assert.deepEqual(restored, neither);
  assert.equal(showcaseDecks(setSourceSelection(restored, ['folder:42'], [deck.id], true, [deck]), [deck]).length, 1);
});

test('discovering an overlapping source does not steal legacy individual imports', () => {
  const legacy = { version: 1, added: [deck], hidden: [], excluded: [] };
  const discovered = rememberSource(legacy, { ...makeSource('42'), selectedIds: [] });
  assert.deepEqual(showcaseGroups(discovered, [deck]).find(g => g.key === 'manual').ids, [deck.id]);
  assert.equal(showcaseDecks(discovered, [deck]).length, 1);
});

test('hierarchy and retained membership survive refresh, backup and removal', () => {
  const source = { ...makeSource('42'), folderPath: 'Home / Test / Mono-color', connectionKey: 'account:birckk', connectionName: 'Birckk' };
  const c = setSourceSelection({ ...base, sources: [source] }, [source.key], [deck.id], false, [deck]);
  const refreshed = rememberSource(c, makeSource('42'));
  assert.equal(refreshed.sources[0].folderPath, source.folderPath);
  assert.deepEqual(refreshed.sources[0].ownedIds, [deck.id]);
  assert.deepEqual(parseCollection(JSON.stringify(refreshed)), refreshed);
  const detached = removeSources(refreshed, [source.key]);
  assert.deepEqual(detached.added, []);
  assert.deepEqual(showcaseDecks(detached, []), []);
});


test('parent pause resumes the previous subset across backup and leaves deck choices intact', () => {
  const keys = ['folder:42', 'folder:43'];
  const partial = enableGroup(base, keys[1], false);
  const paused = enableGroups(partial, keys, false);
  assert.deepEqual(showcaseDecks(paused, [deck]), []);
  const restored = enableGroups(parseCollection(JSON.stringify(paused)), [...keys].reverse(), true);
  assert.deepEqual(restored.disabledGroups, [keys[1]]);
  assert.deepEqual(restored.sources, base.sources);
  assert.deepEqual(restored.excluded, base.excluded);
  assert.equal(showcaseDecks(restored, [deck]).length, 1);
  assert.deepEqual(enableGroups(paused, keys, true, true).disabledGroups, []);
  assert.deepEqual(enableGroups(enableGroups(paused, keys, false, true), keys, true).disabledGroups, []);
  assert.deepEqual(onlyGroup(paused, keys[0], showcaseGroups(paused, [deck])).pausedGroups, []);
});

test('nested pauses retain child choices while explicit edits supersede enclosing pauses', () => {
  const keys = ['folder:42', 'folder:43', 'folder:44'];
  const c = { ...base, sources: [...base.sources, makeSource('44')] };
  const child = enableGroups(enableGroup(c, keys[1], false), keys.slice(0, 2), false);
  const parent = enableGroups(child, keys, false);
  const resumed = enableGroups(enableGroups(parent, keys, true), keys.slice(0, 2), true);
  assert.deepEqual(resumed.disabledGroups, [keys[1]]);
  const edited = enableGroup(parent, keys[0], true);
  assert.deepEqual(edited.pausedGroups, []);
  assert.doesNotThrow(() => parseCollection(JSON.stringify(removeSources(parent, [keys[0]]))));
  assert.throws(() => parseCollection(JSON.stringify({ ...base, pausedGroups: [{ keys: ['folder:42', 'unknown'], enabled: [] }] })));
});
