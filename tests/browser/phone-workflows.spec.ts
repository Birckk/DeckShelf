import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 4);
const sources = [0, 1].map(i => ({
  key: `folder:${42 + i}`, kind: 'folder', value: String(42 + i), name: i ? 'Multicolor' : 'Mono-color',
  url: `https://archidekt.com/folders/${42 + i}`, checkedAt: '2026-10-04T12:00:00Z',
  knownIds: decks.map(d => d.id), selectedIds: decks.map(d => d.id),
  entries: decks.map(d => ({ id: d.id, name: d.name, image: d.commanders[0].art, colors: d.colors })),
  folderPath: 'Home / Test collection / ' + (i ? 'Multicolor' : 'Mono-color'),
  connectionKey: 'account:test', connectionName: 'Test account',
}));
const fixture = { version: 1, starter: false, added: decks, hidden: [], excluded: [], sources, manualIds: [] };
for (const width of [320, 390, 800, 1440]) {
  test(`collection captions and folder actions fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ key, fixture }) => { localStorage.setItem(key, JSON.stringify(fixture)); }, { key, fixture });
    await page.goto('/');
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    await page.getByRole('button', { name: 'Open Test account', exact: true }).click();
    const saved = await page.evaluate(key => localStorage.getItem(key), key);
    const actions = page.locator('.manager-toolbar button');
    for (const action of await actions.all()) {
      const box = (await action.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeLessThanOrEqual(34);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const tile = page.locator('.workspace-tile').first();
    const art = (await tile.locator('.workspace-tile-art').boundingBox())!;
    const title = (await tile.locator('h4').boundingBox())!;
    const controls = (await tile.locator('.workspace-tile-controls').boundingBox())!;
    if (art.width <= 180) {
      expect(title.width).toBeGreaterThanOrEqual(art.width - 1);
      expect(controls.y).toBeGreaterThanOrEqual(art.y);
      expect(controls.y + controls.height).toBeLessThanOrEqual(art.y + art.height);
    }
    const link = tile.getByRole('link');
    await link.focus();
    await expect(link).toBeFocused();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
    await page.keyboard.press('Tab');
    const checkbox = tile.getByRole('checkbox');
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.screenshot({ path: `qa/phone/verified-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'More actions for Test account', exact: true }).click();
    await page.getByRole('menuitem', { name: 'All folders off', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Enable Test account folders', exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: 'More actions for Test account', exact: true }).click();
    await page.getByRole('menuitem', { name: 'All folders on', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Enable Test account folders', exact: true })).toBeChecked();
  });
}

for (const width of [320, 390]) test('phone browsing controls form compact groups at ' + width + 'px', async ({page}) => {
  await page.setViewportSize({width,height:900});
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});
  await page.goto('/');
  const count = page.locator('.result-count');
  const trigger = page.getByRole('button',{name:'Choose a few',exact:true});
  // Measure after DM Sans replaces the fallback font, which is narrower.
  await expect(count).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const countBox=(await count.boundingBox())!, entryBox=(await trigger.boundingBox())!;
  expect(Math.abs(countBox.y+countBox.height/2-entryBox.y-entryBox.height/2)).toBeLessThan(2);
  const mode=page.getByRole('button',{name:'Cards only',exact:true});
  expect((await mode.boundingBox())!.height).toBe((await page.getByRole('button',{name:'Details',exact:true}).boundingBox())!.height);
  const size=page.getByRole('slider',{name:'Collection item size'}), sort=page.getByRole('combobox',{name:'Sort decks'});
  await expect(size).toBeHidden();
  expect((await page.locator('.collection-display-toolbar').boundingBox())!.y).toBeLessThan(180);
  await page.getByRole('button',{name:'Size and sort',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(size).toBeVisible();
  const sizeBox=(await size.boundingBox())!, sortBox=(await sort.boundingBox())!;
  expect(Math.abs(sizeBox.y+sizeBox.height/2-sortBox.y-sortBox.height/2)).toBeLessThan(4);
  await page.getByRole('button',{name:'Size and sort',exact:true}).click();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByRole('button',{name:'Filter White',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region',{name:'More filters'})).toBeHidden();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await expect(page.getByRole('button',{name:'Filter White',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Filter White',exact:true}).click();
  await page.keyboard.press('Escape');
  await trigger.click();
  // Phones right-align quick choice: the group keeps its right edge and close plus entry keep the idle width.
  const close=(await page.getByRole('button',{name:'Clear selection',exact:true}).boundingBox())!, entry=(await page.getByRole('button',{name:'Select cards',exact:true}).boundingBox())!;
  const group=(await page.getByRole('group',{name:'Quick deck choice'}).boundingBox())!;
  const row=(await page.locator('.results-toolbar').boundingBox())!;
  expect(group.x+group.width).toBeCloseTo(row.x+row.width,0);
  expect(entry.x+entry.width-close.x).toBeCloseTo(entryBox.width,0);
  expect(close.x).toBeGreaterThan(countBox.x+countBox.width);
  await page.getByRole('button',{name:/^Select .* /}).first().click();
  await page.evaluate(()=>scrollTo(0,0));
  const heights=await page.getByRole('group',{name:'Quick deck choice'}).getByRole('button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect()).map(r=>[Math.round(r.y),Math.round(r.height)]));
  expect(new Set(heights.map(h=>h.join())).size).toBe(1);
  expect(await count.boundingBox()).toEqual(countBox);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await page.getByRole('button',{name:'Open Test account',exact:true}).click();
  // Pill, Only this and the More menu share one row; the rarer actions wait in the menu.
  const more=page.getByRole('button',{name:'More actions for Test account',exact:true});
  const pill=page.locator('.manager-toolbar .overview-switch');
  expect(Math.abs((await more.boundingBox())!.y-(await pill.boundingBox())!.y)).toBeLessThan(12);
  expect((await page.locator('.workspace-display-controls').boundingBox())!.height).toBeLessThan(95);
  await more.click();
  await expect(page.getByRole('menuitem',{name:'Hide',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

for (const width of [320, 1440]) test(`restore confirmation comes into view and takes focus at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:740});
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});
  await page.goto('/');
  await page.getByRole('button',{name:'My collection',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  const region=page.getByRole('region',{name:'Restore collection backup'});
  await expect(region).toBeFocused();
  await expect(page.getByRole('button',{name:'Restore this backup',exact:true})).toBeInViewport({ratio:1});
});

for (const width of [320, 1440]) test(`picker motion controls sit under the pick button at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:740});
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});
  await page.goto('/');
  await page.getByRole('group',{name:'Collection view'}).getByRole('button',{name:'Pick a deck',exact:true}).click();
  const motion=page.getByRole('group',{name:'Picker motion'});
  await expect(motion).toHaveCount(1);
  const stage=page.getByRole('region',{name:'Random deck picker'});
  await expect(stage.getByRole('group',{name:'Picker motion'})).toBeVisible();
  const pick=(await stage.getByRole('button',{name:'Pick a deck',exact:true}).boundingBox())!, box=(await motion.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(pick.y+pick.height);
  await expect(motion).toBeInViewport({ratio:1});
  await expect(page.getByRole('button',{name:/drift$/})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Instant pick'})).toBeVisible();
});

for (const width of [320, 390]) test(`a filtered, fully selected quick choice fits without squeezing at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:740});
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});
  await page.goto('/');
  await page.getByRole('textbox',{name:'Search decks'}).fill(decks[0].name.slice(0,4));
  await page.getByRole('button',{name:'Choose a few',exact:true}).click();
  await page.getByRole('button',{name:'Select visible',exact:true}).click();
  await expect(page.getByRole('button',{name:'Deselect visible',exact:true})).toBeVisible();
  const segments=await page.getByRole('group',{name:'Quick deck choice'}).getByRole('button').evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect(), label=el.querySelector('span')||el;
    return {right:r.right,width:r.width,fits:label.scrollWidth<=el.clientWidth};
  }));
  for (const s of segments) { expect(s.width).toBeGreaterThanOrEqual(28); expect(s.fits).toBe(true); expect(s.right).toBeLessThanOrEqual(width-16+1); }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
