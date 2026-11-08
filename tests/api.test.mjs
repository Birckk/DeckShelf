import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, ApiError, NO_SERVER, UNREACHABLE } from '../src/api.ts';

const reply = (status, body, type = 'application/json') => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });
const fails = async request => {
  try { await apiJson('/api/x', { fallback: 'Fallback.', request }); }
  catch (error) { return error; }
  assert.fail('expected a failure');
};

test('a JSON answer is returned as data', async () => {
  assert.deepEqual(await apiJson('/api/x', { fallback: 'Fallback.', request: reply(200, { id: '1' }) }), { id: '1' });
});

test('a static host never shows a parse error: its index page means there is no server', async () => {
  const error = await fails(reply(200, '<!doctype html><title>DeckShelf</title>', 'text/html'));
  assert.ok(error instanceof ApiError);
  assert.equal(error.message, NO_SERVER);
});

test('a proxy error page or unreadable body uses the fallback message', async () => {
  assert.equal((await fails(reply(502, 'error code: 502', 'text/plain'))).message, 'Fallback.');
  assert.equal((await fails(reply(502, '{broken', 'application/json'))).message, 'Fallback.');
});

test('server errors keep their message, status and retry hint', async () => {
  const gone = await fails(reply(404, { error: 'Use a public deck from Archidekt.', retry: false }));
  assert.deepEqual([gone.message, gone.status, gone.retry], ['Use a public deck from Archidekt.', 404, false]);
  const busy = await fails(reply(503, { error: 'Busy.' }));
  assert.equal(busy.retry, true);
  assert.equal((await fails(reply(500, {}))).message, 'Fallback.');
});

test('network failures say Archidekt could not be reached; a caller abort is passed through', async () => {
  assert.equal((await fails(async () => { throw new TypeError('Failed to fetch'); })).message, UNREACHABLE);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(apiJson('/api/x', { fallback: 'Fallback.', signal: controller.signal, request: (_path, init) => { init.signal.throwIfAborted(); } }),
    error => error.name === 'AbortError');
});
