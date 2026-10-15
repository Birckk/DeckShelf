import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { cardImage, descriptionParts, matchesDeck, randomIndex, parseCollection, validateDeck, EMPTY_FILTERS } from '../src/domain.ts';
import { normalizeDeck, descriptionText } from '../server/api.mjs';

const decks = JSON.parse(readFileSync(new URL('../src/data/decks.json', import.meta.url)));
const deck = { ...decks[0], colors:['U','R'], name:'Example', theme:'Graveyard', description:'Draw cards', tags:['Spellslinger'], commanders:[{...decks[0].commanders[0], name:'Sample Commander'}] };
const f = overrides => ({...EMPTY_FILTERS, ...overrides});
test('the starter collection has all 29 unique decks, usable sources and real local images', () => {
  assert.equal(decks.length,29);
  assert.equal(new Set(decks.map(d => d.id)).size,29);
  for(const d of decks) {
    assert.ok(validateDeck(d),d.name);
    assert.equal(d.cardCount,100,d.name);
    assert.ok(d.sourceUrl.startsWith('https://archidekt.com/decks/'));
    for(const c of d.commanders) for(const field of ['image','art']) {
      assert.ok(existsSync(new URL('../public' + c[field],import.meta.url)), c[field]);
    }
  }
});
test('normal color filtering requires every selected color and permits extra colors', () => {
  assert.equal(matchesDeck(deck,f({colors:['U']})),true);
  assert.equal(matchesDeck(deck,f({colors:['U','R']})),true);
  assert.equal(matchesDeck({...deck,colors:['U','R','G']},f({colors:['U','R']})),true);
  assert.equal(matchesDeck({...deck,colors:['U']},f({colors:['U','R']})),false);
  assert.equal(matchesDeck({...deck,colors:['R']},f({colors:['U','R']})),false);
  assert.equal(matchesDeck(deck,f({colors:['U','G']})),false);
  assert.equal(matchesDeck(deck,f({colors:['W','G']})),false);
});
test('selecting all five colors only matches five-color decks; clearing colors shows all', () => {
  const colors=['W','U','B','R','G'];
  assert.equal(matchesDeck({...deck,colors},f({colors})),true);
  for (const missing of colors) {
    assert.equal(matchesDeck({...deck,colors:colors.filter(c => c !== missing)},f({colors})),false);
  }
  assert.deepEqual(decks.filter(d => matchesDeck(d,f({colors}))),decks.filter(d => d.colors.length === 5));
  assert.equal(decks.filter(d => matchesDeck(d,f({}))).length,decks.length);
});
test('exact filtering requires all and only the selected colors', () => {
  assert.equal(matchesDeck(deck,f({colors:['R','U'],exact:true})),true);
  assert.equal(matchesDeck(deck,f({colors:['U'],exact:true})),false);
  assert.equal(matchesDeck(deck,f({colors:['U','R','G'],exact:true})),false);
  assert.equal(matchesDeck(deck,f({colors:[],exact:true})),true);
});
test('colorless and number-of-colors filters work independently', () => {
  assert.equal(matchesDeck({...deck,colors:[]},f({colorless:true})),true);
  assert.equal(matchesDeck(deck,f({colorless:true})),false);
  assert.equal(matchesDeck(deck,f({count:'2'})),true);
  assert.equal(matchesDeck(deck,f({count:'1'})),false);
});
test('search finds commanders, descriptions, themes and tags; multiple terms must all match', () => {
  assert.equal(matchesDeck(deck,f({query:'sample graveyard'})),true);
  assert.equal(matchesDeck(deck,f({query:'DRAW spellslinger'})),true);
  assert.equal(matchesDeck(deck,f({query:'sample nonexistent'})),false);
});
test('filters compose and cannot escape the selected release or theme', () => {
  assert.equal(matchesDeck(deck,f({colors:['U'],set:deck.set,tag:'Spellslinger'})),true);
  assert.equal(matchesDeck(deck,f({colors:['U'],set:'Another release'})),false);
  assert.equal(matchesDeck(deck,f({tag:'Tokens'})),false);
});
test('random choice handles zero and one and rejects the biased tail', () => {
  assert.throws(() => randomIndex(0));
  assert.equal(randomIndex(1,a => {a[0]=42;return a;}),0);
  let calls=0;
  const result=randomIndex(3,a => {a[0]=calls++ === 0 ? 0xffffffff : 5;return a;});
  assert.equal(calls,2);
  assert.equal(result,2);
});
test('each eligible index is reachable, including the final entry', () => {
  for(let i=0;i<29;i++) assert.equal(randomIndex(29,a => {a[0]=i;return a;}),i);
});
test('backup round-trip keeps exclusions, hidden decks and added metadata', () => {
  const value={version:1,hidden:['12'],excluded:['34'],added:[deck]};
  assert.deepEqual(parseCollection(JSON.stringify(value)),value);
});
test('malformed backups and unsafe source or image URLs are rejected', () => {
  const value={version:1,hidden:[],excluded:[],added:[deck]};
  for(const mutation of [{version:2},{hidden:[1]},{added:[{...deck,sourceUrl:'javascript:alert(1)'}]},{added:[{...deck,commanders:[{...deck.commanders[0],image:'file:///secret'}]}]},{added:[deck,deck]}]) {
    assert.throws(() => parseCollection(JSON.stringify({...value,...mutation})));
  }
});
test('source normalization preserves partner commanders and combines their identity', () => {
  const card = (name,color,uid) => ({categories:['Commander'],quantity:1,card:{uid,artist:'Artist',oracleCard:{name,colorIdentity:[color]},edition:{editionname:'Sample'},releasedAt:'2025-01-01'}});
  const result=normalizeDeck({id:1,name:'Partner deck',deckFormat:3,description:'<p>Example</p>',cards:[card('First','White','687a2b76-3f05-4732-bd9b-513d06d16300'),card('Second','Green','687a2b76-3f05-4732-bd9b-513d06d16301')]});
  assert.equal(result.commanders.length,2);
  assert.deepEqual(result.colors,['W','G']);
  assert.equal(result.description,'Example');
  assert.ok(validateDeck(result));
});
test('source normalization rejects non-Commander and unassigned decks', () => {
  assert.throws(() => normalizeDeck({deckFormat:2,cards:[]}));
  assert.throws(() => normalizeDeck({deckFormat:3,cards:[]}));
});
test('Archidekt rich text becomes readable text, including embedded card names', () => {
  assert.equal(descriptionText(JSON.stringify({ops:[{insert:'Play '},{insert:{'card-link':'Sol Ring'}},{insert:' &amp; friends.\n'},{insert:{image:'ignored'}}]})), 'Play Sol Ring & friends.');
  assert.equal(descriptionText('<p>Plain text</p>'),'Plain text');
  assert.equal(descriptionText(null),'');
});

