import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharePath, parseShelfInput, buildSharePath, buildShareUrl, shareSourceOptions } from '../src/share-links.ts';

test('source links round trip account and numeric Archidekt folder IDs', () => {
  for (const source of [{kind:'account',value:'A.b + user'}, {kind:'folder',value:'1916319'}]) {
    assert.deepEqual(parseSharePath(buildSharePath(source)), source);
    assert.equal(buildShareUrl('https://shelf.example/help/faq', source), `https://shelf.example${buildSharePath(source)}`);
  }
  assert.deepEqual(parseSharePath('/u/Birckk', '?format=commander'), {kind:'account',value:'Birckk'});
  assert.equal(parseSharePath('/help/faq'), null);
});
test('shared links reject malformed identifiers, unsupported fields and foreign source URLs', () => {
  for (const path of ['/u/', '/f/nope', '/u/%', '/u/%2Fetc', '/u/https%3A%2F%2Fevil.example', '/f/123/extra', '/f/1234567890123']) assert.throws(() => parseSharePath(path));
  for (const query of ['?format=modern','?source=https://evil.example','?v=1&hidden=123','?format=commander&format=commander']) assert.throws(() => parseSharePath('/u/test', query));
  for (const base of ['javascript:alert(1)', 'archive://app/', 'https://user:pass@example.com']) assert.throws(() => buildShareUrl(base, {kind:'account',value:'test'}));
});

test('Node callers cannot build unsupported source kinds', () => {
  assert.throws(() => buildSharePath({kind:'deck',value:'123'}));
});

test('share options reconstruct and deduplicate accounts while retaining direct folders', () => {
  const folder = { key: 'folder:42', kind: 'folder', value: '42', name: 'First folder', connectionKey: 'account:birckk', connectionName: 'Birckk' };
  const second = { ...folder, key: 'folder:43', value: '43', name: 'Second folder' };
  const options = shareSourceOptions([folder, second]);
  assert.deepEqual(options.map(option => buildSharePath(option)), ['/u/birckk', '/f/42', '/f/43']);
  assert.equal(options[0].name, 'Birckk');
  assert.deepEqual(shareSourceOptions([{ ...folder, connectionKey: 'account:https://evil.example' }]).map(option => option.key), ['folder:42']);
});

test('a typed username or pasted link opens as a shelf', () => {
  const account = {kind:'account',value:'Birckk'}, folder = {kind:'folder',value:'1916319'};
  for (const input of ['Birckk', '  Birckk  ', 'https://archidekt.com/u/Birckk', 'https://www.archidekt.com/u/Birckk#decks', 'archidekt.com/u/Birckk',
    'https://deckshelf.example/u/Birckk', 'http://localhost:4317/u/Birckk?format=commander']) assert.deepEqual(parseShelfInput(input), account);
  for (const input of ['https://archidekt.com/folders/1916319', 'archidekt.com/folders/1916319/Name', 'https://deckshelf.example/f/1916319']) assert.deepEqual(parseShelfInput(input), folder);
  assert.deepEqual(parseShelfInput('Some Name'), {kind:'account',value:'Some Name'});
});

test('what cannot open as a shelf says why', () => {
  assert.throws(() => parseShelfInput('   '), /username or link/);
  assert.throws(() => parseShelfInput('https://archidekt.com/decks/123/name'), /single deck/);
  assert.throws(() => parseShelfInput('http://archidekt.com/u/Birckk'), /https:\/\/archidekt\.com/);
  assert.throws(() => parseShelfInput('https://archidekt.com/search/decks'), /profile, folder/);
  assert.throws(() => parseShelfInput('https://elsewhere.example/profile'), /DeckShelf collection link/);
  assert.throws(() => parseShelfInput('https://a:b@elsewhere.example/u/Birckk'), /DeckShelf collection link/);
  assert.throws(() => parseShelfInput('https://deckshelf.example/u/%2Fetc'));
  assert.throws(() => parseShelfInput('bad/name'), /username/);
  assert.throws(() => parseShelfInput('x'.repeat(101)), /username/);
});
