import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../server/api.mjs';
import { createSourceCache, discoverFolders } from '../server/sources.mjs';
import { createImportSlots } from '../server/import-slots.mjs';

const source = name => ({ id:987654321, name, deckFormat:3, deckTags:[], cards:[{
  quantity:1, categories:['Commander'], card:{ uid:'687a2b76-3f05-4732-bd9b-513d06d16300', artist:'Artist', edition:{editionname:'Test'}, oracleCard:{name:'Test Commander',colorIdentity:['Blue']} }
}] });
async function request(path) {
  const result={status:200};
  await handleApi({url:path,method:'GET'}, { setHeader(){}, writeHead(code){result.status=code;}, end(body){result.body=JSON.parse(body);} });
  return result;
}
test('refresh bypasses the cache and upstream failure preserves the last good snapshot', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async () => {
    calls++;
    return {ok:true,json:async()=>source(calls===1?'Original':'Updated')};
  });
  assert.equal((await request('/api/decks/987654321')).body.name,'Original');
  assert.equal((await request('/api/decks/987654321')).body.name,'Original');
  assert.equal(calls,1);
  assert.equal((await request('/api/decks/987654321?refresh=1')).body.name,'Updated');
  assert.equal(calls,2);
  globalThis.fetch.mock.mockImplementation(async()=>({ok:false,status:503}));
  const failed=await request('/api/decks/987654321?refresh=1');
  assert.equal(failed.status,424);
  assert.match(failed.body.error,/unavailable/);
  assert.equal(failed.body.retry,true);
  assert.equal((await request('/api/decks/987654321')).body.name,'Updated');
});
test('import failures explain private/missing sources and do not return a snapshot', async t => {
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:404}));
  const missing=await request('/api/decks/987654320');
  assert.equal(missing.status,424);
  assert.match(missing.body.error,/public/);
  assert.equal(missing.body.retry,false);
  assert.equal((await request('/api/decks/not-an-id')).status,404);
});

test('concurrent automatic snapshot requests share in-flight work and failed imports back off', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await Promise.resolve();
    return { ok: true, json: async () => ({ ...source('Shared snapshot'), id: 987654319 }) };
  });
  const results = await Promise.all([request('/api/decks/987654319'), request('/api/decks/987654319')]);
  assert.equal(calls, 1);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].status, 200);
  globalThis.fetch.mock.mockImplementation(async () => { calls++; return { ok: false, status: 429 }; });
  const limited = await request('/api/decks/987654318');
  assert.equal(limited.status, 424);
  assert.equal(limited.body.retry, true);
  // The remembered failure still says to try again later, so shelves don't drop the deck for good.
  const remembered = await request('/api/decks/987654318');
  assert.equal(remembered.status, 424);
  assert.equal(remembered.body.retry, true);
  assert.equal(calls, 2);
});

test('snapshot Retry-After cools down other snapshots, discovery and queued visitors', async t => {
  const { upstreamCooldown } = await import('../server/archidekt.mjs');
  let now = Math.max(Date.now(), upstreamCooldown.retryAt) + 1000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '3600' }) };
  });
  assert.equal((await request('/api/decks/987654310')).status, 424);
  assert.equal(upstreamCooldown.retryAt, now + 3600000);
  assert.equal((await request('/api/decks/987654311?refresh=1')).status, 424);
  assert.equal((await request('/api/sources?kind=folder&value=987654310&prototype=1')).status, 424);
  assert.equal((await request('/api/source-folders?kind=folder&value=987654310')).status, 424);
  assert.equal(calls, 1);
  now += 3599999;
  assert.equal((await request('/api/decks/987654312')).status, 424);
  assert.equal(calls, 1);
  now++;
  globalThis.fetch.mock.mockImplementation(async () => { calls++; return { ok: true, json: async () => ({ ...source('After cooldown'), id: 987654313 }) }; });
  assert.equal((await request('/api/decks/987654313')).status, 200);
  assert.equal(calls, 2);
});

test('Retry-After HTTP dates and long server cooldowns are not shortened', async () => {
  const { createUpstreamCooldown } = await import('../server/archidekt.mjs');
  let now = Date.parse('2026-10-16T12:00:00Z');
  const cooldown = createUpstreamCooldown(() => now);
  cooldown.observe({ status: 429, headers: new Headers({ 'Retry-After': new Date(now + 3600000).toUTCString() }) });
  assert.equal(cooldown.retryAt, now + 3600000);
  cooldown.observe({ status: 429, headers: new Headers({ 'Retry-After': '172800' }) });
  assert.equal(cooldown.retryAt, now + 172800000);
  now += 3600000;
  assert.throws(() => cooldown.check(), /rate limited/);
});

