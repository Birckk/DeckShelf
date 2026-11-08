import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCollection } from '../src/domain.ts';
import { refreshSourceMembership, sourceMembership, sourceDue, sourceRefreshFailure, SOURCE_TTL, setSourceSelection, setPendingSourceSelection, showcaseGroups, removeSources, importFolderSelection } from '../src/collection.ts';
import { createSourceCache, discoverSource } from '../server/sources.mjs';

const decks = JSON.parse(readFileSync(new URL('./fixtures/collection-decks.json', import.meta.url))).slice(0, 4);
const entry = deck => ({ id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors });
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Direct decks', url: 'https://archidekt.com/folders/42',
  checkedAt: '2026-10-01T12:00:00Z', knownIds: decks.slice(0, 2).map(d => d.id), entries: decks.slice(0, 2).map(entry),
  folderPath: 'Home / Nested', connectionKey: 'account:example', connectionName: 'Example' };
const found = { ...source, checkedAt: '2026-10-16T12:00:00Z', name: 'Renamed folder', knownIds: decks.slice(1).map(d => d.id),
  entries: decks.slice(1).map(entry).map((e, i) => i === 0 ? { ...e, name: 'Renamed deck' } : e) };
const base = { version: 1, added: decks.slice(0, 2), hidden: [], excluded: [], sources: [source] };

