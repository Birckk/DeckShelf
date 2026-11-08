import { test, expect } from '@playwright/test';
import seed from '../fixtures/collection-decks.json' with { type: 'json' };

const modern = seed.slice(1, 3).map((deck, i) => ({ ...deck, id: String(983002 + i), name: `Modern ${i + 1}`, format: { id: 'modern', name: 'Modern', sourceId: 2 }, commanders: [], cover: { ...deck.commanders[0], kind: 'featured' } }));
const fallback = { ...seed[3], id: '983004', name: 'Unknown cover', format: { id: 'unknown-99', name: 'Unknown (99)', sourceId: 99 }, commanders: [], cover: { kind: 'fallback', name: 'No cover selected', image: '', art: '', artist: '' } };
const decks = [seed[0], ...modern, fallback];

test('shuffle preserves format scope, featured/fallback covers and Settings card backs', async ({ page }) => {
  await page.addInitScript(decks => localStorage.setItem('commander-archive.collection.v1', JSON.stringify({ version: 1, hidden: [], excluded: [], added: decks, manualIds: decks.map(d => d.id) })), decks);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/help/settings');
  // Settings sections fold; open the two this test changes.
  for (const name of [/^Card backs/, /^Artwork/]) {
    const row = page.getByRole('button', { name });
    if (await row.getAttribute('aria-expanded') === 'false') await row.click();
  }
  await page.getByRole('radio', { name: 'Art deco wedges' }).check();
  await page.getByRole('checkbox', { name: /Show card backs instead of artwork/ }).check();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Format', { exact: true }).selectOption('modern');
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByLabel('Pick format', { exact: true })).toHaveValue('modern');
  await page.getByLabel('Picker', { exact: true }).selectOption('shuffle');
  const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
  await expect(picker.locator('.gather-card')).toHaveCount(2);
  await expect(picker.locator('.gather-card [data-card-back="wedges"]')).toHaveCount(2);
  await picker.getByRole('radio', { name: '2 players' }).click();
  await picker.getByRole('button', { name: 'Pick 2 decks', exact: true }).click();
  await expect(picker.locator('.shuffle-front [data-card-back="wedges"]')).toHaveCount(2);
  await expect(picker.locator('.shuffle-front img')).toHaveCount(0);
  expect((await picker.locator('.shuffle-caption > span:first-child').allTextContents()).sort()).toEqual(['Modern 1', 'Modern 2']);
  await page.getByLabel('Pick format', { exact: true }).selectOption('unknown-99');
  await expect(picker.getByRole('radio', { name: '2 players' })).toBeDisabled();
  await picker.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(picker.getByRole('button', { name: 'View winning deck Unknown cover', exact: true })).toBeVisible();
  await expect(picker.locator('.shuffle-front [data-card-back="wedges"]')).toHaveCount(1);
});
