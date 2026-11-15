import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexedPaths, pageMeta, SITE_TITLE } from '../src/pageMeta.ts';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('each page gets its own title and only indexable pages get a canonical address', () => {
  assert.deepEqual(pageMeta(null, null), { title: SITE_TITLE, path: '/' });
  assert.deepEqual(pageMeta('adding', null), { title: 'Adding your decks · DeckShelf Help', path: '/help/adding' });
  assert.deepEqual(pageMeta('settings', null), { title: 'Settings · DeckShelf', path: null });
  assert.deepEqual(pageMeta(null, { name: 'Birckk' }), { title: 'Birckk · DeckShelf', path: null });
  assert.deepEqual(pageMeta(null, {}), { title: 'Shared collection · DeckShelf', path: null });
});

test('the sitemap lists exactly the indexable pages', async () => {
  const listed = [...(await read('public/sitemap.xml')).matchAll(/<loc>https:\/\/deckshelf\.birckk\.com(\/[^<]*)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(listed, indexedPaths());
  assert.match(await read('public/robots.txt'), /^Sitemap: https:\/\/deckshelf\.birckk\.com\/sitemap\.xml$/m);
});

test('the served page names the site, its title and a share image that exists at the stated size', async () => {
  const html = await read('index.html');
  assert.ok(html.includes(`<title>${SITE_TITLE}</title>`));
  assert.doesNotMatch(html, /rel="canonical"/, 'index.html is served for every route; the app sets the canonical per page');
  const meta = name => html.match(new RegExp(`(?:property|name)="${name}" content="([^"]*)"`))?.[1];
  assert.equal(meta('og:site_name'), 'DeckShelf');
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.equal(meta('og:image'), 'https://deckshelf.birckk.com/share.jpg');
  const jpeg = await readFile(new URL('../public/share.jpg', import.meta.url));
  // Walk the JPEG markers to the frame header, which holds the height and width.
  let at = 2;
  while (jpeg[at + 1] < 0xc0 || jpeg[at + 1] > 0xc2) at += 2 + jpeg.readUInt16BE(at + 2);
  assert.deepEqual([jpeg.readUInt16BE(at + 7), jpeg.readUInt16BE(at + 5)], [Number(meta('og:image:width')), Number(meta('og:image:height'))]);
  assert.ok(jpeg.length < 300_000, 'small enough for every preview service');
  assert.match(html, /<link rel="icon" href="[^"]+\.png" type="image\/png"/);
});
