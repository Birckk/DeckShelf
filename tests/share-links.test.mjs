import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharePath, buildSharePath, buildShareUrl, shareSourceOptions } from '../src/share-links.ts';

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
