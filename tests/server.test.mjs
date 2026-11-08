import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createRequestHandler } from '../server/request.mjs';

async function fixture(t, api) {
  const root = await mkdtemp(join(tmpdir(), 'deckshelf-server-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'index.html'), '<h1>DeckShelf</h1>');
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'app.js'), 'console.log("DeckShelf");');
  await writeFile(join(root, 'assets', 'app.css'), 'body { color: white; }');
  const server = createServer(createRequestHandler(root, api));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  // Raw HTTP paths keep encoded traversal intact instead of normalizing it in fetch.
  return (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('production handler refuses traversal and malformed paths', async t => {
  const get = await fixture(t);
  for (const path of ['/%2e%2e%2fsecret', '/%2e%2e%2fpublic-sibling/secret']) {
    assert.equal((await get(path)).status, 403);
  }
  assert.equal((await get('/%ZZ')).status, 400);
  assert.equal((await get('/settings', 'POST')).status, 405);
});

test('production handler falls back to the SPA for routes, but not missing assets or directories', async t => {
  const get = await fixture(t);
  for (const path of ['/', '/settings', '/help/faq?tab=1', '/u/A.b', '/f/1916319']) {
    const result = await get(path);
    assert.equal(result.status, 200);
    assert.equal(result.body, '<h1>DeckShelf</h1>');
    assert.equal(result.headers['content-type'], 'text/html');
    assert.equal(result.headers['cache-control'], 'no-cache');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers['x-frame-options'], 'DENY');
    assert.equal(result.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  }
  assert.equal((await get('/missing.js')).status, 404);
  assert.equal((await get('/assets')).status, 404);
  const head = await get('/help/faq', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(Number(head.headers['content-length']), Buffer.byteLength('<h1>DeckShelf</h1>'));
});

test('production handler streams assets with their content type and immutable cache policy', async t => {
  const get = await fixture(t);
  for (const [path, type, body] of [
    ['/assets/app.js', 'text/javascript', 'console.log("DeckShelf");'],
    ['/assets/app.css', 'text/css', 'body { color: white; }'],
  ]) {
    const result = await get(path);
    assert.equal(result.status, 200);
    assert.equal(result.body, body);
    assert.equal(result.headers['content-type'], type);
    assert.equal(Number(result.headers['content-length']), Buffer.byteLength(body));
    assert.equal(result.headers['cache-control'], 'public, max-age=31536000, immutable');
    const head = await get(path, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], result.headers['content-length']);
  }
});

test('production handler caps API work at eight and releases slots after success and failure', { timeout: 5000 }, async t => {
  const pending = [];
  let nextAccepted;
  let ready;
  const full = new Promise(resolve => { ready = resolve; });
  const get = await fixture(t, (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();
    return new Promise((resolve, reject) => {
      pending.push({ finish() { if (!res.writableEnded) res.end('ok'); resolve(); }, reject });
      nextAccepted?.();
      if (pending.length === 8) ready();
    });
  });
  t.after(() => { for (const item of pending) item.finish(); });
  const requests = Array.from({ length: 8 }, (_, i) => get(`/api/decks/${i}`));
  await full;
  const busy = await get('/api/sources', 'GET', { 'X-Forwarded-For': '192.0.2.1' });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers['retry-after'], '5');
  assert.equal(busy.headers['content-type'], 'application/json');
  assert.equal(busy.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(busy.body), { error: 'Source imports are busy. Please try again shortly.' });
  assert.equal(pending.length, 8);
  assert.equal((await get('/healthz')).status, 200);
  assert.equal((await get('/assets/app.js')).status, 200);
  const replacements = [];
  for (const [index, fail] of [[0, false], [1, true]]) {
    if (fail) pending[index].reject(new Error('upstream failed'));
    else pending[index].finish();
    const completed = await requests[index];
    assert.equal(completed.status, fail ? 500 : 200);
    if (fail) assert.deepEqual(JSON.parse(completed.body), { error: 'Could not complete the source request.' });
    const accepted = new Promise(resolve => { nextAccepted = resolve; });
    replacements.push(get('/api/decks/replacement'));
    await accepted;
    assert.equal((await get('/api/sources')).status, 503);
  }
  for (const item of pending.slice(2)) item.finish();
  await Promise.all(requests);
  for (const result of await Promise.all(replacements)) assert.equal(result.status, 200);
  assert.equal((await get('/healthz', 'HEAD')).body, '');
});
