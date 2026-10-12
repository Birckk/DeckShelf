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
    await expect(page.getByRole('button', { name: 'Resume drift', exact: true })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: 'Instant pick', exact: true })).toBeChecked();
  });
}
