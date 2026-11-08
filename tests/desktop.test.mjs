import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desktopResponse, isAppUrl, isExternalUrl } from '../desktop/request.mjs';
import { migrateLegacyProfile, profilePaths } from '../desktop/profile.mjs';

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
    const settings = await desktopResponse(new Request('archive://app/settings'), root);
    assert.equal(await settings.text(), '<h1>Archive</h1>');
    const route = await desktopResponse(new Request('archive://app/help/faq'), root);
    assert.equal(await route.text(), '<h1>Archive</h1>');
    assert.match(route.headers.get('Content-Type'), /text\/html/);
    for (const path of ['/u/A.b', '/f/1916319']) {
      const shared = await desktopResponse(new Request('archive://app' + path), root);
      assert.equal(await shared.text(), '<h1>Archive</h1>');
    }
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

test('desktop copies a Commander Archive profile into a new DeckShelf profile once', async () => {
  const appData = await mkdtemp(join(tmpdir(), 'deckshelf-profile-'));
  try {
    const { legacy, profile } = profilePaths(appData);
    assert.equal(profile, join(appData, 'DeckShelf'));
    assert.equal(legacy, join(appData, 'Commander Archive'));
    assert.equal(migrateLegacyProfile(legacy, profile), 'no legacy profile');
    await mkdir(join(legacy, 'Local Storage', 'leveldb'), { recursive: true });
    await writeFile(join(legacy, 'Local Storage', 'leveldb', '000003.log'), 'collection');
    await writeFile(join(legacy, 'Local Storage', 'leveldb', 'LOCK'), '');
    await mkdir(join(legacy, 'Cache'));
    await writeFile(join(legacy, 'startup.log'), 'old');
    // Electron may create crash data in the default profile before the main script runs.
    await mkdir(join(profile, 'Crashpad'), { recursive: true });
    assert.equal(migrateLegacyProfile(legacy, profile), 'copied Commander Archive profile');
    assert.equal(await readFile(join(profile, 'Local Storage', 'leveldb', '000003.log'), 'utf8'), 'collection');
    assert.deepEqual((await readdir(profile)).sort(), ['Crashpad', 'Local Storage']);
    assert.deepEqual(await readdir(join(profile, 'Local Storage', 'leveldb')), ['000003.log']);
    assert.equal(await readFile(join(legacy, 'startup.log'), 'utf8'), 'old');
    assert.deepEqual((await readdir(appData)).sort(), ['Commander Archive', 'DeckShelf']);
    await writeFile(join(profile, 'Local Storage', 'leveldb', '000003.log'), 'newer');
    assert.equal(migrateLegacyProfile(legacy, profile), 'kept existing profile');
    assert.equal(await readFile(join(profile, 'Local Storage', 'leveldb', '000003.log'), 'utf8'), 'newer');
  } finally { await rm(appData, { recursive: true, force: true }); }
});

test('desktop bundle includes all local server module dependencies', async () => {
  const config = await readFile(new URL('../desktop/electron-builder.yml', import.meta.url), 'utf8');
  const bundled = new Set([...config.matchAll(/^  - ((?:server|shared)\/.+\.mjs)$/gm)].map(match => match[1]));
  const queue = ['server/api.mjs', 'server/static.mjs'];
  const visited = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    assert.ok(bundled.has(name), `Missing desktop module: ${name}`);
    const url = new URL(`../${name}`, import.meta.url);
    const source = await readFile(url, 'utf8');
    for (const [, relative] of source.matchAll(/from ['"]([.][^'"]+\.mjs)['"]/g)) {
      const dependency = new URL(relative, url).pathname.slice(new URL('../', import.meta.url).pathname.length);
      queue.push(dependency);
    }
  }
});

test('desktop snapshots and discovery share the same Retry-After cooldown', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '3600' }) };
  });
  const limited = await desktopResponse(new Request('archive://app/api/decks/987654300'), '.');
  assert.equal(limited.status, 424);
  const second = await desktopResponse(new Request('archive://app/api/decks/987654301'), '.');
  assert.equal(second.status, 424);
  assert.match((await second.json()).error, /rate limited/);
  const source = await desktopResponse(new Request('archive://app/api/sources?kind=folder&value=987654302&cached=1'), '.');
  assert.equal(source.status, 424);
  assert.equal(calls, 1);
});