test('refresh invariant: valid v1 snapshots and every existing choice survive all generated source modes and local states', () => {
  let cases = 0;
  for (const mode of [undefined, 'follow', 'selected']) for (let selection = 0; selection < 5; selection++) for (let flags = 0; flags < 32; flags++) {
    const selectedIds = selection === 4 ? undefined : decks.slice(0, 2).filter((_, i) => selection & 1 << i).map(d => d.id);
    const imported = { ...source, ...(mode ? { membership: mode } : {}), ...(selectedIds ? { selectedIds } : {}),
      ...(flags & 16 ? { ownedIds: source.knownIds } : {}) };
    const original = parseCollection(JSON.stringify({ ...base, added: decks.slice(0, 3),
      hidden: flags & 1 ? [decks[0].id, decks[2].id] : [], excluded: flags & 2 ? [decks[1].id] : [],
      disabledGroups: flags & 4 ? [source.key] : [], archivedGroups: flags & 8 ? [source.key] : [],
      ...(flags & 16 ? {} : { manualIds: [decks[0].id] }), sources: [imported, { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43', selectedIds: [decks[0].id] }] }));
    const independent = showcaseGroups(original, original.added).find(g => g.key === 'manual').ids;
    const copy = structuredClone(original);
    const result = parseCollection(JSON.stringify(refreshSourceMembership(original, found, decks.slice(2))));
    assert.deepEqual(original, copy, 'pure merge');
    assert.deepEqual(result.added.slice(0, original.added.length), original.added, 'last-good snapshots unchanged');
    for (const field of ['hidden', 'excluded', 'disabledGroups', 'archivedGroups']) assert.deepEqual(result[field], original[field]);
    for (const id of independent) {
      assert.ok(result.manualIds.includes(id), 'legacy Individual membership materialized');
      assert.ok(removeSources(result, [source.key]).added.some(d => d.id === id), 'source removal keeps independent snapshot');
    }
    assert.deepEqual(result.sources[1], original.sources[1], 'overlapping scope unchanged');
    const previousSelection = imported.selectedIds ?? imported.knownIds;
    assert.deepEqual(result.sources[0].selectedIds.filter(id => imported.knownIds.includes(id)), previousSelection);
    assert.equal(result.sources[0].folderPath, source.folderPath);
    assert.ok(result.sources[0].knownIds.includes(decks[0].id), 'unlisted history retained');
    if (sourceMembership(imported) === 'selected') assert.deepEqual(result.sources[0].selectedIds, previousSelection);
    else assert.ok(result.sources[0].selectedIds.includes(decks[2].id));
    cases++;
  }
  assert.equal(cases, 480);
});

test('older whole sources follow, hand-picked ones stay Selected; owned exclusions survive repeated refresh', () => {
  assert.equal(sourceMembership(source), 'follow');
  assert.equal(sourceMembership({ ...source, selectedIds: source.knownIds }), 'follow');
  assert.equal(sourceMembership({ ...source, membership: 'selected' }), 'selected');
  assert.equal(sourceMembership({ ...source, selectedIds: [decks[0].id] }), 'selected');
  const original = { ...base, sources: [{ ...source, membership: 'follow', selectedIds: [decks[1].id], ownedIds: source.knownIds }] };
  let next = refreshSourceMembership(original, found, decks.slice(2));
  assert.equal(next.sources[0].membership, 'follow');
  assert.ok(!next.sources[0].selectedIds.includes(decks[0].id));
  assert.deepEqual(next.sources[0].lastChange.unlisted, [decks[0].id]);
  assert.deepEqual(next.sources[0].lastChange.renamed, [decks[1].id]);
  next = setSourceSelection(next, [source.key], [decks[2].id], false, decks);
  next = refreshSourceMembership(next, found, decks.slice(2));
  assert.ok(!next.sources[0].selectedIds.includes(decks[2].id));
});

test('bounded pending snapshots retry without flipping deliberate exclusions, and fixed notices persist', () => {
  const following = { ...base, sources: [{ ...source, membership: 'follow' }] };
  let next = refreshSourceMembership(following, found, [decks[2]]);
  assert.deepEqual(next.sources[0].pendingIds, [decks[3].id]);
  next = refreshSourceMembership(next, found, [decks[3]]);
  assert.deepEqual(next.sources[0].pendingIds, []);
  assert.ok(next.sources[0].selectedIds.includes(decks[3].id));
  next = refreshSourceMembership({ ...base, sources: [{ ...source, membership: 'selected' }] }, found, []);
  next = refreshSourceMembership(next, found, []);
  assert.deepEqual(next.sources[0].pendingIds, decks.slice(2).map(d => d.id));
  assert.deepEqual(next.added, base.added);
  assert.deepEqual(refreshSourceMembership({ ...base, sources: [] }, found, decks), { ...base, sources: [] });
});

test('24h revisit TTL and capped exponential backoff never advance a failed check', () => {
  const checked = Date.parse(source.checkedAt);
  assert.equal(sourceDue(source, checked + SOURCE_TTL - 1), false);
  assert.equal(sourceDue(source, checked + SOURCE_TTL), true);
  let next = base;
  for (let i = 0; i < 25; i++) next = sourceRefreshFailure(next, source.key, 'Rate limited', checked + SOURCE_TTL);
  assert.deepEqual(next.added, base.added);
  assert.equal(next.sources[0].checkedAt, source.checkedAt);
  assert.equal(next.sources[0].refresh.failures, 20);
  assert.equal(Date.parse(next.sources[0].refresh.retryAt), checked + 2 * SOURCE_TTL);
  assert.equal(sourceDue(next.sources[0], checked + SOURCE_TTL), false);
  assert.deepEqual(parseCollection(JSON.stringify(next)), next);
});

test('optional source fields remain v1 compatible and invalid extension values are rejected', () => {
  const next = refreshSourceMembership(base, found, decks.slice(2));
  assert.equal(next.version, 1);
  const legacy = structuredClone(next);
  for (const s of legacy.sources) for (const field of ['membership', 'pendingIds', 'refresh', 'lastChange']) delete s[field];
  assert.deepEqual(parseCollection(JSON.stringify(legacy)).sources[0].selectedIds, next.sources[0].selectedIds);
  for (const invalid of [{ membership: 'all' }, { pendingIds: ['99999999'] }, { refresh: { failures: -1 } }, { lastChange: { at: 'today' } }])
    assert.throws(() => parseCollection(JSON.stringify({ ...base, sources: [{ ...source, ...invalid }] })));
});

test('shared discovery cache deduplicates visitors, limits manual checks, serializes scopes and backs off', async () => {
  let now = 100000000, calls = 0, active = 0, peak = 0, fail = false;
  const cache = createSourceCache(async () => {
    calls++; active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    if (fail) throw new Error('Rate limited');
    return { ...source, checkedAt: new Date(now).toISOString() };
  }, () => now);
  const both = await Promise.all([cache('folder', '42'), cache('folder', '42'), cache('folder', '43')]);
  assert.equal(calls, 2); assert.equal(peak, 1); assert.deepEqual(both[0], both[1]);
  await cache('folder', '42', true); assert.equal(calls, 2);
  now += 300000; await cache('folder', '42', true); assert.equal(calls, 3);
  now += SOURCE_TTL; fail = true;
  await assert.rejects(cache('folder', '42'), /Rate limited/);
  await assert.rejects(cache('folder', '42', true), /Rate limited/); assert.equal(calls, 4);
  now += 60000; fail = false; await cache('folder', '42'); assert.equal(calls, 5);
});

test('refresh discovery rejects truncated and inconsistent pages rather than flagging snapshots missing', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 42, name: 'Folder', count: 2, decks: [], next: null }) }));
  await assert.rejects(discoverSource('folder', '42', { verifyCount: true }), /incomplete/);
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ id: 42, name: 'Folder', count: 0, decks: [], next: null }) }));
  assert.deepEqual((await discoverSource('folder', '42', { verifyCount: true })).entries, []);
});

