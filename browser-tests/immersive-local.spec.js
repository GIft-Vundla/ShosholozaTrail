import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const HUB_IDS = [
  'pretoria',
  'kimberley',
  'de-aar',
  'beaufort-west',
  'matjiesfontein',
  'worcester',
  'cape-town',
];

async function openShell(page) {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
}

async function openJourney(page) {
  await openShell(page);
  await expect(page.locator('#map')).toBeVisible();
}

async function requireImmersiveMap(page) {
  const map = page.locator('#map[data-map-engine="maplibre"]');
  test.skip(await map.count() === 0, 'MapLibre application integration is still being assembled.');
  return map;
}

test.describe('localized animation module', () => {
  test('publishes one sourced and visually distinct scene for every story hub', async ({ page }) => {
    await openShell(page);

    const result = await page.evaluate(async (hubIds) => {
      const animation = await import('/animations/localized-scenes.js');
      const host = document.createElement('div');
      host.id = 'animation-acceptance-host';
      document.body.append(host);
      const catalogue = animation.listLocalizedScenes();
      const mounted = hubIds.map((hubId) => {
        const controller = animation.mountLocalizedAnimation(host, hubId, {
          controls: true,
          durationSeconds: 4,
          replace: false,
        });
        const figure = controller.element;
        return {
          hubId: controller.hubId,
          title: figure.querySelector('title')?.textContent,
          description: figure.querySelector('desc')?.textContent,
          svg: figure.querySelector('svg')?.innerHTML,
          sourceIds: controller.metadata.sourceIds,
          accessibleNameRefs: figure.querySelector('svg')?.getAttribute('aria-labelledby'),
          controlLabel: figure.querySelector('button')?.getAttribute('aria-label'),
        };
      });
      return { catalogue, mounted };
    }, HUB_IDS);

    expect(result.catalogue.map((scene) => scene.hubId)).toEqual(HUB_IDS);
    expect(new Set(result.catalogue.map((scene) => scene.title)).size).toBe(HUB_IDS.length);
    expect(new Set(result.mounted.map((scene) => scene.svg)).size).toBe(HUB_IDS.length);
    for (const scene of result.mounted) {
      expect(scene.title?.trim()).toBeTruthy();
      expect(scene.description?.trim()).toBeTruthy();
      expect(scene.sourceIds.length).toBeGreaterThan(0);
      expect(scene.accessibleNameRefs?.trim().split(/\s+/)).toHaveLength(2);
      expect(scene.controlLabel).toMatch(/^Pause .+ animation$/);
    }
    await expect(page.locator('figure.st-local-scene[data-hub]')).toHaveCount(HUB_IDS.length);
  });

  test('reduced-motion users receive complete static scenes with no moving control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openShell(page);
    await page.evaluate(async () => {
      const { mountLocalizedAnimation } = await import('/animations/localized-scenes.js');
      const host = document.createElement('div');
      host.id = 'reduced-animation-host';
      document.body.append(host);
      mountLocalizedAnimation(host, 'beaufort-west');
    });

    const scene = page.locator('#reduced-animation-host .st-local-scene');
    await expect(scene).toHaveAttribute('data-static', 'true');
    await expect(scene.locator('svg[role="img"]')).toBeVisible();
    await expect(scene.locator('.st-local-scene__control')).toHaveCount(0);
    await expect.poll(() => scene.locator('.scene-draw').first().evaluate((element) => {
      return getComputedStyle(element).animationName;
    })).toBe('none');
  });
});

test.describe('immersive map application contract', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.route(/^https:\/\/(?:tile|[abc]\.tile|[abc]\.basemaps|gibs|s3\.amazonaws)\./, (route) => route.abort());
    await openJourney(page);
  });

  test('switches among named visual styles while keeping provider attribution visible', async ({ page }) => {
    const map = await requireImmersiveMap(page);
    const switcher = page.getByRole('group', { name: 'Map appearance' });
    await expect(switcher).toBeVisible();

    const styleControls = switcher.locator('[data-map-style]');
    expect(await styleControls.count()).toBeGreaterThanOrEqual(4);
    const styleNames = await styleControls.evaluateAll((elements) => {
      return elements.map((element) => element.getAttribute('data-map-style'));
    });
    expect(styleNames).toEqual(expect.arrayContaining(['streets', 'dark', 'satellite', 'hybrid']));

    for (const control of await styleControls.all()) {
      const style = await control.getAttribute('data-map-style');
      await control.click();
      await expect(map).toHaveAttribute('data-active-style', style);
      await expect(control).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap|OpenMapTiles|OpenFreeMap|NASA|Copernicus/i);
    }
  });

  test('keeps native map controls operable and exposes follow mode explicitly', async ({ page }) => {
    const map = await requireImmersiveMap(page);
    const canvas = map.locator('canvas.maplibregl-canvas');
    await expect(canvas).toBeVisible();

    const zoomIn = map.getByRole('button', { name: /zoom in/i });
    await expect(zoomIn).toBeVisible();
    await zoomIn.click();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.58, { steps: 8 });
    await page.mouse.up();

    const followControl = page.getByRole('checkbox', { name: /follow train/i });
    await expect(followControl).toBeChecked();
    await followControl.uncheck();
    await expect(followControl).not.toBeChecked();
    await followControl.check();
    await expect(followControl).toBeChecked();
    await expect(page.locator('#message')).toContainText(/map follow on/i);
  });

  test('opens the matching localized scene from each hub marker', async ({ page }) => {
    await requireImmersiveMap(page);
    for (const hubId of HUB_IDS) {
      await page.getByRole('button', { name: /fit whole route/i }).click();
      const marker = page.locator(`.immersive-hub[data-hub="${hubId}"], [data-hub-marker="${hubId}"]`).first();
      await expect(marker).toBeVisible();
      await marker.click();
      const scene = page.locator(`figure.st-local-scene[data-hub="${hubId}"]`);
      await expect(scene).toBeVisible();
      await expect(scene.locator('svg[role="img"] title')).not.toHaveText('');
      await page.getByRole('button', { name: /close .*preview|close .*story/i }).click();
    }
  });

  test('falls back to an attributed first-party route view when external styles are offline', async ({ context, page }) => {
    const map = await requireImmersiveMap(page);
    await page.getByRole('button', { name: /download offline pack|check and install pack update/i }).click();
    await expect(page.locator('#pack-state')).toContainText(/Ready .* verified files/i, { timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#network')).toContainText('Offline');
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute('data-active-style', 'offline');
    await expect(page.getByText(/offline map|offline route|external map.*unavailable/i)).toBeVisible();
    await expect(page.getByText(/unverified schematic/i)).toBeVisible();
    await expect(page.getByText(/OpenStreetMap/i)).toBeVisible();
  });
});

