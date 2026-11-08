import { test, expect, type Page } from '@playwright/test';

const key = 'commander-archive.collection.v1';
const seen = 'deckshelf.first-visit.seen.v1';
const pill = (page: Page) => page.getByRole('group', { name: 'Quick tour' });
const newButton = (page: Page) => page.getByRole('button', { name: 'New here? Take the quick tour' });
const tour = (page: Page) => page.getByRole('dialog', { name: 'Quick tour' });
const helpButton = (page: Page) => page.getByRole('button', { name: 'Help', exact: true });

test('fresh visit offers once without focus, dismisses with keyboard and stays dismissed', async ({ page }) => {
  await page.goto('/');
  await expect(pill(page)).toBeVisible();
  await expect(newButton(page)).toHaveText('New?');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  expect(await page.evaluate(key => localStorage.getItem(key), seen)).toBe('1');
  await page.getByRole('button', { name: 'Dismiss quick tour' }).focus();
  await page.keyboard.press('Enter');
  await expect(pill(page)).toHaveCount(0);
  // Focus lands on Help, where the tour lives from now on.
  await expect(helpButton(page)).toBeFocused();
  await page.reload();
  await expect(pill(page)).toHaveCount(0);
  // Even removing the generated collection does not bring the offer back.
  await page.evaluate(key => localStorage.removeItem(key), key);
  await page.reload();
  await expect(pill(page)).toHaveCount(0);
});

test('New? opens the tour popup in place; Escape closes it and returns focus to Help', async ({ page }) => {
  await page.goto('/');
  await newButton(page).click();
  await expect(tour(page)).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
  await expect(pill(page)).toHaveCount(0);
  await expect(tour(page).getByRole('heading', { name: 'Bring your decks' })).toBeVisible();
  await tour(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(tour(page).getByRole('heading', { name: 'Find tonight’s deck' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  await expect(helpButton(page)).toBeFocused();
  await page.reload();
  await expect(pill(page)).toHaveCount(0);
});

test('the tour popup closes on an outside click and its last page opens the precons', async ({ page }) => {
  await page.goto('/');
  await newButton(page).click();
  await page.locator('.studio-search input').click();
  await expect(tour(page)).toHaveCount(0);
  // Start a fresh first visit to reach the last page.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await newButton(page).click();
  await tour(page).getByRole('button', { name: 'Next', exact: true }).click();
  await tour(page).getByRole('button', { name: 'Next', exact: true }).click();
  await tour(page).getByRole('button', { name: 'View official precons', exact: true }).click();
  await expect(tour(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to collection', exact: true })).toBeVisible();
});

test('taking the tour through header Help ends the pending invitation', async ({ page }) => {
  await page.goto('/');
  await expect(pill(page)).toBeVisible();
  await helpButton(page).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'View official precons', exact: true }).click();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(pill(page)).toHaveCount(0);
});

test('a fresh Start here deep link never arms an invitation after leaving', async ({ page }) => {
  await page.goto('/help/start');
  await expect(page.getByRole('heading', { name: 'Start here', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(pill(page)).toHaveCount(0);
});

test('the offer waits, disabled, while a pick is spinning', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).last().click();
  await expect(page.locator('.helix-picker')).toHaveClass(/is-spinning/);
  await expect(newButton(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Dismiss quick tour' })).toBeDisabled();
  await expect(helpButton(page)).toBeEnabled({ timeout: 15000 });
  await expect(newButton(page)).toBeEnabled();
});

test('restoring a backup during the first visit ends the invitation', async ({ page }) => {
  await page.goto('/');
  await expect(pill(page)).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const backup = { version: 1, added: [], hidden: [], excluded: [] };
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(pill(page)).toHaveCount(0);
  await page.reload();
  await expect(pill(page)).toHaveCount(0);
});

for (const width of [1920, 1500, 390, 320]) test(`New? sits in the header row and the popup stays inside the gutters at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 500 ? 740 : 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // A new shelf renders once the precon snapshot has loaded.
  await expect(page.locator('.studio-header .brand')).toBeVisible();
  // Everything in the header row sits side by side: logo, offer, Help, Library.
  const row = await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('.studio-header .brand')!);
    const boxes = [range.getBoundingClientRect(), ...[...document.querySelectorAll('.studio-header .header-actions > *')].map(e => e.getBoundingClientRect())];
    return boxes.every((box, i) => i === 0 || box.left >= boxes[i - 1].right);
  });
  expect(row).toBe(true);
  const dismiss = await page.getByRole('button', { name: 'Dismiss quick tour' }).locator('svg').boundingBox();
  expect(dismiss!.width).toBeGreaterThan(8);
  const box = (selector: string) => page.locator(selector).first().boundingBox().then(b => b!);
  const [pillBox, help, header] = [await pill(page).boundingBox(), await box('.help-trigger'), await box('.studio-header')];
  // One small pill beside Help: no row of its own, no overlap with the logo or Help.
  expect(pillBox!.height).toBeLessThanOrEqual(24);
  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(help.x);
  expect(Math.abs((pillBox!.y + pillBox!.height / 2) - (help.y + help.height / 2))).toBeLessThanOrEqual(2);
  expect(pillBox!.y + pillBox!.height).toBeLessThanOrEqual(header.y + header.height);
  await newButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(tour(page)).toBeFocused();
  const tourBox = (await tour(page).boundingBox())!;
  const gutter = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')));
  // Lined up with the header's own gutters, like every other view.
  expect(tourBox.x).toBeGreaterThanOrEqual(header.x + gutter - 1);
  expect(tourBox.x + tourBox.width).toBeLessThanOrEqual(header.x + header.width - gutter + 1);
  expect(tourBox.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(tourBox.y + tourBox.height).toBeLessThanOrEqual(width < 500 ? 740 : 1080);
  // The popup draws above the collection rather than under it.
  const onTop = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.first-visit-tour'), { x: tourBox.x + tourBox.width / 2, y: tourBox.y + tourBox.height - 20 });
  expect(onTop).toBe(true);
  // 320px is the app's minimum width, so WebKit's scrollbar already adds a little sideways scroll there.
  if (width > 320) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

for (const profile of ['saved', 'restored', 'seen', 'corrupt', 'blocked-read', 'blocked-write']) {
  test(`${profile} profile fails closed on every load`, async ({ page }) => {
    await page.addInitScript(({ profile, key, seen }) => {
      if (profile === 'seen') localStorage.setItem(seen, '1');
      if (profile === 'saved' || profile === 'restored') localStorage.setItem(key, JSON.stringify({ version: 1, added: [], hidden: [], excluded: [] }));
      if (profile === 'corrupt') localStorage.setItem(key, 'unreadable');
      if (profile.startsWith('blocked')) Object.defineProperty(Storage.prototype, profile === 'blocked-read' ? 'getItem' : 'setItem', { value() { throw Error('Storage blocked'); } });
    }, { profile, key, seen });
    await page.goto('/');
    await expect(pill(page)).toHaveCount(0);
    await page.reload();
    await expect(pill(page)).toHaveCount(0);
  });
}
