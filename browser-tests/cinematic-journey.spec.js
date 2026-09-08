import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.goto('/app');
  await expect(page.locator('#map')).toBeVisible();
});

test('map keeps route provenance visible and opens a sourced story card from a keyboard-accessible hub', async ({ page }) => {
  await expect(page.locator('.map-key')).toContainText(/OSM-mapped rail candidate/i);
  await expect(page.locator('.map-key')).toContainText(/human or organiser review/i);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap/i);

  const hubs = page.locator('.immersive-hub');
  await expect(hubs).toHaveCount(8);
  const firstInteractiveMarker = hubs.first();
  await firstInteractiveMarker.focus();
  await expect(firstInteractiveMarker).toBeFocused();
  await page.keyboard.press('Enter');

  const card = page.locator('#map-story-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/offline|route|nearby/i);
  await expect(card.getByRole('link', { name: /open|read/i })).toBeVisible();

  await card.getByRole('button', { name: /close story preview/i }).click();
  const expectedAttractions = await page.evaluate(async () => {
    const data = await fetch('/data/hubs.json').then(response => response.json());
    return data.attractions.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon)).length;
  });
  const attractions = page.locator('.immersive-attraction');
  await expect(attractions).toHaveCount(expectedAttractions);
  const firstAttraction = attractions.first();
  await firstAttraction.focus();
  await expect(firstAttraction).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/visibility from the train and rail access are not established/i);
  await expect(card.getByRole('link', { name: /coordinate source/i })).toBeVisible();
  await card.getByRole('link', { name: /open the hub chapter/i }).click();
  await expect(page.locator('.story-sources .source a').first()).toBeVisible();
});

test('labelled replay moves a train and progressively reveals the traversed route', async ({ page }) => {
  await page.getByRole('button', { name: /run labelled replay/i }).click();

  await expect(page.locator('#position-label')).toContainText('SIMULATED REPLAY');
  const train = page.locator('.immersive-train--replay');
  await expect(train).toBeVisible();
  await expect(train).toHaveAttribute('aria-label', /simulated|replay/i);

  await expect.poll(() => page.locator('#journey-progress-bar').evaluate(element => element.value)).toBeGreaterThan(0);
  await expect(page.locator('#journey-progress')).toContainText(/%|km/i);
  await expect.poll(async () => Number(await page.locator('#map').getAttribute('data-route-progress'))).toBeGreaterThan(0);
});

test('reduced-motion preference removes cinematic animation while retaining journey status', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#map')).toBeVisible();
  await page.getByRole('button', { name: /run labelled replay/i }).click();

  const train = page.locator('.immersive-train--replay');
  await expect(train).toBeVisible();
  const motion = await train.evaluate(element => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, animationDuration: style.animationDuration };
  });
  expect(motion.animationName).toBe('none');
  expect(motion.animationDuration).toBe('0s');
  await expect(page.locator('#journey-progress')).toBeVisible();
});

test('waiting enters low-power mode with truthful copy and no visual animation', async ({ page }) => {
  await page.getByRole('button', { name: /run labelled replay/i }).click();
  await page.waitForFunction(() => document.body.classList.contains('low-power'), null, { timeout: 12_000, polling: 50 });

  await expect(page.locator('#waiting')).toContainText('The train has not moved for more than 8 minutes.');
  await expect(page.locator('#waiting')).toContainText("We don't have an official reason or a restart time.");
  await expect(page.locator('#waiting')).toContainText(/30 seconds/i);
  await expect(page.locator('#map')).toBeHidden();
  const animationName = await page.locator('body').evaluate(element => getComputedStyle(element).animationName);
  expect(animationName).toBe('none');
});

test('installed pack reopens the journey, chapter and verified rail ride offline', async ({ context, page }) => {
  await page.getByRole('button', { name: /download offline pack|check and install pack update/i }).click();
  await expect(page.locator('#pack-state')).toContainText(/Ready .* verified files/i, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.goto('/app/stories/kimberley', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#network')).toContainText('Offline');
  await expect(page.locator('main h1')).toContainText(/Kimberley/i);
  await expect(page.locator('#startup-error')).toHaveCount(0);

  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('.map-key')).toContainText(/OSM-mapped rail candidate/i);

  await page.goto('/ride?hub=pretoria', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.ride')).toHaveAttribute('data-world-ready', 'true', { timeout: 20_000 });
  await expect(page.getByText('Offline rail world')).toBeVisible();
  await expect(page.getByLabel('Pretoria arrival')).toBeVisible();
});
