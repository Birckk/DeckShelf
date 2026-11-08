import { test, expect, type Page } from '@playwright/test';
import seed from '../fixtures/tagged-decks';

const key = 'commander-archive.collection.v1';
const profile = { version: 1, hidden: [], excluded: [], added: seed, manualIds: seed.map(d => d.id) };
const tagged = (...tags: string[]) => seed.filter(d => tags.every(t => d.tags.includes(t))).length;

async function init(page: Page) {
  await page.addInitScript(({ key, profile }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem('commander-archive.display.v1', JSON.stringify({ layout: 'grid', size: 1 }));
  }, { key, profile });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
}
const count = (page: Page) => page.locator('.result-count');

test('tags in Filters fold to the most used, and several tags narrow together', async ({ page }) => {
  await init(page);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const tags = page.getByRole('group', { name: 'Tags' });
  await expect(tags.locator('.tag-chips button')).toHaveCount(8);
  await tags.getByRole('button', { name: /^All \d+ tags/ }).click();
  expect(await tags.locator('.tag-chips button').count()).toBeGreaterThan(8);
  await tags.getByRole('button', { name: 'Fewer tags' }).click();
  await expect(tags.locator('.tag-chips button')).toHaveCount(8);

  await tags.getByRole('button', { name: /^Tribal/ }).click();
  await expect(count(page)).toHaveText(`${tagged('Tribal')} of ${seed.length} decks`);
  await tags.getByRole('button', { name: /^Tokens/ }).click();
  await expect(count(page)).toHaveText(`${tagged('Tribal', 'Tokens')} of ${seed.length} decks`);
  await expect(tags.getByRole('button', { name: /^Tokens/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.getByRole('button', { name: 'Remove tag Tribal' }).click();
  await expect(count(page)).toHaveText(`${tagged('Tokens')} of ${seed.length} decks`);
});

test('a tag on a deck or in its details filters by that tag', async ({ page }) => {
  await init(page);
  const deck = seed.find(d => d.tags.length > 0)!;
  const tile = page.locator('.collection-tile').filter({ hasText: deck.name });
  await tile.locator('.deck-tags').getByRole('button', { name: deck.tags[0], exact: true }).click();
  await expect(count(page)).toHaveText(`${tagged(deck.tags[0])} of ${seed.length} decks`);

  await tile.locator('.collection-deck-title').click();
  const details = page.getByRole('group', { name: 'Tags' });
  await expect(details.getByRole('button', { name: deck.tags[0] })).toHaveAttribute('aria-pressed', 'true');
  await details.getByRole('button', { name: deck.tags[1] }).click();
  await expect(page.locator('.detail-copy')).toHaveCount(0);
  await expect(count(page)).toHaveText(`${tagged(deck.tags[0], deck.tags[1])} of ${seed.length} decks`);
});

test('more than three active filters fold behind a +N button, and Clear all resets them', async ({ page }) => {
  await init(page);
  await page.getByRole('button', { name: 'Filter White' }).first().click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const tags = page.getByRole('group', { name: 'Tags' });
  for (const tag of ['Tribal', 'Tokens', 'Lifegain']) await tags.getByRole('button', { name: new RegExp(`^${tag}`) }).click();
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();

  const chips = page.getByLabel('Active filters');
  await expect(chips.getByRole('button', { name: '+2 more' })).toBeVisible();
  await expect(chips.getByRole('button', { name: /^Remove tag/ })).toHaveCount(1);
  await chips.getByRole('button', { name: '+2 more' }).click();
  await expect(chips.getByRole('button', { name: /^Remove tag/ })).toHaveCount(3);
  await chips.getByRole('button', { name: 'Fewer' }).click();
  await chips.getByRole('button', { name: 'Clear all' }).click();
  await expect(chips).toHaveCount(0);
  await expect(count(page)).toHaveText(`${seed.length} decks`);
});