test('folder preview API shares in-flight work and separates kind and format scope', async t => {
  const { upstreamCooldown } = await import('../server/archidekt.mjs');
  t.mock.method(Date, 'now', () => upstreamCooldown.retryAt + 1000);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    if (url.includes('/u/')) return { ok: true, text: async () => '<script id="__NEXT_DATA__">{"props":{"pageProps":{"user":{"username":"765432100","rootFolderId":765432100}}}}</script>' };
    return { ok: true, json: async () => ({ id: 765432100, name: 'Preview', count: 0, decks: [], subfolders: [], owner: { username: '765432100' } }) };
  });
  const path = '/api/source-folders?kind=folder&value=765432100';
  const results = await Promise.all([request(path), request(path)]);
  assert.equal(results[0].status, 200);
  assert.deepEqual(results[0], results[1]);
  assert.equal(calls, 1);
  assert.deepEqual(await request(path), results[0]);
  assert.equal(calls, 1);
  assert.equal((await request(`${path}&formats=all`)).status, 200);
  assert.equal(calls, 2);
  assert.equal((await request('/api/source-folders?kind=account&value=765432100')).status, 200);
  assert.equal(calls, 4);
});

test('short-lived folder cache expires, shares failures and stays bounded', async () => {
  let now = 100000000, calls = 0, fail = false;
  const cache = createSourceCache(async (kind, value, options) => {
    calls++;
    if (fail) throw new Error('Offline');
    // Exercise the real folder adapter without upstream requests.
    return discoverFolders(kind, value, { ...options, request: async () => ({ ok: true, json: async () => ({ id: Number(value), name: 'Preview', count: 0, decks: [], subfolders: [] }) }) });
  }, () => now, undefined, { ttl: 60000, manualTtl: 60000 });
  await cache('folder', '1');
  now += 59999;
  await cache('folder', '1', true);
  assert.equal(calls, 1);
  now++;
  await cache('folder', '1');
  assert.equal(calls, 2);
  fail = true;
  await assert.rejects(cache('folder', '2'), /Offline/);
  await assert.rejects(cache('folder', '2'), /Offline/);
  assert.equal(calls, 3);
  fail = false;
  for (let id = 3; id <= 201; id++) await cache('folder', String(id));
  const before = calls;
  await cache('folder', '1');
  assert.equal(calls, before + 1);
});

test('invalid source requests cannot poison or evict cached sources', async () => {
  let calls = 0;
  const cache = createSourceCache(async () => { calls++; return { entries: [] }; });
  for (let id = 1; id <= 200; id++) await cache('folder', String(id));
  for (let id = 0; id < 210; id++) {
    await assert.rejects(cache('invalid', String(id)), /username or folder/);
    await assert.rejects(cache('folder', `bad:${id}`), /username or folder/);
  }
  await assert.rejects(cache('folder', '1', false, 'invalid'), /formats/);
  await assert.rejects(cache('account', { toString: () => 'Alice' }), /username or folder/);
  for (let id = 1; id <= 200; id++) await cache('folder', String(id));
  assert.equal(calls, 200);
  await cache('account', 'Alice');
  await cache('account', 'ALICE');
  assert.equal(calls, 201);
});

test('web deck cache keeps a 300+ deck shelf warm and evicts at its bound', async () => {
  const { fetchDeck } = await import('../server/api.mjs');
  let calls = 0;
  const store = new Map();
  const read = id => fetchDeck(String(id), { store, request: async () => {
    calls++;
    return { ok: true, json: async () => ({ ...source('Large shelf'), id }) };
  } });
  for (let id = 1; id <= 350; id++) await read(id);
  for (let id = 1; id <= 350; id++) await read(id);
  assert.equal(calls, 350);
  for (let id = 351; id <= 1001; id++) await read(id);
  assert.equal(store.size, 1000);
  assert.equal(store.has('1'), false);
  assert.equal(store.has('2'), true);
  await read(1);
  assert.equal(calls, 1002);
  assert.equal(store.size, 1000);
});

test('source listings hold at most half the import slots, so deck loads keep working', () => {
  const acquire = createImportSlots();
  const at = url => ({ url });
  const listings = Array.from({ length: 4 }, (_, i) => acquire(at(i % 2 ? '/api/source-folders?kind=folder&value=1' : '/api/sources?kind=folder&value=1')));
  assert.ok(listings.every(release => typeof release === 'function'));
  assert.equal(acquire(at('/api/sources?kind=folder&value=2')), undefined);
  const decks = Array.from({ length: 4 }, (_, i) => acquire(at(`/api/decks/${i}`)));
  assert.ok(decks.every(release => typeof release === 'function'));
  assert.equal(acquire(at('/api/decks/9')), undefined, 'eight in total');
  listings[0]();
  listings[0]();
  assert.equal(typeof acquire(at('/api/sources?kind=folder&value=2')), 'function', 'a freed slot is reusable, and releasing twice is harmless');
  assert.equal(acquire(at('/api/decks/9')), undefined);
});
