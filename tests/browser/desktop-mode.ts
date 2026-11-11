import type { Page } from '@playwright/test';

// The Windows app's preload exposes this bridge (desktop/preload.cjs). With fetchAllDecks set,
// the page loads every deck's details as the app does; without it, it behaves as the website.
export async function asWindowsApp(page: Page) {
  await page.addInitScript(() => {
    Object.assign(window, { deckshelfDesktop: { fetchAllDecks: true, openMenu() {}, onCommand: () => () => {} } });
  });
}
