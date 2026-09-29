import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desktopResponse, isAppUrl, isExternalUrl } from '../desktop/request.mjs';

test('desktop serves only packaged assets and rejects foreign origins and file escape', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archive-protocol-'));
  try {
    await writeFile(join(root, 'index.html'), '<h1>Archive</h1>');
    const result = await desktopResponse(new Request('archive://app/'), root);
    assert.equal(await result.text(), '<h1>Archive</h1>');
    assert.match(result.headers.get('Content-Security-Policy'), /script-src 'self'/);
    assert.equal((await desktopResponse(new Request('archive://other/'), root)).status, 404);
    assert.equal((await desktopResponse(new Request('archive://app/', { method: 'POST' }), root)).status, 405);
    assert.equal((await desktopResponse(new Request('archive://app/%2e%2e%2fsecret'), root)).status, 403);
    assert.equal((await desktopResponse(new Request('archive://app/%5csecret'), root)).status, 400);
    assert.equal((await desktopResponse(new Request('archive://app/missing.js'), root)).status, 404);
    assert.equal(await (await desktopResponse(new Request('archive://app/', { method: 'HEAD' }), root)).text(), '');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('desktop read-only API keeps paths, query strings, status and headers', async () => {
  const result = await desktopResponse(new Request('archive://app/api/decks/123?refresh=1'), '.', async (req, res) => {
    assert.equal(req.url, '/api/decks/123?refresh=1');
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(502); res.end(JSON.stringify({ error: 'offline' }));
  });
  assert.equal(result.status, 502);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { error: 'offline' });
});

test('desktop navigation keeps OS commands and foreign pages out of the app', () => {
  assert.ok(isAppUrl('archive://app/'));
  for (const url of ['archive://app.evil/', 'archive://user@app/', 'file:///secret', 'javascript:alert(1)']) assert.equal(isAppUrl(url), false);
  assert.ok(isExternalUrl('https://archidekt.com/decks/123'));
  for (const url of ['file:///secret', 'http://localhost/', 'ms-settings:', 'https://user:password@example.com']) assert.equal(isExternalUrl(url), false);
});
