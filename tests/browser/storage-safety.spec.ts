import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
import fs from 'node:fs';

const key = 'commander-archive.collection.v1';
const first = {...seed[0], id:'987101', name:'First tab deck'};
const second = {...seed[1], id:'987102', name:'Second tab deck'};
const entries = [first, second].map(d => ({id:d.id,name:d.name,image:d.commanders[0].art,colors:d.colors}));
const source = {key:'folder:42',kind:'folder',value:'42',name:'Personal shelf',url:'https://archidekt.com/folders/42',checkedAt:new Date().toISOString(),entries,knownIds:[first.id,second.id],selectedIds:[first.id,second.id],ownedIds:[first.id,second.id]};
const saved = {version:1,starter:false,added:[first,second],hidden:[],excluded:[],sources:[source],manualIds:[]};

async function open(page: Page) {
  await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(saved));},{key,saved});
  await page.goto('/');
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await page.getByRole('navigation',{name:'Collection sources'}).getByRole('button',{name:'Personal shelf',exact:true}).click();
}
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources[0].selectedIds, key);

test('two open tabs build on each other\'s changes instead of overwriting them (#155)', async ({page,context}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  await page.getByRole('checkbox',{name:'Show First tab deck',exact:true}).uncheck();
  await expect.poll(() => stored(page)).toEqual([second.id]);
  // The other tab still shows its own earlier copy until it hears about the save.
  await expect(other.getByRole('checkbox',{name:'Show First tab deck',exact:true})).not.toBeChecked();
  await other.getByRole('checkbox',{name:'Show Second tab deck',exact:true}).uncheck();
  await expect.poll(() => stored(other)).toEqual([]);
  await expect(page.getByRole('checkbox',{name:'Show Second tab deck',exact:true})).not.toBeChecked();
  await page.reload();
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await page.getByRole('navigation',{name:'Collection sources'}).getByRole('button',{name:'Personal shelf',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Show First tab deck',exact:true})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Show Second tab deck',exact:true})).not.toBeChecked();
});

test('a crash shows a recovery screen whose backup holds the saved collection (#156)', async ({page}) => {
  await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key,saved});
  await page.goto('/?crash-test');
  const heading = page.getByRole('heading',{name:'DeckShelf stopped working'});
  await expect(heading).toBeFocused();
  await expect(page.getByText('Your collection is still saved in this browser.')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Reload',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  const exportButton = page.getByRole('button',{name:'Export backup',exact:true});
  await expect(exportButton).toBeFocused();
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toBe('deckshelf-collection.json');
  const backup = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(backup.version).toBe(1);
  expect(backup.added.map((d: {id:string}) => d.id)).toEqual([first.id, second.id]);
  await expect(page.getByRole('status')).toHaveText('Downloaded. Keep the file until DeckShelf works again.');
});

test('the crash screen keeps damaged data as it is and offers no backup when nothing is saved', async ({page}) => {
  await page.addInitScript(key=>localStorage.setItem(key,'{"version":1,"added":'),key);
  await page.goto('/?crash-test');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button',{name:'Download recovery data',exact:true}).click()]);
  expect(download.suggestedFilename()).toBe('deckshelf-recovery-data.json');
  expect(fs.readFileSync((await download.path())!, 'utf8')).toBe('{"version":1,"added":');
  await page.evaluate(()=>localStorage.clear());
  await page.addInitScript(()=>localStorage.clear());
  await page.reload();
  await expect(page.getByText('No saved collection was found in this browser.')).toBeVisible();
  await expect(page.getByRole('button',{name:/Export backup|Download recovery data/})).toHaveCount(0);
});
