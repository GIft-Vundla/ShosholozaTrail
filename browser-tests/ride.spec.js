import { expect, test } from '@playwright/test';

const routeFixture = {
  type: 'Feature',
  properties: {
    railAlignmentVerified: true,
    routeVersion: '1.0.0-osm-rail-candidate',
    confidence: 'osm-resolved',
    geometryType: 'mapped-rail-alignment',
    resolvedSegments: ['pretoria-johannesburg'],
    unresolvedSegments: [],
  },
  geometry: {
    type: 'LineString',
    coordinates: [[28.19, -25.75], [28.17, -25.86], [28.1, -26.02], [28.05, -26.2]],
  },
};
const hubsFixture = {
  version: '1.0.0-osm-rail-candidate',
  hubOrder: ['pretoria', 'johannesburg'],
  stations: [
    { id: 'pretoria', hubId: 'pretoria', name: 'Pretoria', lon: 28.19, lat: -25.75 },
    { id: 'johannesburg', hubId: 'johannesburg', name: 'Johannesburg', lon: 28.05, lat: -26.2 },
  ],
  triggerZones: [{ id: 'johannesburg', hubId: 'johannesburg', sEnter: 45_000, sExit: 55_000, stationAlongMetres: 52_000 }],
  attractions: [],
};

const mapModule = `
export function createBasemapStyles(){const style={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#152b3b'}}]};return {satellite:{style},offline:{style}}}
`;

async function openFixtureRide(page, reducedMotion = false) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/data/route-ride.geojson', route => route.fulfill({
    contentType: 'application/geo+json', body: JSON.stringify(routeFixture),
  }));
  await page.route('**/map/immersive-map.js', route => route.fulfill({ contentType: 'text/javascript', body: mapModule }));
  await page.goto('/ride?hub=pretoria');
  await expect(page.getByTestId('ride-source')).toContainText('osm resolved');
  await expect(page.getByTestId('ride-source')).toContainText('2 arrivals');
  await expect(page.getByLabel('Pretoria arrival')).toBeVisible();
}

test('ride uses verified route properties, arrival content and step/look controls', async ({ page }) => {
  await openFixtureRide(page);
  await expect(page.locator('.ride')).toHaveAttribute('data-route-state', 'ready');
  await expect(page.locator('.ride')).toHaveAttribute('data-world-ready', 'true');
  await expect(page.getByRole('navigation', { name: 'Ride speed' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Discovered places' })).toBeVisible();
  await expect(page.locator('.ride-look-challenge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Turn on ride sound' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Turn on ride sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute ride sound' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'Pretoria place photograph' })).toHaveAttribute('src', '/assets/photos/pretoria.webp');
  await page.getByRole('button', { name: 'Return to the track' }).click();
  await expect(page.getByRole('button', { name: 'Step forward; hold for continuous ride' })).toBeEnabled();
  await page.getByRole('button', { name: 'Look right' }).click();
  await expect(page.locator('.ride')).toHaveAttribute('data-bearing', '12');
  await page.getByRole('button', { name: 'Step forward; hold for continuous ride' }).click();
  await expect(page.locator('.ride-readout span')).not.toHaveText('0 km travelled', { timeout: 3_000 });
});

test('verified rail world switches to its packaged renderer when offline', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.route('**/data/route-ride.geojson', route => route.fulfill({ contentType: 'application/geo+json', body: JSON.stringify(routeFixture) }));
  await page.route('**/data/hubs.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(hubsFixture) }));
  await page.route('**/map/immersive-map.js', route => route.fulfill({ contentType: 'text/javascript', body: mapModule }));
  await page.goto('/ride?hub=pretoria');
  await expect(page.locator('.ride')).toHaveAttribute('data-world-ready', 'true');
  await expect(page.getByText('Offline rail world')).toBeVisible();
});

test('reduced motion keeps instant stepping and disables continuous motion', async ({ page }) => {
  await openFixtureRide(page, true);
  await page.getByRole('button', { name: 'Return to the track' }).click();
  await expect(page.locator('.ride')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.getByRole('button', { name: 'Start auto ride' })).toBeDisabled();
  await page.getByRole('button', { name: 'Step forward; hold for continuous ride' }).click();
  await expect(page.locator('.ride-readout span')).not.toHaveText('0 km travelled');
});

test('ride fails closed when verified rail data is unavailable', async ({ page }) => {
  await page.route('**/data/route-ride.geojson', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto('/ride');
  await expect(page.locator('.ride-unavailable')).toHaveAttribute('data-route-state', 'unavailable');
  await expect(page.getByRole('heading', { name: 'The Ride is waiting for verified track data' })).toBeVisible();
  await expect(page.getByText('only starts when a continuous, verified rail candidate is available')).toBeVisible();
});

test('journey overview consumes mapped rail geometry instead of rebuilding stop connectors', async ({ page }) => {
  const journeyModule = `
export function haversineMetres(){return 1000}
export function createImmersiveMap(options){queueMicrotask(()=>options.onStatus({status:'ready'}));return {addStyleControl(){return document.createElement('div')},destroy(){},fitRoute(){},setFollow(){return true},setRouteProgress(){},updatePosition(){}}}
`;
  await page.route('**/data/route.geojson', route => route.fulfill({ contentType: 'application/geo+json', body: JSON.stringify(routeFixture) }));
  await page.route('**/map/immersive-map.js', route => route.fulfill({ contentType: 'text/javascript', body: journeyModule }));
  await page.goto('/journey');
  await expect(page.getByTestId('journey-route-source')).toContainText('Mapped rail geometry / osm resolved');
  await expect(page.getByTestId('journey-route-source')).not.toContainText('fallback');
});
