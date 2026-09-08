import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const TOKENS = {
  '--ink': '#111a29',
  '--cream': '#f8f2e8',
  '--gold': '#f4bd4f',
  '--muted': '#737988',
  '--border': '#ded8ce',
};

async function themeSnapshot(page) {
  return page.evaluate((tokens) => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const brand = getComputedStyle(document.querySelector('.brand'));
    const mark = getComputedStyle(document.querySelector('.brand-mark'));
    const nav = document.querySelector('.nav-shell');
    return {
      tokens: Object.fromEntries(tokens.map((token) => [token, root.getPropertyValue(token).trim()])),
      bodyFont: body.fontFamily,
      bodyBackground: body.backgroundColor,
      brandFont: brand.fontFamily,
      markBackground: mark.backgroundColor,
      navHeight: nav ? getComputedStyle(nav).height : null,
    };
  }, Object.keys(TOKENS));
}

test.describe('canonical theme across both application shells', () => {
  test.beforeEach(async ({ context }) => {
    await context.route(/^https:\/\//, (route) => route.abort());
  });

  test('React and engine shells share tokens, fonts, brand and header geometry', async ({ page }) => {
    await page.goto('/destinations');
    await expect(page.locator('.site-header .brand')).toContainText('Shosholoza Trail');
    const react = await themeSnapshot(page);

    await page.goto('/app');
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.locator('.site-header .brand')).toContainText('Shosholoza Trail');
    const engine = await themeSnapshot(page);

    expect(react.tokens).toEqual(TOKENS);
    expect(engine.tokens).toEqual(TOKENS);
    expect(engine).toEqual(react);
    expect(engine.bodyFont).toMatch(/Outfit/i);
    expect(engine.brandFont).toMatch(/Fraunces/i);
    expect(await page.evaluate(() => document.fonts.load('600 18px Fraunces').then((fonts) => fonts.length))).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.fonts.load('400 16px Outfit').then((fonts) => fonts.length))).toBeGreaterThan(0);
  });

  test('engine header navigation remains accessible and internal tabs stay client-routed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/app');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();

    const storiesTab = page.getByRole('navigation', { name: 'Primary tabs' }).getByRole('link', { name: 'Stories' });
    await storiesTab.click();
    await expect(page).toHaveURL(/\/app\/stories$/);
    await expect(page.locator('main h1')).toContainText('Seven places');
    await expect(storiesTab).toHaveAttribute('aria-current', 'page');
  });

  test('legacy CSS and postcard canvas no longer carry the retired green palette', async () => {
    for (const file of ['public/style.css', 'public/journey.css', 'public/app.html', 'public/app.js']) {
      expect((await readFile(file, 'utf8')).toLowerCase(), file).not.toContain('#183e36');
    }
  });
});