test('source normalization includes uncategorized cards in older precons', () => {
  const commander = { categories: ['Commander'], quantity: 1, card: { uid: '687a2b76-3f05-4732-bd9b-513d06d16300', artist: 'Artist', oracleCard: { name: 'Commander', colorIdentity: ['Blue'] }, edition: { editionname: 'Sample' } } };
  const deck = normalizeDeck({ id: 42, name: 'Old precon', deckFormat: 3, cards: [commander, { categories: null, quantity: 98 }, { quantity: 1 }, { categories: ['Sideboard'], quantity: 5 }] });
  assert.equal(deck.cardCount, 100);
  assert.ok(validateDeck(deck));
});
test('[[Card Name]] references in descriptions become plain, marked card names', () => {
  assert.deepEqual(descriptionParts('Meet [[Yennett, Cryptic Sovereign]]. Cast [[Sol Ring]] and [[Arcane Signet]]'), [
    {text:'Meet '},{text:'Yennett, Cryptic Sovereign',card:true},{text:'. Cast '},{text:'Sol Ring',card:true},{text:' and '},{text:'Arcane Signet',card:true},
  ]);
  assert.deepEqual(descriptionParts('No markup here'),[{text:'No markup here'}]);
  assert.deepEqual(descriptionParts('[[Sol Ring]]'),[{text:'Sol Ring',card:true}]);
  assert.deepEqual(descriptionParts('Broken [[Sol Ring] and [[]] stay as typed'),[{text:'Broken [[Sol Ring] and [[]] stay as typed'}]);
  assert.deepEqual(descriptionParts(''),[]);
  const bundled = JSON.parse(readFileSync(new URL('../src/data/precons.json', import.meta.url)));
  for (const d of [...decks, ...bundled.decks]) for (const p of descriptionParts(d.description || '')) assert.ok(!p.text.includes('[['), d.name);
});

test('Archidekt card images map to the identical Scryfall files; other images are untouched', () => {
  const id = '0ba9362f-eb35-4e72-8c51-7047c0a3f648';
  assert.equal(cardImage(`https://card-images.archidekt.com/art/front/0/b/${id}.webp`), `https://cards.scryfall.io/art/front/0/b/${id}.webp`);
  assert.equal(cardImage(`https://card-images.archidekt.com/grid/back/0/b/${id}.webp`), `https://cards.scryfall.io/grid/back/0/b/${id}.webp`);
  for (const url of ['/images/x-art.webp', `https://card-images.archidekt.com/crop/front/0/b/${id}.webp`, `https://example.com/art/front/0/b/${id}.webp`])
    assert.equal(cardImage(url), url);
});
