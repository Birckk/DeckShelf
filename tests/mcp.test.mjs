import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server/mcp.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
const decks = fixture('collection-decks.json');
const { folders } = fixture('collection-folders.json');
const precons = JSON.parse(readFileSync(new URL('../src/data/precons.json', import.meta.url), 'utf8'));
const owner = { username: 'Birckk' };
const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
const NO_COMMANDER = '27099999';

// Rebuild the Archidekt responses behind the recorded DeckShelf decks and folders.
function rawDeck(deck) {
  const card = (c, uid) => ({ uid, artist: c.artist, releasedAt: deck.releasedAt, edition: { editionname: deck.set },
    oracleCard: { name: c.name, colorIdentity: deck.colors.map(k => colorNames[k]) } });
  return {
    id: Number(deck.id), name: deck.name, deckFormat: 3, private: false, featured: '', deckTags: [],
    description: deck.id === '27088578' ? 'Angels, led by [[Giada, Font of Hope]].' : '',
    cards: [
      ...deck.commanders.map(c => ({ quantity: 1, categories: ['Commander'], card: card(c, /([0-9a-f-]{36})\.webp$/.exec(c.image)[1]) })),
      { quantity: deck.cardCount - deck.commanders.length, categories: ['Land'], card: card(deck.commanders[0], deck.commanders[0].image.slice(-41, -5)) },
      { quantity: 4, categories: ['Maybeboard'], card: card(deck.commanders[0], deck.commanders[0].image.slice(-41, -5)) },
    ],
  };
}
const row = deck => ({ id: Number(deck.id), name: deck.name, deckFormat: 3, private: false, owner,
  colors: Object.fromEntries(deck.colors.map(c => [c, 1])) });
const tree = {
  1916319: [1916320, 1916321],
  1916320: [],
  1916321: [],
};
function folderResponse(id) {
  const { source } = folders.find(f => f.source.value === id);
  return { id: Number(id), name: source.name, owner, private: false, count: source.entries.length, next: null,
    subfolders: tree[id].map(child => ({ id: child, private: false })),
    decks: source.entries.map(e => ({ ...row(decks.find(d => d.id === e.id)), parentFolderId: Number(id) })) };
}

function stubArchidekt(t, respond = () => {}) {
  const calls = [];
  const json = data => ({ ok: true, status: 200, json: async () => data });
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(String(input));
    calls.push(url.href);
    const response = await respond(url, options);
    if (response) return response;
    if (url.origin !== 'https://archidekt.com') return { ok: false, status: 404 };
    if (url.pathname.startsWith('/u/'))
      return ['Birckk', 'EmptyAccount'].includes(decodeURIComponent(url.pathname.slice(3))) ? { ok: true, status: 200 } : { ok: false, status: 404 };
    if (url.pathname === '/api/decks/v3/') {
      const mine = url.searchParams.get('ownerUsername') === 'Birckk';
      const rows = mine ? [...decks.map(row), { ...row(decks[0]), id: Number(NO_COMMANDER), name: 'Unfinished brew' }] : [];
      return json({ count: rows.length, next: null, results: rows });
    }
    let match = /^\/api\/decks\/folders\/(\d+)\/$/.exec(url.pathname);
    if (match) return tree[match[1]] ? json(folderResponse(match[1])) : { ok: false, status: 404 };
    match = /^\/api\/decks\/(\d+)\/$/.exec(url.pathname);
    if (match?.[1] === NO_COMMANDER) return json({ ...rawDeck(decks[0]), id: Number(NO_COMMANDER), cards: [] });
    const deck = match && decks.find(d => d.id === match[1]);
    return deck ? json(rawDeck(deck)) : { ok: false, status: 404 };
  });
  return calls;
}

async function connectClient(t) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'deckshelf-test', version: '1.0.0' });
  await Promise.all([createServer().connect(serverSide), client.connect(clientSide)]);
  t.after(() => client.close());
  return client;
}

