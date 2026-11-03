import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };

// Phones keep the picker's controls in its Options menu; wide screens show them in place.
async function options(page: Page, run: () => Promise<unknown>) {
  const menu = page.getByRole('button', { name: /^Picker options/ });
  const folded = await menu.isVisible();
  if (folded) await menu.click();
  await run();
  if (folded) await page.keyboard.press('Escape');
}
// Wide screens choose the picker in a dropdown; phones use two buttons in Options.
async function choose(page: Page, presentation: 'Helix' | 'Shuffle') {
  const menu = page.getByRole('button', { name: /^Picker options/ });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('group', { name: 'Picker presentation' }).getByRole('button', { name: presentation, exact: true }).click();
  } else await page.getByLabel('Picker', { exact: true }).selectOption(presentation.toLowerCase());
}
async function shuffle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await choose(page, 'Shuffle');
}

test('shuffle gathers, shuffles, deals face down, then reveals accessible distinct seats', async ({ page }) => {
  await shuffle(page);
  const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
  await picker.getByRole('radio', { name: '4 players' }).click();
  await picker.getByRole('button', { name: 'Pick 4 decks', exact: true }).click();
  await expect(picker).toHaveClass(/phase-gather/);
  await expect(page.locator('.helix-stage')).toHaveCount(0);
  await expect(picker).toHaveClass(/phase-shuffle/);
  await expect(picker).toHaveClass(/phase-deal/);
  await expect(picker.getByRole('button', { name: /^View Player/ })).toHaveCount(0);
  await expect(picker).toHaveClass(/phase-result/);
  const buttons = picker.getByRole('button', { name: /^View Player/ });
  await expect(buttons).toHaveCount(4);
  const labels = await buttons.evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')!.replace(/^View Player \d's deck /, '')));
  expect(new Set(labels).size).toBe(4);
  await buttons.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the chosen picker, players and instant pick behave the same in both presentations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await shuffle(page);
  const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
  // The collection grid gathers and the seats form a row (owner's picks, 2026-10-18).
  await expect(picker.locator('.gather-card img').first()).toBeAttached();
  await picker.getByRole('radio', { name: '3 players' }).click();
  await picker.getByRole('button', { name: 'Pick 3 decks' }).click();
  await expect(picker).toHaveClass(/phase-result/);
  await expect(picker.locator('.shuffle-seats.seats-3 .reveal-seat')).toHaveCount(3);
  // A small back arrow returns from the result to the decks on the table.
  await picker.getByRole('button', { name: 'Back to the decks', exact: true }).click();
  await expect(picker).toHaveClass(/phase-ready/);
  await expect(picker.locator('.gather-card img').first()).toBeAttached();
  await expect(picker.getByRole('button', { name: 'Back to the decks' })).toHaveCount(0);
  await expect(picker.getByRole('button', { name: 'Pick 3 decks', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: 'Pick 3 decks' }).click();
  await expect(picker).toHaveClass(/phase-result/);
  // The presentation is remembered like the player count.
  await page.reload();
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByLabel('Picker', { exact: true })).toHaveValue('shuffle');
  await expect(picker.getByRole('radio', { name: '3 players' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Variants' })).toHaveCount(0);
  await expect(page.locator('.studio-nav').getByRole('button', { name: 'Shuffle' })).toHaveCount(0);
  await page.getByPlaceholder(/^Search/).fill('Temur Roar');
  await expect(picker.getByRole('radio', { name: '2 players' })).toBeDisabled();
  await expect(picker.getByText('Only 1 deck matches, so this picks 1.')).toBeVisible();
  await picker.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(picker.getByRole('button', { name: /^View winning deck / })).toHaveCount(1);
  await page.getByPlaceholder(/^Search/).fill('no-deck-matches-xyz');
  await expect(picker.getByRole('button', { name: 'Pick a deck', exact: true })).toBeDisabled();
  await page.getByPlaceholder(/^Search/).fill('');
  await choose(page, 'Helix');
  await expect(page.getByRole('region', { name: 'Random deck picker' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Random deck picker' })).toBeVisible();
});
for (const width of [1920, 1500, 390]) {
  test(`shuffle seats fit ${width}px without covering controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : width === 1500 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await shuffle(page);
    const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
    await options(page, () => picker.getByRole('radio', { name: '4 players' }).click());
    await picker.getByRole('button', { name: 'Pick 4 decks' }).click();
    await expect(picker).toHaveClass(/phase-result/);
    const dock = (await picker.locator('.shuffle-dock').boundingBox())!;
    for (const seat of await picker.locator('.reveal-seat').all()) {
      const rect = (await seat.boundingBox())!;
      expect(rect.y + rect.height).toBeLessThanOrEqual(dock.y);
      await expect(seat).toBeInViewport({ ratio: 1 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('instant preference follows presentation changes and a new reduced-motion request ends the animation', async ({ page }) => {
  await shuffle(page);
  await page.getByRole('checkbox', { name: 'Instant pick' }).check();
  await choose(page, 'Helix');
  await expect(page.getByRole('checkbox', { name: 'Instant pick' })).toBeChecked();
  await choose(page, 'Shuffle');
  await page.getByRole('checkbox', { name: 'Instant pick' }).uncheck();
  const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
  await picker.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(picker).toHaveClass(/phase-gather/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(picker).toHaveClass(/phase-result/);
  await expect(picker.getByRole('button', { name: 'Pick again' })).toBeEnabled();
});

test('single shuffle result uses the accepted unlabelled reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await shuffle(page);
  const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
  await picker.getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(picker.getByRole('button', { name: /^View winning deck / })).toBeVisible();
  await expect(picker.locator('.seat-label')).toHaveCount(0);
  await expect(picker).not.toContainText('Player 1');
});

for (const [width, height] of [[360, 740], [390, 844], [844, 390]]) {
  test(`phone shuffle fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(decks => localStorage.setItem('commander-archive.collection.v1', JSON.stringify({ version: 1, starter: false, added: decks, manualIds: decks.map(d => d.id), hidden: [], excluded: [] })), seed);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await shuffle(page);
    const picker = page.getByRole('region', { name: 'Shuffle and deal picker' });
    const landscape = width > height;
    // Portrait phones fit without page scroll. In landscape the stage fills the screen
    // and picking scrolls it into view, as the helix does.
    const fits = async () => {
      if (!landscape) expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await fits();
    await options(page, () => picker.getByRole('radio', { name: '4 players' }).click());
    await expect(picker.getByRole('button', { name: /^Picker options/ })).toHaveText(/4 players/);
    await picker.getByRole('button', { name: 'Pick 4 decks' }).click();
    await expect(picker).toHaveClass(/phase-result/);
    await fits();
    await expect(picker).toBeInViewport({ ratio: 1 });
    const dock = (await picker.locator('.shuffle-dock').boundingBox())!;
    const bar = (await picker.locator('.picker-bar').boundingBox())!;
    for (const seat of await picker.locator('.reveal-seat').all()) {
      const box = (await seat.boundingBox())!;
      const card = (await seat.locator('.shuffle-card').boundingBox())!;
      expect(card.width).toBeGreaterThanOrEqual(60);
      expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
      await expect(seat).toBeInViewport({ ratio: 1 });
      // The glow sits centred on its card.
      const glow = (await seat.locator('.reveal-glow').boundingBox())!;
      expect(Math.abs(card.x + card.width / 2 - (glow.x + glow.width / 2))).toBeLessThan(1.5);
      expect(Math.abs(card.y + card.height / 2 - (glow.y + glow.height / 2))).toBeLessThan(1.5);
    }
  });
}

test('picker-setting entry points preserve the selected presentation consistently', async ({ page }) => {
  await shuffle(page);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('navigation', { name: 'Help sections' }).getByRole('link', { name: 'Finding and picking', exact: true }).click();
  await page.getByRole('button', { name: 'Open the picker', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Shuffle and deal picker' })).toBeVisible();
  await page.locator('.studio-nav').getByRole('button', { name: 'Collection', exact: true }).click();
  await page.locator('.studio-nav').getByRole('button', { name: 'Pick a deck', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Shuffle and deal picker' })).toBeVisible();
});
