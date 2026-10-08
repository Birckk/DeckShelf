import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoverFolders } from '../server/sources.mjs';
import { importFolderSelection, parseSourceInput } from '../src/collection.ts';
import { parseCollection } from '../src/domain.ts';

const row = (id, folder) => ({ id, name: `Deck ${id}`, deckFormat: 3, parentFolderId: folder, owner: { username: 'Example' } });
const folder = (id, children = [], decks = []) => ({ id, name: `Folder ${id}`, owner: { username: 'Example' }, private: false, subfolders: children.map(id => ({ id })), decks, count: decks.length, next: null });
function mockTree(t, tree) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url).includes('/u/')) return { ok: true, text: async () => '<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({ props: { pageProps: { user: { username: 'Example', rootFolderId: 1 } } } })+'</script>' };
    const id = new URL(url).pathname.split('/').filter(Boolean).at(-1);
    const data = tree[id];
    if (!data) return { ok: false, status: 404 };
    return { ok: true, json: async () => typeof data === 'function' ? data(new URL(url)) : data };
  });
  return calls;
}
test('username detection needs no mode and links still detect folder and deck', () => {
  assert.equal(parseSourceInput(' Example ').key, 'account:example');
  assert.equal(parseSourceInput('https://archidekt.com/folders/42').key, 'folder:42');
  assert.equal(parseSourceInput('https://archidekt.com/decks/42').key, 'deck:42');
  assert.throws(() => parseSourceInput('https://elsewhere.com/u/Example'));
});
test('account discovery includes root, nested and empty folders and skips private folders', async t => {
  const root = folder(1, [2,3], [row(11,1)]);
  root.subfolders.push({ id: 99, private: true });
  const calls = mockTree(t, { 1: root, 2: folder(2,[4],[row(22,2)]), 3: folder(3), 4: folder(4,[],[row(44,4)]) });
  const result = await discoverFolders('account','Example');
  assert.equal(result.folders.length,4);
  assert.equal(result.folders[3].path,'Folder 1 / Folder 2 / Folder 4');
  assert.deepEqual(result.folders[2].source.entries,[]);
  assert.equal(calls.length,5);
  assert.ok(!calls.some(url => url.includes('/99/')));
});
test('folder discovery follows constructed pagination and keeps Commander scope', async t => {
  const calls = mockTree(t, { 1: url => url.searchParams.get('page') === '1'
    ? { ...folder(1,[],[row(11,1), { ...row(12,1), deckFormat: 1 }]), count:3, next: 'https://evil.test/page2' }
    : {...folder(1,[],[row(13,1)]), count:3} });
  const result = await discoverFolders('folder','1');
  assert.deepEqual(result.folders[0].source.knownIds,['11','13']);
  assert.ok(calls.every(url => url.startsWith('https://archidekt.com/')));
});
test('incomplete, cyclic and unavailable trees fail instead of claiming completeness', async t => {
  const tree = {1: folder(1,[2])};
  mockTree(t,tree);
  await assert.rejects(discoverFolders('folder','1'),/not public/);
  tree[2] = folder(2,[1]);
  await assert.rejects(discoverFolders('folder','1'),/inconsistent/);
  tree[1] = { ...folder(1), subfolders: undefined };
  await assert.rejects(discoverFolders('folder','1'),/complete folder/);
  tree[1] = { ...folder(1), count: 2 };
  await assert.rejects(discoverFolders('folder','1'),/incomplete/);
});
test('discovery rejects wrong owners and bounds tree size', async t => {
  const tree = {1: {...folder(1), owner:{username:'SomeoneElse'}}};
  mockTree(t,tree);
  await assert.rejects(discoverFolders('account','Example'),/different account/);
  tree[1] = folder(1,Array.from({length:80},(_,i)=>i+2));
  await assert.rejects(discoverFolders('folder','1'),/80 folders/);
});
test('import saves only accepted choices, deduplicates snapshots and preserves unrelated choices and backups', () => {
  const deck = JSON.parse(readFileSync(new URL('../src/data/decks.json',import.meta.url)))[0];
  const source = { key:'folder:1',kind:'folder',value:'1',name:'Folder',url:'https://archidekt.com/folders/1',checkedAt:new Date().toISOString(),entries:[{id:deck.id,name:deck.name,image:'',colors:[]}],knownIds:[deck.id],selectedIds:[deck.id] };
  const before = { version:1, added:[deck], hidden:[deck.id,'999'],excluded:[deck.id],sources:[source],disabledGroups:['folder:1','demo'],starter:false };
  const result = importFolderSelection(before,[source],[deck],[deck]);
  assert.equal(result.added.length,1);
  assert.deepEqual(result.hidden,['999']);
  assert.deepEqual(result.excluded,[deck.id]);
  assert.deepEqual(result.disabledGroups,['demo']);
  assert.deepEqual(result.sources[0].selectedIds,[deck.id]);
  assert.deepEqual(before.hidden,[deck.id,'999']);
  assert.deepEqual(parseCollection(JSON.stringify(result)),result);
  const isolated = importFolderSelection(before,[source],[deck],[deck],['folder:1','manual','demo']);
  assert.deepEqual(isolated.disabledGroups,['demo','manual']);
  assert.deepEqual(isolated.sources[0].selectedIds, before.sources[0].selectedIds);
  assert.equal(importFolderSelection({...before,sources:[]},[source],[],[deck]).sources.length,0);
});