async function connect(t) {
  const client = await connectClient(t);
  return async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    return result.isError ? { error: result.content[0].text } : result.structuredContent;
  };
}

test('lists three read-only tools with described inputs', async t => {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'deckshelf-test', version: '1.0.0' });
  await Promise.all([createServer().connect(serverSide), client.connect(clientSide)]);
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['find_collection', 'pick_deck', 'deck_details']);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.ok(tool.description.length > 40);
    assert.ok(tool.outputSchema);
    for (const property of Object.values(tool.inputSchema.properties)) assert.ok(property.description);
  }
  assert.deepEqual(tools[1].inputSchema.properties.count, { type: 'integer', minimum: 1, maximum: 4,
    description: 'How many different decks to pick (1–4, default 1).' });
});

test('find_collection reads a username, a folder tree and the bundled precons', async t => {
  const calls = stubArchidekt(t);
  const call = await connect(t);
  const account = await call('find_collection', { source: 'Birckk' });
  assert.deepEqual(account.source, { name: 'Birckk', url: 'https://archidekt.com/u/Birckk' });
  assert.equal(account.count, 30);
  assert.deepEqual(account.decks[0], { id: '27088578', name: 'TEST - Calling All Angels - Copy B', commander: 'Giada, Font of Hope', colors: ['W'] });
  assert.deepEqual(account.unavailable.map(d => d.id), [NO_COMMANDER]);
  assert.match(account.unavailable[0].reason, /no assigned commander/);

  const folder = await call('find_collection', { source: 'https://archidekt.com/folders/1916319' });
  assert.equal(folder.source.name, 'DeckShelf Test Collection');
  assert.equal(folder.count, 1, 'only direct decks by default');
  assert.match(folder.note, /2 subfolders that were not included; set includeSubfolders/);
  assert.deepEqual(folder.decks.map(d => d.id), folders[0].source.entries.map(e => e.id));
  assert.ok(!calls.some(url => /folders\/191632[01]/.test(url)), 'does not discover descendants by default');
  const expanded = await call('find_collection', { source: 'https://archidekt.com/folders/1916319', includeSubfolders: true });
  assert.equal(expanded.count, 30, 'descendants require an explicit option');
  assert.equal(expanded.note, undefined);
  assert.deepEqual(new Set(expanded.decks.map(d => d.id)), new Set(decks.map(d => d.id)));

  const before = calls.length;
  const bundled = await call('find_collection', { source: ' Precons ' });
  assert.equal(bundled.source.name, 'Official Commander precons');
  assert.equal(bundled.count, precons.decks.length);
  assert.equal(calls.length, before, 'precons need no network');
  assert.ok(calls.every(url => url.startsWith('https://archidekt.com/')));
});

test('explains a misspelled username, an empty account and links without https://', async t => {
  const calls = stubArchidekt(t);
  const call = await connect(t);
  assert.match((await call('find_collection', { source: 'Birckkk' })).error, /no user named "Birckkk"\. Check the spelling/);
  assert.match((await call('pick_deck', { source: 'Birckkk' })).error, /no user named/);
  const empty = await call('find_collection', { source: 'EmptyAccount' });
  assert.equal(empty.count, 0);
  assert.match(empty.note, /Private decks/);
  assert.equal((await call('find_collection', { source: 'Birckk' })).note, undefined);
  assert.ok(!calls.some(url => url.endsWith('/u/Birckk')), 'a non-empty account needs no profile check');
  assert.equal((await call('find_collection', { source: 'archidekt.com/folders/1916319' })).source.name, 'DeckShelf Test Collection');
  assert.equal((await call('deck_details', { deck: 'www.archidekt.com/decks/27088578' })).id, '27088578');
  assert.ok((await call('find_collection', { source: 'archidekt.com.evil.example/u/Birckk' })).error);
});

