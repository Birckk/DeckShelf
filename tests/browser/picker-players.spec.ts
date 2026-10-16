import { test, expect } from '@playwright/test';

test('picks one distinct deck per player, remembers the count and respects the pool', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Players' }).getByRole('radio', { name: '3 players' }).click();
  await page.getByRole('button', { name: 'Pick 3 decks', exact: true }).click();
  const seats = page.locator('.reveal-seat');
  await expect(seats).toHaveCount(3);
  await expect(seats.locator('.seat-label')).toHaveText(['Player 1', 'Player 2', 'Player 3']);
  const names = await page.getByRole('button', { name: /^View Player \d's deck / }).evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')!.replace(/^View Player \d's deck /, '')));
  expect(new Set(names).size).toBe(3);
  await expect(page.getByRole('button', { name: 'Pick again', exact: true })).toBeEnabled();

  await page.reload();
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByRole('radio', { name: '3 players' })).toBeChecked();

  // One matching deck: larger counts are unavailable and the note says why.
  await page.getByPlaceholder(/^Search/).fill('Temur Roar');
  await expect(page.getByRole('radio', { name: '2 players' })).toBeDisabled();
  await expect(page.getByText('Only 1 deck matches, so this picks 1.')).toBeVisible();
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).last().click();
  await expect(page.getByRole('button', { name: /^View winning deck / })).toBeVisible();
  await page.getByPlaceholder(/^Search/).fill('');
  await expect(page.getByRole('radio', { name: '3 players' })).toBeChecked();
});
