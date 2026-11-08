import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceRefresher } from '../src/sourceRefresh.ts';

const deck = JSON.parse(readFileSync(new URL('./fixtures/collection-decks.json', import.meta.url)))[0];
const entry = { id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors };
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Owned decks', url: 'https://archidekt.com/folders/42',
  checkedAt: '2026-01-01T00:00:00.000Z', entries: [entry], knownIds: [deck.id], membership: 'follow' };
const collection = { version: 1, hidden: [], excluded: [], added: [deck], sources: [source] };

function setup(read) {
  let state = collection;
  const checks = [];
  const refresher = sourceRefresher({
    collection: () => state,
    update: next => { state = next(state); },
    checking: key => checks.push(key),
    allowed: () => true,
    visible: () => true,
    read,
    pause: async () => {},
  });
  return { refresher, checks, state: () => state };
}
function held() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

test('invalidating a check in flight frees the queue for the next check', async () => {
  const first = held();
  const calls = [];
  const { refresher, checks } = setup(async (path, signal) => {
    calls.push(path);
    if (calls.length === 1) { await first.promise; signal.throwIfAborted(); }
    return { ...source, checkedAt: new Date().toISOString() };
  });
  const dropped = refresher.refresh(source.key);
  assert.equal(refresher.running, true);
  refresher.invalidate();
  assert.equal(refresher.running, false);
  first.release();
  await dropped;
  await refresher.refresh(source.key);
  assert.equal(calls.length, 2);
  assert.equal(refresher.running, false);
  assert.equal(checks.at(-1), '');
});

test('a dropped check never writes its result', async () => {
  const listing = held();
  const { refresher, state } = setup(async () => { await listing.promise; return { ...source, checkedAt: new Date().toISOString() }; });
  const dropped = refresher.refresh(source.key);
  refresher.invalidate();
  listing.release();
  await dropped;
  assert.equal(state(), collection);
});

test('a failed check records the failure and a retry time on its source', async () => {
  const { refresher, state } = setup(async () => { throw new Error('Archidekt is down.'); });
  await refresher.refresh(source.key);
  const failed = state().sources[0];
  assert.equal(failed.refresh.failures, 1);
  assert.match(failed.refresh.error, /Archidekt is down/);
  assert.ok(Date.parse(failed.refresh.retryAt) > Date.now());
  assert.equal(refresher.running, false);
});

test('revisit checks due sources and stops once invalidated', async () => {
  const second = { ...source, key: 'folder:43', value: '43', url: 'https://archidekt.com/folders/43' };
  const calls = [];
  // Both sources are due; invalidating during the first check ends the round.
  const both = sourceRefresher({ collection: () => ({ ...collection, sources: [source, second] }), update: () => {}, checking: () => {},
    allowed: () => true, visible: () => true, pause: async () => {}, read: async path => { calls.push(path); both.invalidate(); return source; } });
  await both.revisit();
  assert.equal(calls.length, 1);
});