test('rejects bad usernames, foreign links and out-of-range options before fetching', async t => {
  const calls = stubArchidekt(t);
  const call = await connect(t);
  for (const source of ['bad/name', 'x'.repeat(101), 'https://evil.example/u/Birckk', 'http://archidekt.com/u/Birckk',
    'https://user:pass@archidekt.com/u/Birckk', 'https://archidekt.com/search/decks', 'https://']) {
    const { error } = await call('find_collection', { source });
    assert.ok(error, source);
  }
  assert.match((await call('find_collection', { source: 'https://evil.example/u/Birckk' })).error, /archidekt\.com/);
  for (const args of [{ count: 0 }, { count: 5 }, { count: 1.5 }, { colors: ['X'] }, { colors: ['W', 'W'] }, { query: 'q'.repeat(201) }])
    assert.ok((await call('pick_deck', { source: 'Birckk', ...args })).error, JSON.stringify(args));
  assert.match((await call('pick_deck', { source: 'Birckk', colors: ['B'], colorless: true })).error, /not both/);
  assert.match((await call('deck_details', { deck: 'https://archidekt.com/folders/1916319' })).error, /deck link/);
  assert.ok((await call('deck_details', { deck: 'https://evil.example/decks/27088578' })).error);
  assert.deepEqual(calls, []);
  assert.match((await call('find_collection', { source: 'https://archidekt.com/folders/42' })).error, /not public/);
});

test('pick_deck applies colour, exact and text filters and only picks eligible decks', async t => {
  stubArchidekt(t);
  const call = await connect(t);
  const ids = filter => new Set(decks.filter(filter).map(d => d.id));
  const cases = [
    [{ colors: ['B', 'G'] }, ids(d => d.colors.includes('B') && d.colors.includes('G'))],
    [{ colors: ['B', 'G'], exact: true }, ids(d => d.colors.join('') === 'BG')],
    [{ query: 'giada' }, ids(d => d.commanders.some(c => c.name.includes('Giada')))],
    [{ query: 'Foundations', colors: ['R'] }, ids(d => d.set === 'Foundations Commander' && d.colors.includes('R'))],
  ];
  for (const [filters, expected] of cases) {
    assert.ok(expected.size > 0);
    const seen = new Set();
    for (let run = 0; run < 60; run++) {
      const result = await call('pick_deck', { source: 'Birckk', ...filters });
      assert.equal(result.eligible, expected.size, JSON.stringify(filters));
      assert.equal(result.total, 30);
      assert.equal(result.picks.length, 1);
      assert.ok(expected.has(result.picks[0].id), JSON.stringify(filters));
      assert.equal(result.picks[0].url, `https://archidekt.com/decks/${result.picks[0].id}`);
      seen.add(result.picks[0].id);
    }
    assert.deepEqual(seen, expected, `every eligible deck can be picked: ${JSON.stringify(filters)}`);
  }
  const none = await call('pick_deck', { source: 'Birckk', colors: ['W', 'U', 'B', 'R'], exact: true, query: 'dragon' });
  assert.match(none.error, /No loaded decks match.*Birckk/);
});

test('pick_deck returns distinct decks up to the count and never an unavailable deck', async t => {
  stubArchidekt(t);
  const call = await connect(t);
  for (let run = 0; run < 40; run++) {
    const { picks } = await call('pick_deck', { source: 'Birckk', count: 4 });
    assert.equal(picks.length, 4);
    assert.equal(new Set(picks.map(p => p.id)).size, 4);
    assert.ok(picks.every(p => p.id !== NO_COMMANDER));
  }
  const few = await call('pick_deck', { source: 'Birckk', colors: ['B', 'G'], exact: true, count: 4 });
  assert.equal(few.eligible, 3);
  assert.equal(few.picks.length, 3, 'a smaller pool returns every eligible deck once');
  const precon = await call('pick_deck', { source: 'precons', colors: ['W', 'U', 'B', 'R', 'G'], count: 2 });
  assert.ok(precon.picks.every(p => p.colors.length === 5));
});

