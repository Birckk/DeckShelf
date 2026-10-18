import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
const key = 'commander-archive.collection.v1';
const deck = {...seed[0], id:'987001', name:'Shared Commander'};
const source = {key:'folder:42',kind:'folder',value:'42',name:'Public shelf',url:'https://archidekt.com/folders/42',checkedAt:new Date().toISOString(),entries:[{id:deck.id,name:deck.name,image:deck.commanders[0].art,colors:deck.colors}],knownIds:[deck.id]};
const saved = JSON.stringify({version:1,starter:false,hidden:[],excluded:[],added:[seed[1]],manualIds:[seed[1].id]});

// Kept and recently viewed shared shelves (#24): the header switcher and My collection list.
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

test('a kept shelf returns from the header switcher, offline, with its search', async ({page}) => {
  const {fetches} = await setup(page);
  await page.getByLabel('Search decks').fill('Shared');
  await page.getByRole('button',{name:'Keep as a collection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Kept',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
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
  await page.getByRole('button',{name:'Showing Public shelf. Switch collection'}).click();
  await page.getByRole('button',{name:'Remove Public shelf from the switcher'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('deckshelf.kept-shelves.v1'))).toBe('[]');
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

test('a viewed shelf is in the switcher and My collection until kept or removed', async ({page}) => {
  const {fetches} = await setup(page);
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  const menu = page.getByRole('group',{name:'Collections'});
  await expect(menu.getByText('Viewed · 1 deck')).toBeVisible();
  await menu.getByRole('button',{name:/^Public shelf/}).click();
  await expect(page).toHaveURL('/f/42');
  expect(fetches()).toBe(0);
  await page.getByRole('button',{name:'Keep as a collection',exact:true}).click();
  await page.getByRole('button',{name:'Back to my collection',exact:true}).click();
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await expect(page.getByRole('region',{name:'Recently viewed',exact:true}).getByText('Archidekt folder · 1 deck · Kept')).toBeVisible();
  await page.getByRole('button',{name:'Showing Mine. Switch collection'}).click();
  await expect(menu.getByText('Kept · 1 deck')).toBeVisible();
  await expect(menu.getByText('Recently viewed')).toHaveCount(0);
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

test('the shelf bar hides, and its actions stay in the switcher', async ({page}) => {
  await setup(page);
  const bar = page.getByRole('region',{name:'Shared collection'});
  await expect(bar.getByText('Read-only · 1 public deck')).toBeVisible();
  await bar.getByRole('button',{name:'Hide this bar'}).click();
  await expect(bar).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button',{name:'View Shared Commander',exact:true})).toBeVisible();
  await expect(bar).toHaveCount(0);
  await page.getByRole('button',{name:'Showing Public shelf. Switch collection'}).click();
  const menu = page.getByRole('group',{name:'Collections'});
  await menu.getByRole('button',{name:'Keep',exact:true}).click();
  await page.getByRole('button',{name:'Showing Public shelf. Switch collection'}).click();
  await expect(menu.getByRole('button',{name:'Kept',exact:true})).toBeDisabled();
  await menu.getByRole('button',{name:'Show bar',exact:true}).click();
  await expect(bar.getByRole('button',{name:'Kept',exact:true})).toBeDisabled();
  expect(JSON.parse((await personal(page))!)).toEqual(JSON.parse(saved));
});

for (const [width,height] of [[1920,1080],[390,844]]) test(`the switcher menu fits the page at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height});
  await setup(page);
  await page.getByRole('button',{name:'Showing Public shelf. Switch collection'}).click();
  const menu = await page.getByRole('group',{name:'Collections'}).boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