test('a rate limit cools down queued scopes and respects Retry-After', async () => {
  let now = 100000000, calls = 0;
  const cache = createSourceCache(async () => {
    calls++;
    throw Object.assign(new Error('Rate limited'), { retryAfter: 120000 });
  }, () => now);
  await Promise.all([assert.rejects(cache('folder', '42'), /Rate limited/), assert.rejects(cache('folder', '43'), /rate limited/)]);
  assert.equal(calls, 1);
  now += 60000;
  await assert.rejects(cache('folder', '42', true), /Rate limited/);
  assert.equal(calls, 1);
  now += 60000;
  await assert.rejects(cache('folder', '42', true), /Rate limited/);
  assert.equal(calls, 2);
});

test('capacity and history limits fail without mutating a valid last-good collection', () => {
  const full = parseCollection(JSON.stringify({ ...base, added: Array.from({ length: 1000 }, (_, index) => ({ ...decks[0], id: String(800000 + index) })) }));
  const original = structuredClone(full);
  assert.throws(() => refreshSourceMembership(full, found, decks.slice(2)), /1,000/);
  assert.deepEqual(full, original);
  const history = { ...base, sources: [{ ...source, knownIds: Array.from({ length: 2000 }, (_, index) => String(800000 + index)), entries: [], selectedIds: [] }] };
  parseCollection(JSON.stringify(history));
  const before = structuredClone(history);
  assert.throws(() => refreshSourceMembership(history, found, []), /history is full/);
  assert.deepEqual(history, before);
});

