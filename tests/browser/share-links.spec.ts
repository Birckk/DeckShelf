import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
import fs from 'node:fs';
const key = 'commander-archive.collection.v1';
const deck = {...seed[0], id:'987001', name:'Shared Commander'};
const source = {key:'folder:42',kind:'folder',value:'42',name:'Public shelf',url:'https://archidekt.com/folders/42',checkedAt:new Date().toISOString(),entries:[{id:deck.id,name:deck.name,image:deck.commanders[0].art,colors:deck.colors}],knownIds:[deck.id]};
// Shared links read the same folder listing as Add decks: one root folder here.
const tree = <T extends {name:string}>(root: T) => ({name:root.name,folders:[{source:root,path:root.name,root:true}]});
async function mock(page: import('@playwright/test').Page) {
  await page.route('**/api/source-folders?*', route => route.fulfill({json:tree(source)}));
  await page.route('**/api/decks/987001', route => route.fulfill({json:deck}));
}
test('fresh shared visitor has no precons, persists only on explicit save, and can return', async ({page}) => {
  await mock(page);
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await expect(page.locator('.collection-tile')).toHaveCount(1);
  await page.getByRole('button',{name:'Save to my collection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!).sources[0].key).toBe(source.key);
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await expect(page).toHaveURL('/');
});
test('existing saved collection survives browsing, back and forward and upstream failure', async ({page}) => {
  const saved = JSON.stringify({version:1,starter:false,hidden:[],excluded:[],added:[seed[1]],manualIds:[seed[1].id]});
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,saved);},{key,saved});
  await mock(page);
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!)).toEqual(JSON.parse(saved));
  await page.getByRole('button',{name:'Cards',exact:true}).click();
  await expect(page).toHaveURL('/f/42');
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await page.goBack();
  await expect(page.getByRole('region',{name:'Shared collection'})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('region',{name:'Shared collection'})).toHaveCount(0);
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!)).toEqual(JSON.parse(saved));
  await page.route('**/api/source-folders?*', route => route.fulfill({status:404,json:{error:'Source not found or not public.'}}));
  await page.goto('/f/99');
  await expect(page.getByText('Source not found or not public.',{exact:true})).toBeVisible();
  // A proxy's own error page is not JSON; it must not reach people as a parse error.
  await page.unroute('**/api/source-folders?*');
  await page.route('**/api/source-folders?*', route => route.fulfill({status:502,contentType:'text/plain',body:'error code: 502'}));
  await page.goto('/f/98');
  await expect(page.getByText('This public collection is unavailable.',{exact:true})).toBeVisible();
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!)).toEqual(JSON.parse(saved));
});
test('invalid links do not fetch an upstream source', async ({page}) => {
  let requests=0;
  page.on('request',request=>{if(request.url().includes('/api/'))requests++;});
  await page.goto('/f/not-a-number?format=modern');
  await expect(page.getByText(/This collection link is invalid/)).toBeVisible();
  expect(requests).toBe(0);
});
for (const [width,height] of [[1920,1080],[1500,900],[390,844]]) test(`shared collection and copy preview at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  const galleryDecks = [deck, ...seed.slice(1)];
  await page.route('**/api/source-folders?*', route => route.fulfill({json:tree({...source,entries:galleryDecks.map(d=>({id:d.id,name:d.name,image:d.commanders[0].art,colors:d.colors})),knownIds:galleryDecks.map(d=>d.id)})}));
  await page.route('**/api/decks/*', route => route.fulfill({json:galleryDecks.find(d=>route.request().url().endsWith('/'+d.id))}));
  // WebKit has no clipboard permissions in Playwright; a recording clipboard works in every engine.
  await page.addInitScript(()=>{ let copied=''; Object.defineProperty(navigator,'clipboard',{value:{writeText:(t:string)=>{copied=t;return Promise.resolve();},readText:()=>Promise.resolve(copied)},configurable:true}); });
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  fs.mkdirSync('.codex-shots',{recursive:true});
  await page.screenshot({path:`.codex-shots/shared-${width}.png`,fullPage:false});
  // Phones keep Share in the folders view; the bar has one row.
  if (width === 390) await page.getByRole('button',{name:/ folders$/}).click();
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByLabel('Collection link')).toHaveValue(`${new URL(page.url()).origin}/f/42`);
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Link copied.'})).toBeVisible();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/f/42`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.codex-shots/share-dialog-${width}.png`,fullPage:false});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Public shelf folders',exact:true}).click();
  await expect(page.locator('.workspace-heading')).toContainText('Read-only');
  await page.screenshot({path:`.codex-shots/shared-folders-${width}.png`,fullPage:false});
});

test('account links load the exact public account; its folders open read-only and Mine leaves it', async ({page}) => {
  await page.route('**/api/source-folders?*', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('kind')).toBe('account');
    expect(url.searchParams.get('value')).toBe('A.b');
    expect(url.searchParams.get('formats')).toBe('all');
    return route.fulfill({json:{...tree(source),name:'A.b'}});
  });
  await page.route('**/api/decks/987001', route => route.fulfill({json:deck}));
  await page.goto('/u/A.b?format=commander');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  // The header button follows the shown shelf: A.b's folders, read-only.
  await page.getByRole('button',{name:'A.b folders',exact:true}).click();
  const workspace = page.getByRole('main',{name:'A.b folders'});
  await expect(workspace.getByRole('heading',{name:'A.b',exact:true})).toBeVisible();
  await workspace.getByRole('navigation',{name:'Collection sources'}).getByRole('button',{name:'Public shelf',exact:true}).click();
  await expect(workspace.locator('.workspace-tile')).toHaveCount(1);
  // Its controls are the same as yours, but adding and removing stay on your own shelf.
  await expect(workspace.getByRole('switch').first()).toBeVisible();
  await expect(workspace.getByRole('button',{name:'Refresh',exact:true})).toHaveCount(0);
  await expect(workspace.getByRole('button',{name:'Add decks'})).toHaveCount(0);
  await expect(page).toHaveURL('/u/A.b?format=commander');
  await page.getByRole('button',{name:'Showing A.b. Switch collection'}).click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Mine/}).click();
  await expect(page.getByRole('region',{name:'Shared collection'})).toHaveCount(0);
  await expect(page).toHaveURL('/');
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await expect(page.locator('.workspace-heading')).toBeVisible();
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByText('Add an Archidekt account or folder in My collection to share it.')).toBeVisible();
});
test('a shared shelf opens from its folder listing while deck details load behind it', async ({page}) => {
  const hidden = {...seed[1],id:'987003',name:'Private deck'};
  const listed = [deck, hidden].map(d => ({id:d.id,name:d.name,image:d.commanders[0].art,colors:d.colors}));
  await page.route('**/api/source-folders?*', route => route.fulfill({json:tree({...source,entries:listed,knownIds:listed.map(e=>e.id)})}));
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/decks/987001', async route => { await held; await route.fulfill({json:deck}); });
  await page.route('**/api/decks/987003', route => route.fulfill({status:502,json:{error:'This deck is private.',retry:false}}));
  await page.goto('/f/42');
  // The listing's name and art show at once; Save waits for the details.
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  const bar = page.getByRole('region',{name:'Shared collection'});
  await expect(bar).toContainText('Read-only · 1 public deck · 1 loading · 1 couldn’t load');
  await expect(page.getByRole('button',{name:'Save to my collection',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'View Shared Commander',exact:true}).click();
  await expect(page.getByText('Loading details from Archidekt…')).toBeVisible();
  release();
  await expect(page.getByText('Loading details from Archidekt…')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Save to my collection',exact:true})).toBeEnabled();
  await expect(bar).toContainText('Read-only · 1 public deck · 1 couldn’t load');
});
test("explicit save adds a source while preserving a visitor's personal deck and choices", async ({page}) => {
  const saved = {version:1,starter:false,hidden:[seed[1].id],excluded:[seed[1].id],added:[seed[1]],manualIds:[seed[1].id]};
  await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key,saved});
  await mock(page);
  await page.goto('/f/42');
  await page.getByRole('button',{name:'Save to my collection',exact:true}).click();
  // Save is asynchronous (it waits for a Web Lock); read storage once it has finished.
  await expect(page.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  const result = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(result.hidden).toEqual(saved.hidden);
  expect(result.excluded).toEqual(saved.excluded);
  expect(result.manualIds).toEqual(saved.manualIds);
  expect(result.added.map((d:{id:string})=>d.id)).toEqual([seed[1].id,deck.id]);
});
test('clipboard denial on phone offers a selectable manual link without changing collection storage', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
  await mock(page);
  await page.goto('/f/42');
  await page.getByRole('button',{name:/ folders$/}).click();
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  await expect(page.getByText('Copy was unavailable. Select the link above and copy it.')).toBeVisible();
  await page.getByLabel('Collection link').focus();
  expect(await page.getByLabel('Collection link').evaluate((input:HTMLInputElement)=>input.value.slice(input.selectionStart!,input.selectionEnd!))).toBe(`${new URL(page.url()).origin}/f/42`);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});

test('personal Select -> Help -> Collection preserves filters and shortlist', async ({page}) => {
  const saved = {version:1,starter:false,added:[deck,seed[1]],hidden:[],excluded:[],manualIds:[deck.id,seed[1].id]};
  await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key,saved});
  await page.goto('/');
  await page.getByRole('textbox',{name:'Search decks',exact:true}).fill('Shared');
  await page.getByRole('button',{name:'Choose a few',exact:true}).click();
  await page.getByRole('button',{name:'Select Shared Commander',exact:true}).click();
  await expect(page.getByRole('button',{name:'1 selected',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await expect(page).toHaveURL('/help/start');
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('textbox',{name:'Search decks',exact:true})).toHaveValue('Shared');
  await expect(page.getByRole('button',{name:'1 selected',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Select Shared Commander',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goBack();
  await expect(page).toHaveURL('/help/start');
  await page.goForward();
  await expect(page.getByRole('textbox',{name:'Search decks',exact:true})).toHaveValue('Shared');
  await expect(page.getByRole('button',{name:'1 selected',exact:true})).toBeVisible();
});

for (const [width,height] of [[1920,1080],[1500,900],[390,844]]) test(`multi-folder account import offers account and folder links at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'reduce'});
  const second = {...seed[1],id:'987002'};
  const secondSource = {...source,key:'folder:43',value:'43',name:'Another folder',url:'https://archidekt.com/folders/43',entries:[{id:second.id,name:second.name,image:second.commanders[0].art,colors:second.colors}],knownIds:[second.id]};
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:1,starter:false,added:[],hidden:[],excluded:[]})),key);
  await page.route('**/api/source-folders?*', route => route.fulfill({json:{name:'Birckk',folders:[{source,path:'Home',root:true},{source:secondSource,path:'Home / Another folder',root:false}]}}));
  await page.route('**/api/decks/*', route => route.fulfill({json:route.request().url().endsWith('/987001')?deck:second}));
  await page.goto('/');
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await page.getByRole('button',{name:'Add decks',exact:true}).click();
  await page.locator('#collection-source-input').fill('Birckk');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:'Add 2 decks',exact:true}).click();
  await expect(page.locator('.manager-progress')).toHaveCount(0);
  await expect(page.locator('.workspace-heading')).toContainText('2 on display');
  await page.getByRole('button',{name:'Share',exact:true}).click();
  const options = page.getByLabel('Account or folder');
  await expect(options.locator('option')).toHaveCount(3);
  await options.selectOption('account:birckk');
  await expect(page.getByLabel('Collection link')).toHaveValue(`${new URL(page.url()).origin}/u/birckk`);
  fs.mkdirSync('.codex-shots',{recursive:true});
  await page.screenshot({path:`.codex-shots/account-share-${width}.png`});
  await options.selectOption('folder:42');
  await expect(page.getByLabel('Collection link')).toHaveValue(`${new URL(page.url()).origin}/f/42`);
  await options.selectOption('folder:43');
  await expect(page.getByLabel('Collection link')).toHaveValue(`${new URL(page.url()).origin}/f/43`);
});

