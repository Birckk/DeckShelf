import { test, expect } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };
for (const width of [320, 390]) for (const count of [2, 7, 184]) {
  test(`phone picker leaves room between cards with ${count} decks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (count < 184) await page.addInitScript(decks => {
      localStorage.setItem('commander-archive.collection.v1', JSON.stringify({ version: 1, starter: false, added: decks, manualIds: decks.map(d => d.id), hidden: [], excluded: [] }));
    }, seed.slice(0, count).map((d, i) => ({ ...d, id: String(990001 + i) })));
    await page.goto('/');
    await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
    const cards = page.locator('.helix-card');
    await expect(cards.first()).toBeVisible();
    await expect.poll(async () => cards.first().evaluate(e => e.style.transform)).not.toBe('');
    const stage = (await page.locator('.helix-stage').boundingBox())!;
    const front = (await cards.first().boundingBox())!;
    expect(front.width / stage.width).toBeLessThan(0.65);
    expect(front.height / stage.height).toBeLessThan(0.29);
    // Every repeated visual card still refers to one member of the eligible pool.
    expect(await cards.evaluateAll(nodes => new Set(nodes.map(n => n.getAttribute('aria-label'))).size)).toBe(count);
    // Phones fold the picker's controls into one Options menu; only Pick stays on the stage.
    const options = page.getByRole('button', { name: /^Picker options/ });
    await expect(page.getByRole('checkbox', { name: 'Instant pick', exact: true })).toBeHidden();
    await options.click();
    await expect(page.getByRole('button', { name: 'Resume drift', exact: true })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: 'Instant pick', exact: true })).toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Players' })).toBeVisible();
    await expect(page.getByLabel('Pick format', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(options).toBeFocused();
    await expect(page.getByLabel('Pick format', { exact: true })).toBeHidden();
  });
}

// The picker's controls keep one place: the bar at the top of the stage and the dock under it.
for (const [width, height] of [[1920, 1080], [1500, 900], [390, 844], [360, 740], [844, 390]]) {
  test(`picker controls keep one place at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Pick a deck', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Random deck picker' });
    const stage = (await picker.boundingBox())!;
    const compact = width <= 550 || height <= 500;
    const options = page.getByRole('button', { name: /^Picker options/ });
    if (compact) {
      await expect(options).toHaveText(/1 player · Commander/);
      const button = (await options.boundingBox())!;
      // Top right of the stage, inside it.
      expect(button.y - stage.y).toBeLessThan(24);
      expect(stage.x + stage.width - (button.x + button.width)).toBeLessThan(24);
      await expect(page.getByRole('radiogroup', { name: 'Players' })).toBeHidden();
    } else {
      await expect(options).toHaveCount(0);
      const format = (await page.getByLabel('Pick format', { exact: true }).boundingBox())!;
      expect(format.y - stage.y).toBeLessThan(24);
      expect(format.x).toBeGreaterThan(stage.x + stage.width / 2);
      // The presentation dropdown mirrors it at the top left.
      const presentation = (await page.getByLabel('Picker', { exact: true }).boundingBox())!;
      expect(presentation.y - stage.y).toBeLessThan(24);
      expect(presentation.x).toBeLessThan(stage.x + stage.width / 4);
      const players = (await page.getByRole('radiogroup', { name: 'Players' }).boundingBox())!;
      const pick = (await page.getByRole('button', { name: 'Pick a deck', exact: true }).last().boundingBox())!;
      expect(players.y + players.height).toBeLessThanOrEqual(pick.y);
    }
    // Picking scrolls the whole stage into view, even on phones in landscape.
    await page.getByRole('button', { name: 'Pick a deck', exact: true }).last().click();
    await expect(page.getByRole('button', { name: /^View winning deck / })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pick again', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /^View winning deck / })).toBeInViewport({ ratio: 1 });
    const card = (await page.getByRole('button', { name: /^View winning deck / }).boundingBox())!;
    const glow = (await page.locator('.reveal-glow').boundingBox())!;
    expect(Math.abs(card.x + card.width / 2 - (glow.x + glow.width / 2))).toBeLessThan(1.5);
    expect(Math.abs(card.y + card.height / 2 - (glow.y + glow.height / 2))).toBeLessThan(1.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