test('unresolved snapshots survive temporary unlisting and partial imports without reviving exclusions', () => {
  const follow = { ...source, membership: 'follow' };
  let c = refreshSourceMembership({ ...base, sources: [follow] }, found, [decks[2]]);
  assert.deepEqual(c.sources[0].pendingIds, [decks[3].id]);
  c = refreshSourceMembership(c, { ...found, entries: [], knownIds: [] }, []);
  assert.deepEqual(c.sources[0].pendingIds, [decks[3].id]);
  c = refreshSourceMembership(c, found, [decks[3]]);
  assert.ok(c.sources[0].selectedIds.includes(decks[3].id));
  c = setSourceSelection(c, [source.key], [decks[3].id], false, decks);
  c = refreshSourceMembership(c, { ...found, entries: [], knownIds: [] }, []);
  c = refreshSourceMembership(c, found, []);
  assert.ok(!c.sources[0].selectedIds.includes(decks[3].id));
  assert.ok(c.sources[0].excludedIds.includes(decks[3].id));
  const attempted = source.knownIds;
  const partial = importFolderSelection({ ...base, sources: [], added: [] }, [follow], [decks[0]], [], [], attempted);
  assert.deepEqual(partial.sources[0].pendingIds, [decks[1].id]);
  const retried = refreshSourceMembership(partial, source, [decks[1]]);
  assert.ok(retried.sources[0].selectedIds.includes(decks[1].id));
  const failed = importFolderSelection({ ...base, sources: [], added: [] }, [follow], [], [], [], attempted);
  assert.deepEqual(failed.sources[0].pendingIds, attempted);
  parseCollection(JSON.stringify(retried));
  parseCollection(JSON.stringify(failed));
});

test('format scope separates discovery cache entries and reaches the discovery adapter', async () => {
  const scopes = [];
  const cache = createSourceCache(async (_kind, _value, options) => { scopes.push(options.formatScope); return source; });
  await cache('folder', '42', false, 'commander');
  await cache('folder', '42', false, 'all');
  await cache('folder', '42', false, 'commander');
  assert.deepEqual(scopes, ['commander', 'all']);
});

test('unsaved Follow exclusions persist independently from snapshots, staged selection and other scopes', () => {
  const pending = decks[1].id;
  const following = { ...source, membership: 'follow', selectedIds: [decks[0].id], ownedIds: [decks[0].id], pendingIds: [pending] };
  const other = { ...following, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43' };
  const fixed = { ...following, key: 'folder:44', value: '44', url: 'https://archidekt.com/folders/44', membership: 'selected' };
  const original = parseCollection(JSON.stringify({ ...base, added: [decks[0]], sources: [following, other, fixed] }));
  const copy = structuredClone(original);
  const excluded = parseCollection(JSON.stringify(setPendingSourceSelection(original, [following.key, fixed.key], [pending], false)));
  assert.deepEqual(original, copy);
  assert.deepEqual(excluded.sources[0].excludedIds, [pending]);
  assert.deepEqual(excluded.sources[0].pendingIds, []);
  assert.deepEqual(excluded.sources.slice(1), original.sources.slice(1));
  for (const field of ['selectedIds', 'ownedIds']) assert.deepEqual(excluded.sources[0][field], following[field]);
  assert.deepEqual(excluded.added, original.added);
  assert.deepEqual(excluded.hidden, original.hidden);
  const refreshed = refreshSourceMembership(excluded, source, []);
  assert.deepEqual(refreshed.sources[0].selectedIds, following.selectedIds);
  assert.deepEqual(refreshed.added, original.added);
  const selected = setPendingSourceSelection(refreshed, [following.key], [pending], true);
  assert.deepEqual(selected.sources[0].excludedIds, []);
  assert.deepEqual(selected.sources[0].pendingIds, [pending]);
  assert.deepEqual(selected.sources[0].selectedIds, following.selectedIds);
  assert.deepEqual(selected.sources[0].ownedIds, following.ownedIds);
  const imported = parseCollection(JSON.stringify(refreshSourceMembership(selected, source, [decks[1]])));
  assert.ok(imported.sources[0].selectedIds.includes(pending));
});

test('adding a folder again keeps its earlier choice about new decks', () => {
  const kept = { ...base, sources: [{ ...source, membership: 'selected', selectedIds: source.knownIds }] };
  const next = importFolderSelection(kept, [{ ...source, membership: 'follow' }], decks.slice(0, 2), decks.slice(0, 2));
  assert.equal(next.sources[0].membership, 'selected');
  const fresh = importFolderSelection({ ...base, sources: [] }, [{ ...source, membership: 'follow' }], decks.slice(0, 2), decks.slice(0, 2));
  assert.equal(fresh.sources[0].membership, 'follow');
});
