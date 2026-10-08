import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };

const first = { ...seed[0], id: '987001', name: 'A deck with a long name for a narrow screen', tags: [], theme: '', description: '' };
const second = { ...seed[1], id: '987002', name: 'Partner deck', commanders: [seed[0].commanders[0], seed[1].commanders[0]] };
const key = 'commander-archive.collection.v1';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ first, second, key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, starter: false, hidden: [], excluded: [second.id], added: [first, second], manualIds: [first.id, second.id] }));
  }, { first, second, key });
  await page.goto('/');
});

test('dialog keeps keyboard focus, closes with Escape, and restores the deck trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: `View ${first.name}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Deck details', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Deck details', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: /View deck on/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Refresh snapshot' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: /View deck on/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.click({ position: { x: 1, y: 1 } });
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});

test('Guide focuses every changed page including Back to page one', async ({ page }) => {
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find tonight’s deck' })).toBeFocused();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bring your decks' })).toBeFocused();
});

test('late refresh failure stays with its deck and preserves saved choices', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/decks/${first.id}?refresh=1`, async route => {
    await pending;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Source unavailable.' }) });
  });
  await page.getByRole('button', { name: `View ${first.name}`, exact: true }).click();
  const request = page.waitForRequest(`**/api/decks/${first.id}?refresh=1`);
  await page.getByRole('button', { name: 'Refresh snapshot' }).click();
  await request;
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: `View ${second.name}`, exact: true }).click();
  release();
  await expect(page.getByRole('button', { name: 'Refresh snapshot' })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.excluded).toEqual([second.id]);
  expect(saved.added).toEqual([first, second]);
});

test('failed refresh reports recovery without replacing the saved deck', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`**/api/decks/${first.id}?refresh=1`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Source unavailable.' }),
  }));
  await page.getByRole('button', { name: `View ${first.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Refresh snapshot' }).click();
  await expect(page.getByRole('alert')).toHaveText('Source unavailable. Your saved deck is unchanged.');
  await expect(page.getByRole('button', { name: 'Refresh snapshot' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: first.name, exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).added, key)).toEqual([first, second]);
});

for (const width of [1440, 390, 320]) {
  test(`details and shared dialogs fit ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const deck of [first, second]) {
      await page.getByRole('button', { name: `View ${deck.name}`, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(dialog.getByRole('link', { name: /View deck on/ })).toHaveAttribute('href', deck.sourceUrl);
      await expect(dialog.getByRole('link', { name: /View deck on/ })).toHaveAttribute('rel', 'noreferrer');
      await page.screenshot({ path: `qa/dialogs/deck-${deck.id}-${width}.png` });
      await dialog.getByRole('button', { name: 'Refresh snapshot' }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole('button', { name: 'Refresh snapshot' })).toBeInViewport();
      await page.keyboard.press('Escape');
    }
    for (const name of ['Help and about DeckShelf', 'Guide']) {
      await page.getByRole('button', { name, exact: name !== 'My collection' }).click();
      await expect.poll(() => page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect.poll(() => page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
    }
  });
}