test('deck_details shows commanders, artists, description and main-deck card count', async t => {
  stubArchidekt(t);
  const call = await connect(t);
  const details = await call('deck_details', { deck: 'https://archidekt.com/decks/27088578/calling_all_angels' });
  assert.deepEqual(details.commanders, [{ name: 'Giada, Font of Hope', artist: 'Johannes Voss' }]);
  assert.equal(details.description, 'Angels, led by [[Giada, Font of Hope]].');
  assert.equal(details.cardCount, 100, 'maybeboard cards are not counted');
  assert.equal(details.set, 'Foundations Commander');
  assert.equal(details.url, 'https://archidekt.com/decks/27088578');
  assert.equal((await call('deck_details', { deck: '27088578' })).name, details.name);
  assert.match((await call('deck_details', { deck: '27000000' })).error, /not found/);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
const jsonResponse = data => ({ ok: true, status: 200, json: async () => data });
const isDetail = url => /^\/api\/decks\/\d+\/$/.test(url.pathname);

function waitForAbort(signal, onAbort) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
    onAbort();
    reject(signal.reason);
  }, { once: true }));
}

test('pick_deck applies direct and explicit descendant folder scopes', async t => {
  stubArchidekt(t);
  const call = await connect(t);
  const source = 'https://archidekt.com/folders/1916319';
  const direct = await call('pick_deck', { source, count: 4 });
  assert.equal(direct.total, 1);
  assert.deepEqual(direct.picks.map(d => d.id), folders[0].source.entries.map(e => e.id));
  const expanded = await call('pick_deck', { source, includeSubfolders: true, count: 4 });
  assert.equal(expanded.total, 30);
  assert.equal(expanded.picks.length, 4);
});

test('empty pick errors retain unavailable reasons and distinguish loading failures', async t => {
  stubArchidekt(t, url => isDetail(url) ? { ok: false, status: 503 } : undefined);
  const client = await connectClient(t);
  const failed = await client.callTool({ name: 'pick_deck', arguments: { source: 'Birckk' } });
  assert.equal(failed.isError, true);
  assert.match(failed.structuredContent.error, /Could not load any decks/);
  assert.equal(failed.structuredContent.total, 0);
  assert.equal(failed.structuredContent.unavailable.length, decks.length + 1);
  assert.ok(failed.structuredContent.unavailable.every(d => /Archidekt is unavailable/.test(d.reason)));
  assert.ok(failed.structuredContent.unavailable.every(d => d.id && d.name));
  assert.deepEqual(JSON.parse(failed.content[0].text), failed.structuredContent);

  const empty = await client.callTool({ name: 'pick_deck', arguments: { source: 'EmptyAccount' } });
  assert.equal(empty.isError, true);
  assert.match(empty.structuredContent.error, /EmptyAccount has no public Commander decks to pick from\. Private decks/);
  assert.deepEqual(empty.structuredContent.unavailable, []);

  const filtered = await client.callTool({ name: 'pick_deck', arguments: { source: 'precons', query: 'no-such-commander-xyz' } });
  assert.match(filtered.structuredContent.error, /No decks in Official Commander precons match/);
  assert.equal(filtered.structuredContent.total, precons.decks.length);
  assert.deepEqual(filtered.structuredContent.unavailable, []);
});

test('a filtered empty pool still reports decks that could not be read', async t => {
  stubArchidekt(t);
  const client = await connectClient(t);
  const result = await client.callTool({ name: 'pick_deck', arguments: { source: 'Birckk', query: 'no-such-commander-xyz' } });
  assert.equal(result.isError, true);
  assert.match(result.structuredContent.error, /No loaded decks match.*30 decks checked; 1 unavailable/);
  assert.match(result.structuredContent.unavailable[0].reason, /no assigned commander/);
});

