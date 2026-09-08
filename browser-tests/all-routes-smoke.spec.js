import { expect, test } from '@playwright/test';

const routes = ['/', '/journey', '/destinations', '/stories', '/plan', '/credits', '/app'];

test('all public routes render without console errors or broken images', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(`${page.url()}: ${message.text()}`); });
  page.on('pageerror', error => pageErrors.push(`${page.url()}: ${error.message}`));

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator('body'), route).not.toHaveText('');
    const brokenImages = await page.locator('img').evaluateAll(images => images
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.getAttribute('src')));
    expect(brokenImages, `${route} broken images`).toEqual([]);
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