test.describe('immersive map module contract', () => {
  test('switches an attributed style, exposes interactive hubs, and falls back offline', async ({ context, page }) => {
    await openShell(page);
    await context.route(/^https:\/\/(?:tile|[abc]\.tile|[abc]\.basemaps|gibs|s3\.amazonaws)\./, (route) => route.abort());
    await page.addScriptTag({ url: '/vendor/maplibre-gl/maplibre-gl.js' });
    await page.evaluate(async () => {
      const [{ createImmersiveMap }, route, hubs] = await Promise.all([
        import('/map/immersive-map.js'),
        fetch('/data/route.geojson').then((response) => response.json()),
        fetch('/data/hubs.json').then((response) => response.json()),
      ]);
      const fixture = document.createElement('section');
      fixture.id = 'immersive-module-fixture';
      fixture.innerHTML = '<div id="immersive-contract-controls"></div><div id="immersive-contract-map" style="height:360px"></div>';
      document.body.append(fixture);
      const controller = createImmersiveMap({
        container: fixture.querySelector('#immersive-contract-map'),
        controlsContainer: fixture.querySelector('#immersive-contract-controls'),
        route,
        hubs: hubs.stations,
        attractions: [],
        initialStyle: 'offline',
        reducedMotion: true,
        onHubSelect: (hub) => { fixture.dataset.selectedHub = hub.hubId ?? hub.id; },
      });
      controller.addStyleControl();
      window.__immersiveAcceptanceController = controller;
    });

    const fixture = page.locator('#immersive-module-fixture');
    const map = fixture.locator('#immersive-contract-map');
    await expect(map).toHaveAttribute('data-map-engine', 'maplibre');
    await expect(map).toHaveAttribute('data-active-style', 'offline');
    await expect(fixture.locator('.immersive-hub[data-hub]')).toHaveCount(HUB_IDS.length);

    const follows = await page.evaluate(() => {
      const controller = window.__immersiveAcceptanceController;
      return [controller.setFollow(false), controller.getState().follow, controller.setFollow(true), controller.getState().follow];
    });
    expect(follows).toEqual([false, false, true, true]);
    await fixture.locator('.immersive-hub[data-hub]').first().click();
    await expect(fixture).toHaveAttribute('data-selected-hub', HUB_IDS[0]);

    const dark = fixture.locator('[data-map-style="dark"]');
    await dark.click();
    await expect(map).toHaveAttribute('data-active-style', 'dark');
    await expect(dark).toHaveAttribute('aria-pressed', 'true');
    await expect(fixture.locator('.maplibregl-ctrl-attrib')).toContainText(/CARTO/i);
    await expect(fixture.locator('.maplibregl-ctrl-attrib')).toContainText(/OpenStreetMap/i);

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(map).toHaveAttribute('data-active-style', 'offline');
    await expect(fixture.locator('.immersive-map-status')).toContainText(/offline map active/i);
    await expect(fixture.locator('.immersive-hub[data-hub]')).toHaveCount(HUB_IDS.length);
  });
});

test('public bundle contains no private provider credentials', async () => {
  const publicRoot = path.resolve('public');
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (/\.(?:html|js|mjs|css|json|svg|webmanifest)$/i.test(entry.name)) files.push(fullPath);
    }
  }
  await walk(publicRoot);
  const bundle = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  expect(bundle).not.toMatch(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  expect(bundle).not.toMatch(/\b(?:GEMINI|GROQ|CLOUDFLARE|MAPTILER)_?(?:API_?)?(?:SECRET|TOKEN)\b\s*[:=]\s*["'][^"']{8,}/i);
  expect(bundle).not.toMatch(/\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/);
  expect(bundle).not.toMatch(/\bAKIA[0-9A-Z]{16}\b/);
  expect(bundle).not.toMatch(/\bAIza[0-9A-Za-z_-]{30,}\b/);
  expect(bundle).not.toMatch(/[?&](?:api[_-]?key|access[_-]?token|token|key)=[A-Za-z0-9._~-]{12,}/i);
});
