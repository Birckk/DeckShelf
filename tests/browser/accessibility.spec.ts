import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import seed from '../fixtures/tagged-decks';

const key = 'commander-archive.collection.v1';
const decks = seed.slice(0, 7);
const source = {
  key: 'folder:42', kind: 'folder', value: '42', name: 'Friday Commander',
  url: 'https://archidekt.com/folders/42', checkedAt: '2026-11-08T12:00:00.000Z',
  entries: decks.map(d => ({ id: d.id, name: d.name, image: d.commanders[0].art, colors: d.colors })),
  knownIds: decks.map(d => d.id), selectedIds: decks.map(d => d.id), ownedIds: decks.map(d => d.id),
};
const profile = {
  version: 1, added: decks, hidden: [], excluded: [decks[6].id], manualIds: [], sources: [source],
};

// Rule-specific exceptions only: all other rules still scan these elements.
// Naming the preview's secondary text in the action label needs an owner decision.
const exceptions = [
  // Library's accessible name omits its supplemental numeric deck-count badge.
  { rule: 'label-content-name-mismatch', selector: '.header-collection' },
  // Offline artwork displays commander names; actions deliberately name the deck.
  { rule: 'label-content-name-mismatch', selector: '.collection-card:has(.art-fallback)' },
  { rule: 'label-content-name-mismatch', selector: '.studio-card:has(.art-fallback)' },
  // Empty preview says "No decks added"; its action names the collection to open.
  { rule: 'label-content-name-mismatch', selector: '.collection-box-cover:has(.collection-box-empty)' },
];

async function scan(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const failures = [];
  for (const violation of violations.filter(v => v.impact === 'serious' || v.impact === 'critical')) {
    const targets = [];
    for (const node of violation.nodes) {
      const selectors = exceptions.filter(e => e.rule === violation.id).map(e => e.selector);
      // Targets in these views are ordinary document selectors, not frame/shadow paths.
      const excepted = selectors.length && node.target.length === 1 && typeof node.target[0] === 'string'
        && await page.locator(node.target[0]).evaluate((element, selectors) => selectors.some(s => element.matches(s)), selectors);
      if (!excepted) targets.push(node.target);
    }
    if (targets.length) failures.push({ id: violation.id, impact: violation.impact, targets });
  }
  expect(failures, 'Serious/critical WCAG A/AA violations (id, impact, target selectors)').toEqual([]);
}

const views = ['Collection grid', 'Collection list', 'Cards', 'Deck details', 'Library overview',
  'Library source', 'Settings', 'Help Start here', 'Help topic', 'Picker', 'Shared shelf'] as const;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px accessibility`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(({ key, profile }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(profile));
      }, { key, profile });
      // Keep external art deterministic and offline, exercising the real card-back fallback.
      await page.route(/\/(images\/|.*cards\.scryfall\.io\/)/, route => route.abort());
      await page.route('**/api/source-folders?*', route => route.fulfill({
        json: { name: source.name, folders: [{ source, path: source.name, root: true }] },
      }));
      await page.route('**/api/decks/*', route => {
        const deck = decks.find(d => route.request().url().endsWith('/' + d.id));
        return route.fulfill({ json: deck });
      });
    });

    for (const view of views) test(view, async ({ page }) => {
      await page.goto(view === 'Shared shelf' ? '/f/42' : '/');
      await expect(page.getByRole('button', { name: `View ${decks[0].name}`, exact: true })).toBeVisible();
      switch (view) {
        case 'Collection grid':
          await page.getByRole('button', { name: 'Details', exact: true }).click();
          await expect(page.locator('.collection-grid')).toBeVisible();
          break;
        case 'Collection list':
          await page.getByRole('button', { name: 'List', exact: true }).click();
          await expect(page.getByRole('table')).toBeVisible();
          break;
        case 'Cards':
        case 'Picker':
          await page.getByRole('group', { name: 'Collection view' })
            .getByRole('button', { name: view === 'Cards' ? 'Cards' : 'Pick a deck', exact: true }).click();
          await expect(page.locator(view === 'Cards' ? '.studio-card' : '.helix-card').first()).toBeVisible();
          break;
        case 'Deck details':
          await page.getByRole('button', { name: `View ${decks[0].name}`, exact: true }).click();
          await expect(page.getByRole('dialog')).toBeVisible();
          break;
        case 'Library overview':
        case 'Library source':
          await page.getByRole('button', { name: 'Library', exact: true }).click();
          await expect(page.getByRole('main', { name: 'Library' })).toBeVisible();
          if (view === 'Library source') {
            await page.getByRole('button', { name: `Open ${source.name}`, exact: true }).click();
            await expect(page.getByRole('checkbox', { name: `Show ${decks[0].name}`, exact: true })).toBeVisible();
          }
          break;
        case 'Settings':
        case 'Help Start here':
        case 'Help topic': {
          const section = view === 'Settings' ? 'settings' : view === 'Help topic' ? 'adding' : 'start';
          await page.goto(`/help/${section}`);
          await expect(page.getByRole('heading', { name: view === 'Settings' ? 'Settings' : view === 'Help topic' ? 'Adding your decks' : 'Start here', exact: true })).toBeVisible();
          if (view === 'Settings') {
            for (const row of await page.locator('.settings-fold > h3 > button').all()) {
              if (await row.getAttribute('aria-expanded') === 'false') await row.click();
            }
          }
          break;
        }
        case 'Shared shelf':
          await expect(page.getByRole('button', { name: `Showing ${source.name}, read-only. Switch collection`, exact: true })).toBeVisible();
          break;
      }
      await scan(page);
    });
  });
}
