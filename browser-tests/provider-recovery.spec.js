import { expect, test } from '@playwright/test';

const SOURCE_EXCERPT = 'Freedom Park is in Salvokop, Pretoria.';

async function openJourney(page) {
  await page.goto('/journey');
  const map = page.locator('.journey-map-canvas[data-map-engine="maplibre"]');
  await expect(map).toBeVisible();
  return map;
}

test.describe('live keyless map provider recovery', () => {
  test('Night uses a keyless provider and never requests CARTO watermark tiles', async ({ page }) => {
    const requested = [];
    const providerResponses = [];
    page.on('request', (request) => requested.push(request.url()));
    page.on('response', (response) => {
      if (/\/\/tile\.openstreetmap\.org\//i.test(response.url())) {
        providerResponses.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] || '' });
      }
    });

    const map = await openJourney(page);
    await expect(page.getByRole('group', { name: 'Map appearance' })).toBeVisible();
    await expect(map.getByRole('button', { name: /zoom in/i })).toBeVisible();
    const firstProviderResponse = page.waitForResponse((response) => /\/\/tile\.openstreetmap\.org\//i.test(response.url()) && response.ok());
    await page.locator('[data-map-style="dark"]').click();
    await firstProviderResponse;
    await expect(map).toHaveAttribute('data-active-style', 'dark');
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap/i);
    await page.waitForTimeout(1_500);

    expect(requested.some((url) => /cartocdn\.com/i.test(url)), 'CARTO now returns API KEY REQUIRED watermark tiles').toBe(false);
    expect(providerResponses.some((response) => response.status >= 200 && response.status < 300)).toBe(true);
    expect(providerResponses.filter((response) => response.status >= 400)).toEqual([]);
  });

  test('Satellite loads real EOxCloudless image tiles instead of a dark error canvas', async ({ page }) => {
    const tileResponses = [];
    const tileFailures = [];
    page.on('response', (response) => {
      if (/[abc]\.tiles\.maps\.eox\.at\/wmts\//i.test(response.url())) {
        tileResponses.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] || '' });
      }
    });
    page.on('requestfailed', (request) => {
      if (/[abc]\.tiles\.maps\.eox\.at\/wmts\//i.test(request.url())) tileFailures.push(request.failure()?.errorText || 'request failed');
    });

    const map = await openJourney(page);
    const firstImage = page.waitForResponse((response) => {
      return /[abc]\.tiles\.maps\.eox\.at\/wmts\/.+\/s2cloudless-2025_3857\/.+\.jpg(?:\?|$)/i.test(response.url())
        && response.ok()
        && /^image\/jpeg/i.test(response.headers()['content-type'] || '');
    });
    await page.locator('[data-map-style="satellite"]').click();
    await firstImage;
    await expect(map).toHaveAttribute('data-active-style', 'satellite');
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/EOxCloudless.*EOX/i);
    await page.waitForTimeout(2_000);

    expect(tileResponses.length).toBeGreaterThanOrEqual(4);
    expect(tileResponses.filter((response) => response.status >= 400)).toEqual([]);
    expect(tileResponses.every((response) => /^image\/jpeg/i.test(response.type))).toBe(true);
    // MapLibre cancels obsolete in-flight tiles as the React playback camera
    // moves. Those ERR_ABORTED requests are expected; transport failures are not.
    expect(tileFailures.filter((failure) => failure !== 'net::ERR_ABORTED')).toEqual([]);
  });

  test('Hybrid combines EOxCloudless imagery with its transparent reference overlay', async ({ page }) => {
    const map = await openJourney(page);
    const imagery = page.waitForResponse((response) => /s2cloudless-2025_3857\/.+\.jpg(?:\?|$)/i.test(response.url()) && response.ok());
    const overlay = page.waitForResponse((response) => /overlay_3857\/.+\.png(?:\?|$)/i.test(response.url()) && response.ok());
    await page.locator('[data-map-style="hybrid"]').click();
    await Promise.all([imagery, overlay]);

    await expect(map).toHaveAttribute('data-active-style', 'hybrid');
    await expect(map).toHaveAttribute('data-map-provider', 'eox-cloudless-2025');
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/EOxCloudless.*EOX/i);
  });

  test('React StrictMode leaves one live map and cleans it up across route remounts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openJourney(page);
    await expect(page.locator('.journey-map-canvas canvas.maplibregl-canvas')).toHaveCount(1);
    await expect(page.locator('.react-map-controls .immersive-style-control')).toHaveCount(1);

    await page.getByRole('link', { name: /Shosholoza Trail/i }).click();
    await expect(page.locator('.journey-map-canvas canvas.maplibregl-canvas')).toHaveCount(0);
    await page.goto('/journey');
    await expect(page.locator('.journey-map-canvas canvas.maplibregl-canvas')).toHaveCount(1);
    await expect(page.locator('.react-map-controls .immersive-style-control')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('map style controls stay on-screen and touch-sized on a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await openJourney(page);
    const control = page.getByRole('group', { name: 'Map appearance' });
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    for (const button of await control.locator('[data-map-style]').all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('playback animates journey progress and the geographic train marker', async ({ page }) => {
    await openJourney(page);
    const timeline = page.locator('.timeline input[type="range"]');
    const train = page.locator('.immersive-train');
    await expect(timeline).toBeVisible();
    await expect(train).toBeVisible();
    const initialValue = Number(await timeline.inputValue());
    const initialBox = await train.boundingBox();
    await page.getByRole('button', { name: '4×' }).click();
    await expect.poll(async () => Number(await timeline.inputValue()), { timeout: 8_000 }).toBeGreaterThan(initialValue + 20);
    const laterBox = await train.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(laterBox).not.toBeNull();
    expect(Math.hypot(laterBox.x - initialBox.x, laterBox.y - initialBox.y)).toBeGreaterThan(1);
    await expect(page.locator('.track > span')).not.toHaveCSS('width', '0px');
  });
});

test.describe('AI interface recovery', () => {
  test('renders a grounded provider result with its label and source reference', async ({ page }) => {
    let requestBody;
    let authorization;
    await page.route('**/api/ai', async (route) => {
      requestBody = route.request().postDataJSON();
      authorization = route.request().headers().authorization;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'source-excerpt',
          enabled: true,
          label: 'Experimental AI-selected source excerpt; answers are source-locked and human review is still pending.',
          answer: SOURCE_EXCERPT,
          sourceIds: ['freedom-park'],
          sourceReview: 'editorial-draft-human-review-pending',
          mode: 'experimental-source-locked',
          provider: 'workers-ai',
          modelId: '@cf/zai-org/glm-4.7-flash',
          quotaIdentity: 'guest',
        }),
      });
    });

    await page.goto('/app/stories/pretoria');
    await page.getByRole('button', { name: /ask ai|assistive/i }).click();
    const result = page.locator('#ai-result, [data-ai-result]').first();
    await expect(result).toContainText(SOURCE_EXCERPT);
    await expect(result).toContainText(/Experimental AI-selected source excerpt/i);
    await expect(result).toContainText(/human review is still pending/i);
    await expect(result).toContainText(/Freedom Park|freedom-park/i);
    expect(requestBody).toMatchObject({ action: 'explain' });
    expect(requestBody.question).toMatch(/Pretoria/i);
    expect(authorization).toBeUndefined();
  });

  test('keeps the cached-source fallback usable when AI is unavailable', async ({ page }) => {
    await page.route('**/api/ai', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'fallback',
        enabled: false,
        reason: 'provider-failed-or-output-not-grounded',
        answer: 'AI assistance is unavailable. Use the cached sourced chapter, its three-step hint ladder, or the local creative prompt.',
        sourceIds: [],
      }),
    }));

    await page.goto('/app/stories/pretoria');
    await page.getByRole('button', { name: /ask ai|assistive/i }).click();
    const result = page.locator('#ai-result, [data-ai-result]').first();
    await expect(result).toContainText(/AI assistance is unavailable/i);
    await expect(page.locator('.story-sources')).toBeVisible();
    await expect(page.locator('.story-sources a').first()).toBeVisible();
  });
});
