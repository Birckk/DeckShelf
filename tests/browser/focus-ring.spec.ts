import { test, expect, type Page } from '@playwright/test';
import seed from '../../src/data/decks.json' with { type: 'json' };

const deck = { ...seed[0], id: '987001', name: 'Shared Commander' };
const source = { key: 'folder:42', kind: 'folder', value: '42', name: 'Public shelf', url: 'https://archidekt.com/folders/42', checkedAt: new Date().toISOString(), entries: [{ id: deck.id, name: deck.name, image: deck.commanders[0].art, colors: deck.colors }], knownIds: [deck.id] };

// What the owner sees: the outline drawn on whatever holds focus, wherever a script put it.
const focused = (page: Page) => page.evaluate(() => {
  const element = document.activeElement as HTMLElement;
  return { label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, ring: getComputedStyle(element).outlineStyle };
});

async function openSharedFolder(page: Page) {
  await page.route('**/api/source-folders?*', route => route.fulfill({ json: { name: source.name, folders: [{ source, path: source.name, root: true }] } }));
  await page.route('**/api/decks/987001', route => route.fulfill({ json: deck }));
  await page.goto('/f/42');
  await expect(page.getByRole('button', { name: 'View Shared Commander', exact: true })).toBeVisible();
  // A friend's shelf keeps Share on its Library page, not in the header.
  await page.getByRole('button', { name: 'Public shelf library', exact: true }).click();
  return page.getByRole('button', { name: 'Share', exact: true });
}

test('a clicked button keeps no ring, and Tab still draws one', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.studio-nav button', { hasText: 'Cards' });
  await cards.click();
  await expect(cards).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Tab');
  const next = page.locator('.studio-nav button', { hasText: 'Pick a deck' });
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS('outline-style', 'solid');
  // The mouse takes over at once, even on the control the keyboard left a ring on.
  await next.hover();
  await page.mouse.down();
  await expect(next).toHaveCSS('outline-style', 'none');
  await page.mouse.up();
});

test('a dialog opened with the mouse takes focus without a ring, on opening or closing', async ({ page }) => {
  const share = await openSharedFolder(page);
  const close = page.getByRole('button', { name: 'Close dialog' });
  await share.click();
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS('outline-style', 'none');
  await close.click();
  await expect(close).toHaveCount(0);
  expect((await focused(page)).ring).toBe('none');
  // Escape after a mouse click is still a mouse user; browsers guess otherwise here.
  await share.click();
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(close).toHaveCount(0);
  expect((await focused(page)).ring).toBe('none');
  // Tabbing inside a dialog opened with the mouse shows where focus went.
  await share.click();
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focused(page)).toMatchObject({ ring: 'solid' });
});

test('a dialog opened with the keyboard shows the ring, and on return', async ({ page }) => {
  const share = await openSharedFolder(page);
  await share.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(share).toBeFocused();
  await expect(share).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close dialog' });
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(close).toHaveCount(0);
  await expect(share).toBeFocused();
  await expect(share).toHaveCSS('outline-style', 'solid');
});

test('a clicked text field keeps its focus style', async ({ page }) => {
  const share = await openSharedFolder(page);
  await share.click();
  const link = page.getByLabel('Collection link');
  await link.click();
  await expect(link).toHaveCSS('outline-style', 'solid');
});

test('a menu opened with the mouse does not light its first item until the keyboard is used', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /^More actions for/ }).first().click();
  const items = page.getByRole('menuitem');
  await expect(items.first()).toBeFocused();
  await expect(items.first()).toHaveCSS('outline-style', 'none');
  const resting = await items.first().evaluate(element => getComputedStyle(element).backgroundColor);
  await page.keyboard.press('ArrowDown');
  const next = page.locator(':focus');
  await expect(next).toHaveCSS('outline-style', 'solid');
  await expect(next).not.toHaveCSS('background-color', resting);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });

  test('a tapped button does not stay lit or raised', async ({ page }) => {
    await page.goto('/');
    const filters = page.getByRole('button', { name: /filters/i }).first();
    await filters.tap();
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    // .button:hover lifts a button by 1px, which is the stuck state this guards against.
    await expect(filters).toHaveCSS('transform', 'none');
    await expect(filters).toHaveCSS('outline-style', 'none');
  });
});