test('cancelling without a progress token aborts in-flight deck fetches and stops later batches', async t => {
  let aborted = 0;
  const calls = stubArchidekt(t, (url, { signal }) => isDetail(url) ? waitForAbort(signal, () => aborted++) : undefined);
  const client = await connectClient(t);
  const controller = new AbortController();
  const pending = client.callTool({ name: 'find_collection', arguments: { source: 'Birckk' } }, undefined, { signal: controller.signal });
  const rejected = assert.rejects(pending);
  await flush();
  assert.equal(calls.filter(url => isDetail(new URL(url))).length, 2);
  controller.abort();
  await rejected;
  await flush();
  assert.equal(aborted, 2);
  assert.equal(calls.filter(url => isDetail(new URL(url))).length, 2, 'no remaining decks fetched');
});

test('cancellation reaches account discovery, direct folders, descendant discovery and deck_details', async t => {
  for (const [name, args] of [
    ['find_collection', { source: 'Birckk' }],
    ['find_collection', { source: 'https://archidekt.com/folders/1916319' }],
    ['find_collection', { source: 'https://archidekt.com/folders/1916319', includeSubfolders: true }],
    ['deck_details', { deck: decks[0].id }],
  ]) {
    await t.test(JSON.stringify(args), async t => {
      let aborted = 0;
      const calls = stubArchidekt(t, (url, { signal }) => waitForAbort(signal, () => aborted++));
      const client = await connectClient(t);
      const controller = new AbortController();
      const rejected = assert.rejects(client.callTool({ name, arguments: args }, undefined, { signal: controller.signal }));
      await flush();
      controller.abort();
      await rejected;
      await flush();
      assert.equal(aborted, 1);
      assert.equal(calls.length, 1, 'no discovery or detail work after abort');
    });
  }
});

test('SDK default request timeout cancels upstream work without progress', async t => {
  let aborted = 0;
  const calls = stubArchidekt(t, (url, { signal }) => isDetail(url) ? waitForAbort(signal, () => aborted++) : undefined);
  const client = await connectClient(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const rejected = assert.rejects(client.callTool({ name: 'pick_deck', arguments: { source: 'Birckk' } }), /Request timed out/);
  await flush();
  t.mock.timers.tick(60001);
  await rejected;
  await flush();
  assert.equal(aborted, 2);
  assert.equal(calls.filter(url => isDetail(new URL(url))).length, 2);
});

test('SDK progress timeout policies extend only when requested and respect the total limit', async t => {
  for (const policy of ['fixed', 'reset', 'total-limit']) {
    await t.test(policy, async t => {
      let aborted = 0;
      const calls = stubArchidekt(t, async (url, { signal }) => {
        if (!isDetail(url)) return;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 20000);
          const abort = () => { clearTimeout(timer); aborted++; reject(signal.reason); };
          signal.addEventListener('abort', abort, { once: true });
        });
      });
      const client = await connectClient(t);
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
      const progress = [];
      const pending = client.callTool({ name: 'find_collection', arguments: { source: 'Birckk' } }, undefined, {
        onprogress: value => progress.push(value.progress),
        resetTimeoutOnProgress: policy !== 'fixed',
        ...(policy === 'total-limit' ? { maxTotalTimeout: 70000 } : {}),
      });
      const outcome = policy === 'reset' ? pending : assert.rejects(pending, /timed out|Maximum total timeout/);
      await flush();
      const steps = policy === 'reset' ? 16 : policy === 'fixed' ? 3 : 4;
      for (let i = 0; i < steps; i++) { t.mock.timers.tick(20000); await flush(); }
      const result = await outcome;
      await flush();
      assert.ok(progress.length > 0);
      if (policy === 'reset') {
        assert.equal(result.structuredContent.count, 30);
        assert.equal(aborted, 0);
      } else {
        assert.ok(calls.filter(url => isDetail(new URL(url))).length < decks.length, 'timeout stops loading the library');
        const count = calls.length;
        t.mock.timers.tick(120000);
        await flush();
        assert.equal(calls.length, count, 'no later batches after timeout');
      }
    });
  }
});
