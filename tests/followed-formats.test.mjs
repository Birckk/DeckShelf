import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../server/api.mjs';
import { parseCollection } from '../src/domain.ts';
import { refreshSourceMembership } from '../src/collection.ts';

test('cached refresh partitions format scopes and keeps non-Commander entries listed', async t => {
  const calls = [];
  const rows = [3, 2].map((deckFormat, index) => ({ id: 981001 + index, name: `Deck ${index}`, deckFormat, parentFolderId: 981000, colors: {} }));
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ id: 981000, name: 'Mixed', count: 2, decks: rows, next: null }) };
  });
  async function request(formats) {
    const result = { status: 200 };
    await handleApi({ url: `/api/sources?kind=folder&value=981000&prototype=1&formats=${formats}`, method: 'GET' }, {
      setHeader() {}, writeHead(status) { result.status = status; }, end(body) { result.body = JSON.parse(body); },
    });
    assert.equal(result.status, 200);
    return result.body;
  }
  const commander = await request('commander');
  const all = await request('all');
  assert.deepEqual(commander.knownIds, ['981001']);
  assert.deepEqual(all.knownIds, ['981001', '981002']);
  assert.equal(all.formatScope, 'all');
  assert.deepEqual(await request('all'), all);
  assert.equal(calls.length, 2);
  const collection = { version: 1, starter: false, added: [], hidden: [], excluded: [], sources: [{ ...all, membership: 'selected' }] };
  const updated = parseCollection(JSON.stringify(refreshSourceMembership(collection, all, [])));
  assert.equal(updated.sources[0].formatScope, 'all');
  assert.deepEqual(updated.sources[0].lastChange.unlisted, []);
});
