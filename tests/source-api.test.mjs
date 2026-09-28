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
  assert.equal((await request('/api/decks/987654321')).body.name,'Updated');
});
test('import failures explain private/missing sources and do not return a snapshot', async t => {
  t.mock.method(globalThis,'fetch',async()=>({ok:false,status:404}));
  const missing=await request('/api/decks/987654320');
  assert.equal(missing.status,502);
  assert.match(missing.body.error,/public/);
  assert.equal((await request('/api/decks/not-an-id')).status,404);
});
