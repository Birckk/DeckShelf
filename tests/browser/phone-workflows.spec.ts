import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
import precons from '../../src/data/precons.json' with { type: 'json' };
import folderFixture from '../fixtures/collection-folders.json' with { type: 'json' };
import deckFixture from '../fixtures/collection-decks.json' with { type: 'json' };
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

// #45: touch workflows outside the separately maintained manager layout and picker.
const phoneSizes = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 844, height: 390 },
];
const reviewSizes = [...phoneSizes, { width: 1920, height: 1080 }, { width: 1500, height: 900 }];

for (const viewport of reviewSizes) test.describe(`owner phone pre-pass ${viewport.width}x${viewport.height}`, () => {
  const touch = viewport.width < 1000;
  test.use({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, reducedMotion: 'reduce' });

  async function fits(page: import('@playwright/test').Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
  async function target(locator: import('@playwright/test').Locator) {
    if (touch) {
      const box = (await locator.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(40);
    }
  }
  async function shot(page: import('@playwright/test').Page, view: string) {
    await fits(page);
    if (process.env.PHONE_SHOTS) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].filter(img => {
          const r = img.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight && !img.complete;
        }).map(img => new Promise<void>(resolve => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 2000);
        })));
      });
      await page.screenshot({ path: `.codex-shots/${viewport.width}x${viewport.height}-${view}.png` });
    }
  }
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ key, fixture }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    }, { key, fixture });
  });

  test('username discovery, folder and individual choices import through touch-sized controls', async ({ page }) => {
    await page.route('**/api/source-folders?*', route => route.fulfill({ json: folderFixture }));
    await page.route('**/api/decks/*', route => route.fulfill({ json: deckFixture.find(d => d.id === new URL(route.request().url()).pathname.split('/').pop()) }));
    await page.goto('/');
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    await page.getByRole('button', { name: 'Add decks', exact: true }).click();
    await page.locator('#collection-source-input').fill('Birckk');
    await shot(page, 'add-username');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Which folders do you want to show?' })).toBeFocused();
    await shot(page, 'add-folders');
    await target(page.getByRole('button', { name: 'Change source', exact: true }));
    await target(page.getByRole('button', { name: 'Select all', exact: true }));
    await target(page.getByRole('button', { name: 'Clear', exact: true }));
    const firstFolder = page.locator('.source-folder').first();
    const summary = firstFolder.locator('summary');
    await target(summary);
    await summary.click();
    const individual = firstFolder.locator('.source-folder-decks input').first();
    await individual.check();
    await expect(individual).toBeChecked();
    const nextFolder = page.locator('.source-folder-choice input').nth(1);
    await nextFolder.check();
    await expect(individual).toBeChecked();
    await expect(page.getByRole('button', { name: 'Add 6 decks', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Select all', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add 30 decks', exact: true })).toBeEnabled();
    await shot(page, 'add-selected');
    await page.getByRole('button', { name: 'Add 30 decks', exact: true }).click();
    await expect(page.locator('.workspace-heading')).toContainText('30 on display');
    // The heading can render before React's passive effect persists the collection.
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sources.length, key))
      .toBe(fixture.sources.length + folderFixture.folders.length);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(saved.sources).toHaveLength(fixture.sources.length + folderFixture.folders.length);
    for (const folder of folderFixture.folders) {
      expect(saved.sources.find((s: { key: string }) => s.key === folder.source.key).selectedIds).toEqual(folder.source.knownIds);
    }
    await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
    await expect(page.locator('.result-count')).toContainText('30 decks');
    await fits(page);
  });

  test('long details scroll independently, keep close reachable, and restore focus and page scrolling', async ({ page, browserName }) => {
    const long = { ...decks[0], description: 'Long Commander description with a card reference [[Sol Ring]]. '.repeat(120) + 'End of the saved description.' };
    await page.addInitScript(({ key, long }) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.added[0] = long;
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key, long });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: `View ${long.name}`, exact: true });
    // WebKit pointer clicks need not focus buttons; use keyboard activation to test focus restoration.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Deck details', exact: true });
    await shot(page, 'details-top');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const link = dialog.getByRole('link', { name: /View deck on/ });
    await expect(link).toBeInViewport({ ratio: 1 });
    await expect(link).toHaveAttribute('href', long.url);
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport({ ratio: 1 });
    await shot(page, 'details-bottom');
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Refresh snapshot' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    // WebKit skips links and returns to the last tag button (or Close when there are no tags).
    const previousButton = long.tags.length
      ? dialog.getByRole('group', { name: 'Tags', exact: true }).getByRole('button').last()
      : dialog.getByRole('button', { name: 'Close dialog' });
    await expect(browserName === 'webkit' ? previousButton : link).toBeFocused();
    await trigger.focus();
    await expect(trigger).not.toBeFocused();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('large catalogue Cards, List and Details stay navigable', async ({ page, browserName }) => {
    await page.addInitScript(({ key, catalogue }) => localStorage.setItem(key, JSON.stringify({ version: 1, starter: false, added: catalogue, manualIds: catalogue.map(d => d.id), hidden: [], excluded: [] })), { key, catalogue: precons.decks });
    await page.goto('/');
    await expect(page.locator('.result-count')).toContainText('184 decks');
    for (const layout of ['List', 'Details']) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      await shot(page, `gallery-${layout.toLowerCase()}`);
      const last = page.locator('.collection-tile').last().getByRole('button', { name: /^View / });
      await last.scrollIntoViewIfNeeded();
      await last.click();
      await expect(page.getByRole('dialog', { name: 'Deck details' })).toBeVisible();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await page.evaluate(() => scrollTo(0, 0));
    }
    await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Cards', exact: true }).click();
    const carousel = page.getByRole('region', { name: /card carousel/ });
    await shot(page, 'cards');
    await target(page.locator('.studio-caption > button'));
    await target(page.getByRole('button', { name: 'Previous deck', exact: true }));
    await target(page.getByRole('button', { name: 'Next deck', exact: true }));
    await page.getByRole('button', { name: 'Next deck', exact: true }).click();
    await expect(page.locator('.studio-pagination')).toContainText('02 / 184');
    await page.getByRole('button', { name: 'Previous deck', exact: true }).click();
    await expect(page.locator('.studio-pagination')).toContainText('01 / 184');
    // Native touch swipes need Chromium's DevTools protocol; other engines keep the button and key checks.
    if (touch && browserName === 'chromium') {
      await carousel.locator('.studio-stage').scrollIntoViewIfNeeded();
      const box = (await carousel.locator('.studio-card.is-current').boundingBox())!;
      const client = await page.context().newCDPSession(page);
      const x = box.x + box.width / 2, y = Math.max(20, box.y) + 30;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const dx of [15, 35, 65]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - dx, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.locator('.studio-pagination')).toContainText('02 / 184');
      await client.detach();
    }
    await carousel.locator('.studio-card.is-current').focus();
    await page.keyboard.press('End');
    await expect(page.locator('.studio-pagination')).toContainText('184 / 184');
    await page.locator('.studio-caption > button').click();
    await expect(page.getByRole('dialog', { name: 'Deck details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await fits(page);
  });

  test('Help navigation and guide work with touch targets and no horizontal overflow', async ({ page }) => {
    await page.goto('/help/start');
    await shot(page, 'help-start');
    await target(page.getByRole('button', { name: 'Back to collection', exact: true }));
    for (const step of [2, 3]) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByLabel(`Page ${step} of 3`)).toBeVisible();
      await shot(page, `help-guide-${step}`);
    }
    if (viewport.width <= 760) await page.locator('.help-mobile-toggle').click();
    const nav = page.getByRole('navigation', { name: 'Help sections' });
    for (const action of await nav.locator('a,button').all()) await target(action);
    await shot(page, 'help-navigation');
    await nav.getByRole('button', { name: 'Collapse Core' }).click();
    await expect(nav.getByRole('link', { name: 'Adding your decks', exact: true })).toHaveCount(0);
    await nav.getByRole('button', { name: 'Expand Core' }).click();
    await nav.getByRole('link', { name: 'Adding your decks', exact: true }).click();
    await expect(page).toHaveURL(/\/help\/adding$/);
    if (viewport.width <= 760) await expect(nav).toBeHidden();
    await target(page.locator('.help-crumb'));
    for (const section of ['adding', 'showing', 'updates', 'picking', 'saving', 'core', 'faq', 'features', 'roadmap', 'about', 'project']) {
      await page.goto(`/help/${section}`);
      await shot(page, `help-${section}`);
    }
    await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('backup download bytes restore only after confirmation and cancel keeps saved choices', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'My collection', exact: true }).click();
    const exportButton = page.getByRole('button', { name: 'Export backup', exact: true });
    const restoreButton = page.getByRole('button', { name: 'Restore backup', exact: true });
    await exportButton.scrollIntoViewIfNeeded();
    await target(exportButton);
    await target(restoreButton);
    const pending = page.waitForEvent('download');
    await exportButton.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('deckshelf-collection.json');
    const stream = (await download.createReadStream())!;
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const exported = JSON.parse(buffer.toString());
    expect(exported.version).toBe(1);
    expect(exported.sources).toEqual(fixture.sources);
    const saved = await page.evaluate(key => localStorage.getItem(key), key);
    async function chooseBackup() {
      const chooser = page.waitForEvent('filechooser');
      await restoreButton.click();
      await (await chooser).setFiles({ name: 'deckshelf-collection.json', mimeType: 'application/json', buffer });
    }
    await chooseBackup();
    const region = page.getByRole('region', { name: 'Restore collection backup' });
    await expect(region).toBeFocused();
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Restore this backup', exact: true })).toBeInViewport({ ratio: 1 });
    await target(page.getByRole('button', { name: 'Cancel restore' }));
    await shot(page, 'backup-confirmation');
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
    await page.getByRole('button', { name: 'Cancel restore' }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
    await chooseBackup();
    await expect(region).toBeFocused();
    await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
    await expect(region).toHaveCount(0);
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    expect(restored).toEqual(exported);
    await fits(page);
  });
});
