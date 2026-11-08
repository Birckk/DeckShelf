import { test, expect, type Page } from '@playwright/test';
import seed from '../fixtures/collection-decks.json' with { type: 'json' };
const key = 'commander-archive.collection.v1';
const deck = {...seed[0], id:'987001', name:'Shared Commander'};
const source = {key:'folder:42',kind:'folder',value:'42',name:'Public shelf',url:'https://archidekt.com/folders/42',checkedAt:new Date().toISOString(),entries:[{id:deck.id,name:deck.name,image:deck.commanders[0].art,colors:deck.colors}],knownIds:[deck.id]};
const saved = JSON.stringify({version:1,hidden:[],excluded:[],added:[seed[1]],manualIds:[seed[1].id]});

// Kept and recently viewed shared shelves (#24): the header switcher and Library list.
async function setup(page: Page) {
  let fetches = 0;
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,saved);},{key,saved});
  await page.route('**/api/source-folders?*', route => { fetches++; return route.fulfill({json:{name:source.name,folders:[{source,path:source.name,root:true}]}}); });
  await page.route('**/api/decks/987001', route => route.fulfill({json:deck}));
  await page.goto('/f/42');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  // Development's StrictMode may fetch twice on first load; count only fetches after it.
  const loaded = fetches;
  return { fetches: () => fetches - loaded };
}
const personal = (page: Page) => page.evaluate(key=>localStorage.getItem(key),key);
// The header menu's Mine row is the way back from someone else's shelf.
async function toMine(page: import('@playwright/test').Page) {
  await page.getByRole('button',{name:/^Showing .*, read-only\. Switch collection$/}).click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Mine/}).click();
}
// On a friend's shelf, its own row leads the menu with the bookmark toggle.
async function bookmarkFromMenu(page: Page) {
  await page.getByRole('button',{name:/^Showing .*, read-only\. Switch collection$/}).click();
  const row = page.getByRole('group',{name:'Collections'}).getByRole('listitem').first();
  await row.getByRole('button',{name:/^Bookmark /}).click();
  await expect(row.getByRole('button',{name:/^Remove the bookmark/})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
}

test('a kept shelf returns from the header switcher, offline, with its search', async ({page}) => {
  const {fetches} = await setup(page);
  await page.getByLabel('Search decks').fill('Shared');
  await bookmarkFromMenu(page);
  await toMine(page);
  await expect(page).toHaveURL('/');
  await expect(page.getByLabel('Search decks')).toHaveValue('');
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Public shelf/}).click();
  await expect(page).toHaveURL('/f/42');
  await expect(page.getByLabel('Search decks')).toHaveValue('Shared');
  expect(fetches()).toBe(0);
  // A kept snapshot opens after a reload without the upstream source.
  await page.route('**/api/**', route => route.fulfill({status:503,json:{error:'Offline.'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Public shelf/}).click();
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'}).click();
  await page.getByRole('button',{name:'Remove the bookmark for Public shelf'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('deckshelf.kept-shelves.v1'))).toBe('[]');
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

test('a viewed shelf is in the switcher and Library until kept or removed', async ({page}) => {
  const {fetches} = await setup(page);
  await toMine(page);
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  const menu = page.getByRole('group',{name:'Collections'});
  await expect(menu.getByText('Recently viewed')).toBeVisible();
  await expect(menu.getByRole('button',{name:/^Public shelf/})).toContainText('1 deck');
  await menu.getByRole('button',{name:/^Public shelf/}).click();
  await expect(page).toHaveURL('/f/42');
  expect(fetches()).toBe(0);
  await bookmarkFromMenu(page);
  await toMine(page);
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await expect(page.getByRole('region',{name:'Other collections',exact:true}).getByText('Archidekt folder · 1 deck · Bookmarked')).toBeVisible();
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  await expect(menu.getByRole('button',{name:'Remove the bookmark for Public shelf'})).toBeVisible();
  await expect(menu.getByText('Recently viewed')).toHaveCount(0);
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

test('the menu is only for moving around, and bookmarking from it stays on the page', async ({page}) => {
  await setup(page);
  await toMine(page);
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  const menu = page.getByRole('group',{name:'Collections'});
  for (const name of ['Share','Save to mine','Keep','Show bar']) await expect(menu.getByRole('button',{name,exact:true})).toHaveCount(0);
  await menu.getByRole('button',{name:'Bookmark Public shelf',exact:true}).click();
  await expect(menu.getByRole('button',{name:'Remove the bookmark for Public shelf',exact:true})).toBeVisible();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('deckshelf.kept-shelves.v1')!).map((shelf: {source:{name:string}})=>shelf.source.name))).toEqual(['Public shelf']);
  await menu.getByRole('button',{name:'Remove the bookmark for Public shelf',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('deckshelf.kept-shelves.v1'))).toBe('[]');
  await expect(menu.getByRole('button',{name:/^Public shelf/})).toBeVisible();
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

for (const [width,height] of [[1920,1080],[390,844]]) test(`the switcher menu fits the page at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height});
  await setup(page);
  await page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'}).click();
  const menu = await page.getByRole('group',{name:'Collections'}).boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

// Open a collection (#128): a fresh profile gets there from the header, with no share link.
test('a typed username opens read-only from the switcher and adds nothing', async ({page}) => {
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,saved);},{key,saved});
  const asked: string[] = [];
  await page.route('**/api/source-folders?*', route => { asked.push(new URL(route.request().url()).search); return route.fulfill({json:{name:source.name,folders:[{source,path:source.name,root:true}]}}); });
  await page.route('**/api/decks/987001', route => route.fulfill({json:deck}));
  await page.goto('/');
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  await page.getByRole('button',{name:'Open a collection…',exact:true}).click();
  const field = page.getByLabel('Open a collection');
  await field.fill('https://archidekt.com/decks/123/one');
  await page.getByRole('button',{name:'Open this collection'}).click();
  await expect(page.getByRole('alert').filter({hasText:'single deck'})).toBeVisible();
  await expect(page).toHaveURL('/');
  await field.fill('Some.Friend');
  await field.press('Enter');
  await expect(page).toHaveURL('/u/Some.Friend');
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  expect(asked.some(search => search.includes('value=Some.Friend'))).toBe(true);
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
  await page.goBack();
  await expect(page).toHaveURL('/');
});

// A friend's shelf has the same controls as yours (#128). The choices are remembered per friend and never reach your collection.
test('a friend\'s folders switch like yours, on this device only', async ({page}) => {
  const second = {...seed[3], id:'987002', name:'Second Commander'};
  const folder = {...source,key:'folder:43',value:'43',name:'Second',url:'https://archidekt.com/folders/43',entries:[{id:second.id,name:second.name,image:second.commanders[0].art,colors:second.colors}],knownIds:[second.id]};
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,saved);},{key,saved});
  await page.route('**/api/source-folders?*', route => route.fulfill({json:{name:source.name,folders:[{source,path:source.name,root:true},{source:folder,path:'Public shelf / Second',root:false}]}}));
  await page.route('**/api/decks/987001', route => route.fulfill({json:deck}));
  await page.route('**/api/decks/987002', route => route.fulfill({json:second}));
  await page.goto('/f/42');
  const friend = page.getByRole('button',{name:'View Second Commander',exact:true});
  await expect(friend).toBeVisible();
  await page.getByRole('button',{name:'Public shelf library',exact:true}).click();
  const workspace = page.getByRole('main',{name:'Public shelf library'});
  await expect(workspace.getByRole('button',{name:'Add decks'})).toHaveCount(0);
  await workspace.getByRole('switch',{name:'Enable Second in sidebar',exact:true}).click();
  await workspace.getByRole('button',{name:'Back to Public shelf',exact:true}).click();
  await expect(friend).toHaveCount(0);
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  await expect(page.locator('.result-count')).toHaveText('1 deck');
  await expect(page.getByRole('button',{name:'Public shelf library',exact:true})).toContainText('1');
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
  await page.reload();
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  await expect(friend).toHaveCount(0);
  // Save to mine takes what's on.
  await page.getByRole('button',{name:'Public shelf library',exact:true}).click();
  await page.getByRole('button',{name:'Save to my library',exact:true}).click();
  await expect(page.getByRole('button',{name:'Saved to my library',exact:true})).toBeDisabled();
  const mine = JSON.parse((await personal(page))!);
  expect(mine.added.map((item: {id:string})=>item.id)).toContain('987001');
  expect(mine.added.map((item: {id:string})=>item.id)).not.toContain('987002');
  // The folders view's heading matches yours: its way back returns to the shelf it came from.
  await page.getByRole('button',{name:'Public shelf library',exact:true}).click();
  await workspace.getByRole('button',{name:'Back to Public shelf',exact:true}).click();
  await expect(workspace).toHaveCount(0);
  await expect(page).toHaveURL('/f/42');
});

// A friend's shelf keeps its header quiet (#128): the menu leads with that shelf, and Bookmark,
// Share and Save to mine sit on its folders page too.
test('the menu leads with this shelf and its folders page holds the actions', async ({page}) => {
  await setup(page);
  await page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'}).click();
  const menu = page.getByRole('group',{name:'Collections'});
  await expect(menu.getByRole('listitem').first()).toContainText('Public shelf1 deck · Read-only');
  await menu.getByRole('button',{name:'Bookmark Public shelf',exact:true}).click();
  await expect(menu.getByRole('button',{name:'Remove the bookmark for Public shelf',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'})).toBeFocused();
  // The header names their shelf once, by the menu; the collection button says Library.
  const library = page.getByRole('button',{name:'Public shelf library',exact:true});
  await expect(library).toContainText('Library');
  await expect(library).not.toContainText('Public shelf');
  await library.click();
  // Bookmark is a toggle: it stays in reach once pressed, so the bookmark can come off again.
  const bookmark = page.getByRole('button',{name:'Bookmark this collection',exact:true});
  await expect(bookmark).toHaveAttribute('aria-pressed','true');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>localStorage.getItem('deckshelf.kept-shelves.v1'))).toBe('[]');
  await expect(page.getByRole('button',{name:'Save to my library',exact:true})).toBeEnabled();
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
  // Back on your own shelf the button reads Library.
  await page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'}).click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Mine/}).click();
  await expect(page.getByRole('button',{name:'Library',exact:true})).toContainText('Library');
});

// The collections menu is a people icon right after the wordmark (#128, option D).
test('the people icon by the logo stays put and names someone else\'s shelf after it', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  const menu = page.getByRole('button',{name:'Showing Public shelf, read-only. Switch collection'});
  await expect(menu).toHaveText('Public shelf');
  const iconAt = () => menu.locator('svg').evaluate(icon => Math.round(icon.getBoundingClientRect().left));
  const friendAt = await iconAt();
  // Their name shows once, by the menu; on a phone the library button keeps only the icon and count.
  const library = page.getByRole('button',{name:'Public shelf library',exact:true});
  await expect(library).not.toContainText('Public shelf');
  await expect(library.getByText('Library',{exact:true})).toBeHidden();
  await menu.click();
  await page.getByRole('group',{name:'Collections'}).getByRole('button',{name:/^Mine/}).click();
  const mine = page.getByRole('button',{name:'Showing Mine. Switch collection'});
  await expect(mine).toHaveText('');
  expect(await mine.locator('svg').evaluate(icon => Math.round(icon.getBoundingClientRect().left))).toBe(friendAt);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

// #129: Firefox painted the results toolbar (Choose a few) over the open menu.
test('the collection menu paints above the results toolbar', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await setup(page);
  await expect(page.getByRole('button',{name:'Choose a few'})).toBeVisible();
  await page.getByRole('button',{name:/^Showing .*, read-only\. Switch collection$/}).click();
  const covered = await page.getByRole('group',{name:'Collections'}).evaluate(menu => {
    const box = menu.getBoundingClientRect(); const out: string[] = [];
    for (let y = box.top + 4; y < box.bottom - 2; y += 8) for (let x = box.left + 4; x < box.right - 2; x += 16) {
      const hit = document.elementFromPoint(x, y);
      if (hit && !menu.contains(hit)) out.push(`${hit.tagName}.${hit.className}`);
    }
    return [...new Set(out)];
  });
  expect(covered).toEqual([]);
});