async function sharedTabWithNewerStorage(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  const personal = {...seed[1],id:'987004',name:'Personal A'};
  const newer = {...seed[2],id:'987005',name:'Personal B'};
  const initial = {version:1,starter:false,added:[personal],hidden:[],excluded:[],manualIds:[personal.id]};
  await page.addInitScript(({key,initial})=>{
    if (localStorage.getItem(key) === null) localStorage.setItem(key,JSON.stringify(initial));
    const writes:string[]=[];
    (window as unknown as {collectionWrites:string[]}).collectionWrites=writes;
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,value){if(k===key)writes.push(value);return setItem.call(this,k,value);};
  },{key,initial});
  await mock(page);
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  const other = await context.newPage();
  await other.addInitScript(key=>{
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,value){
      setItem.call(this,k,value);
      if(k===key)(window as unknown as {bootCollectionWritten:boolean}).bootCollectionWritten=true;
    };
  },key);
  await other.goto('/');
  // Finish the personal tab's mount persistence before simulating its later edit.
  await expect.poll(()=>other.evaluate(()=>(window as unknown as {bootCollectionWritten:boolean}).bootCollectionWritten)).toBe(true);
  await other.evaluate(({key,initial,newer,personal})=>localStorage.setItem(key,JSON.stringify({...initial,added:[personal,newer],hidden:[personal.id],manualIds:[personal.id,newer.id]},null,2)),{key,initial,newer,personal});
  const raw = await other.evaluate(key=>localStorage.getItem(key),key);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  return {other,raw,personal,newer};
}

