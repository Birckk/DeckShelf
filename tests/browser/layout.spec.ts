import { test, expect, type Page } from '@playwright/test';

// Every view shares the header's page gutter (src/layout.css), so their edges line up.
const sizes: [number, number][] = [[1920, 1080], [1500, 900], [1000, 800], [820, 1180], [390, 844], [360, 740]];
const gutter = (width: number) => width <= 550 ? 16 : width <= 1100 ? 24 : 32;

const edges = (page: Page, selector: string) => page.locator(selector).first().evaluate(e => {
  // The page scrolls inside the app shell, so measure against the full-width header, not the viewport.
  const box = e.getBoundingClientRect(), page = document.querySelector('.studio-header')!.getBoundingClientRect();
  return { left: Math.round(box.left - page.left), right: Math.round(page.right - box.right) };
});

for (const [width, height] of sizes) test(`views line up with the header gutter at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const view = (name: string) => page.getByRole('group', { name: 'Collection view' }).getByRole('button', { name, exact: true }).click();
  const expectGutter = async (selector: string, sides: ('left' | 'right')[] = ['left', 'right']) => {
    const box = await edges(page, selector);
    for (const side of sides) expect(box[side], `${selector} ${side} at ${width}px`).toBe(gutter(width));
  };
  await page.goto('/');
  await expectGutter('.studio-header .brand', ['left']);
  await expectGutter('.studio-header .header-actions', ['right']);
  await expectGutter('.collection-grid');
  await view('Cards');
  await expectGutter('.studio-caption');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expectGutter('.workspace-heading');
  await page.goto('/help/adding');
  await expectGutter('.workspace-heading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
