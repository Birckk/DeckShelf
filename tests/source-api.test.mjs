import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../server/api.mjs';

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
  assert.equal(failed.status,502);
  assert.match(failed.body.error,/unavailable/);
  assert.equal(failed.body.retry,true);
  assert.equal((await request('/api/decks/987654321')).body.name,'Updated');
});
test('import failures explain private/missing sources and do not return a snapshot', async t => {
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:404}));
  const missing=await request('/api/decks/987654320');
  assert.equal(missing.status,502);
  assert.match(missing.body.error,/public/);
  assert.equal(missing.body.retry,false);
  assert.equal((await request('/api/decks/not-an-id')).status,404);
});

test('concurrent automatic snapshot requests share in-flight work and failed imports back off', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
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
  assert.equal(limited.status, 502);
  assert.equal(limited.body.retry, true);
  // The remembered failure still says to try again later, so shelves don't drop the deck for good.
  const remembered = await request('/api/decks/987654318');
  assert.equal(remembered.status, 502);
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
  assert.equal((await request('/api/decks/987654310')).status, 502);
  assert.equal(upstreamCooldown.retryAt, now + 3600000);
  assert.equal((await request('/api/decks/987654311?refresh=1')).status, 502);
  assert.equal((await request('/api/sources?kind=folder&value=987654310&prototype=1')).status, 502);
  assert.equal((await request('/api/source-folders?kind=folder&value=987654310')).status, 502);
  assert.equal(calls, 1);
  now += 3599999;
  assert.equal((await request('/api/decks/987654312')).status, 502);
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