for (const exit of ['Back to my collection','Mine','Help','history']) test(`leaving a shared tab via ${exit} reads newer storage without a collection write`, async ({page,context}) => {
  const {raw,newer} = await sharedTabWithNewerStorage(page,context);
  if (exit==='Mine') {
    await page.getByRole('button',{name:/^Showing .*Switch collection$/}).click();
    await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Mine/}).click();
  } else await page.getByRole('button',{name:exit==='history'?'Back to my collection':exit,exact:true}).click();
  await expect(page.getByRole('region',{name:'Shared collection'})).toHaveCount(0);
  if (exit==='history') {
    await page.goBack();
    await expect(page.getByRole('region',{name:'Shared collection'})).toBeVisible();
    await page.goForward();
  }
  if (exit==='Help') await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.getByRole('button',{name:`View ${newer.name}`,exact:true})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  expect(await page.evaluate(()=>(window as unknown as {collectionWrites:string[]}).collectionWrites)).toEqual([]);
});

test('shared Save merges newer data from another tab and returning preserves subsequent edits', async ({page,context}) => {
  const {other,personal,newer} = await sharedTabWithNewerStorage(page,context);
  await page.getByRole('button',{name:'Save to my collection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(saved.added.map((item:{id:string})=>item.id)).toEqual([personal.id,newer.id,deck.id]);
  expect(saved.hidden).toEqual([personal.id]);
  await other.evaluate(({key,saved,id})=>localStorage.setItem(key,JSON.stringify({...saved,hidden:[...saved.hidden,id]},null,2)),{key,saved,id:deck.id});
  const latest=await other.evaluate(key=>localStorage.getItem(key),key);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBe(latest);
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await expect(page.getByRole('button',{name:`View ${newer.name}`,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(latest);
  expect(await page.evaluate(()=>(window as unknown as {collectionWrites:string[]}).collectionWrites.length)).toBe(1);
});

for (const failure of [false, true]) test(`Choose decks leaves an ${failure ? 'unavailable' : 'empty'} shared view and persists personal edits`, async ({page}) => {
  const personalSource = {...source,key:'folder:43',value:'43',name:'Personal shelf',url:'https://archidekt.com/folders/43',selectedIds:[deck.id],ownedIds:[deck.id]};
  const initial = {version:1,starter:false,added:[deck],hidden:[],excluded:[],sources:[personalSource],manualIds:[]};
  await page.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial));},{key,initial});
  await page.route('**/api/source-folders?*', route => failure
    ? route.fulfill({status:404,json:{error:'This source is unavailable or private.'}})
    : route.fulfill({json:tree({...source,entries:[],knownIds:[]})}));
  await page.goto('/f/42');
  await expect(page.getByRole('region',{name:'Shared collection'})).not.toContainText('Loading');
  await page.getByRole('button',{name:'Choose decks',exact:true}).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('region',{name:'Shared collection'})).toHaveCount(0);
  await page.getByRole('navigation',{name:'Collection sources'}).getByRole('button',{name:'Personal shelf',exact:true}).click();
  await page.getByRole('checkbox',{name:'Show Shared Commander',exact:true}).uncheck();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).sources[0].selectedIds,key)).toEqual([]);
  await page.getByRole('button',{name:'Back to collection',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await page.getByRole('navigation',{name:'Collection sources'}).getByRole('button',{name:'Personal shelf',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Show Shared Commander',exact:true})).not.toBeChecked();
});

test('two shared tabs queue Saves behind the same Web Lock and keep both sources', async ({page,context}) => {
  await page.addInitScript(key=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,starter:false,added:[],hidden:[],excluded:[]}));},key);
  await mock(page);
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  const other = await context.newPage();
  const second = {...seed[1],id:'987002',name:'Second shared deck'};
  const secondSource = {...source,key:'folder:43',value:'43',name:'Second shelf',url:'https://archidekt.com/folders/43',knownIds:[second.id],entries:[{id:second.id,name:second.name,image:second.commanders[0].art,colors:second.colors}]};
  await other.route('**/api/source-folders?*',route=>route.fulfill({json:tree(secondSource)}));
  await other.route('**/api/decks/*',route=>route.fulfill({json:second}));
  await other.goto('/f/43');
  await expect(other.getByRole('button',{name:'View Second shared deck',exact:true})).toBeVisible();
  await page.evaluate(async()=>{
    const held = window as unknown as {releaseSaveLock:()=>void};
    await new Promise<void>(ready=>{
      void navigator.locks.request('deckshelf-collection',()=>new Promise<void>(release=>{
        held.releaseSaveLock=release;
        ready();
      }));
    });
  });
  await Promise.all([page.getByRole('button',{name:'Save to my collection',exact:true}).click(),other.getByRole('button',{name:'Save to my collection',exact:true}).click()]);
  await expect(page.getByRole('button',{name:'Save to my collection',exact:true})).toBeDisabled();
  await expect(other.getByRole('button',{name:'Save to my collection',exact:true})).toBeDisabled();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).added,key)).toEqual([]);
  await page.evaluate(()=>(window as unknown as {releaseSaveLock:()=>void}).releaseSaveLock());
  await expect(page.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  await expect(other.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).added.map((d:{id:string})=>d.id).sort(),key)).toEqual([deck.id,second.id]);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).sources.map((s:{key:string})=>s.key).sort(),key)).toEqual(['folder:42','folder:43']);
});

test('shared Save preserves an existing all-format source and Settings preferences', async ({page}) => {
  const modern = {...seed[1],id:'987009',name:'Personal Modern deck',format:{id:'modern',name:'Modern',sourceId:2},commanders:[],cover:{...seed[1].commanders[0],kind:'featured'}};
  const personalSource = {...source,formatScope:'all',entries:[{id:modern.id,name:modern.name,image:modern.cover.art,colors:modern.colors,format:modern.format}],knownIds:[modern.id],selectedIds:[modern.id],ownedIds:[modern.id]};
  const saved = {version:1,starter:false,added:[modern],hidden:[],excluded:[],sources:[personalSource],manualIds:[],cardBack:'wedges',hideArtwork:true};
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(saved));},{key,saved});
  await page.route('**/api/source-folders?*',route=>{
    expect(new URL(route.request().url()).searchParams.get('formats')).toBe('all');
    return route.fulfill({json:tree(source)});
  });
  await page.route('**/api/decks/987001',route=>route.fulfill({json:deck}));
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View Personal Modern deck',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByLabel('Collection link')).toHaveValue(`${new URL(page.url()).origin}/f/42`);
  await expect(page.locator('.share-dialog')).toContainText('public decks');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Save to my collection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saved to my collection',exact:true})).toBeDisabled();
  const result=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(result.cardBack).toBe('wedges');
  expect(result.hideArtwork).toBe(true);
  expect(result.added).toEqual([modern,deck]);
  expect(result.sources[0].formatScope).toBe('all');
  expect(result.sources[0].selectedIds).toEqual([modern.id,deck.id]);
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByLabel('Format',{exact:true}).selectOption('all');
  await page.getByRole('button',{name:'Close filters',exact:true}).click();
  await expect(page.getByRole('button',{name:'View Personal Modern deck',exact:true})).toBeVisible();
});

test('shared views include public decks in every format, Commander first', async ({page}) => {
  await mock(page);
  await page.route('**/api/decks/987001',route=>route.fulfill({json:{...deck,format:{id:'modern',name:'Modern',sourceId:2},commanders:[],cover:{...deck.commanders[0],kind:'featured'}}}));
  await page.goto('/f/42');
  await expect(page.getByRole('region',{name:'Shared collection'})).toContainText('1 public deck');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByLabel('Format',{exact:true}).selectOption('all');
  await page.getByRole('button',{name:'Close filters',exact:true}).click();
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});
