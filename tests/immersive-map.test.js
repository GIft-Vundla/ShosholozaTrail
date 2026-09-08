import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingBetween, createBasemapStyles, haversineMetres, sliceLineAtDistance, smoothBearing } from '../public/map/immersive-map.js';

const route = {
  type: 'Feature',
  properties: { lengthMetres: 222390 },
  geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0], [2, 0]] },
};

test('slices route at an engine distance without changing the source geometry', () => {
  const before = structuredClone(route);
  const result = sliceLineAtDistance(route, route.properties.lengthMetres / 2);
  assert.deepEqual(result[0], [0, 0]);
  assert.ok(Math.abs(result.at(-1)[0] - 1) < 0.01);
  assert.deepEqual(route, before);
});

test('bearing follows movement and smoothing crosses north by the short path', () => {
  assert.ok(Math.abs(bearingBetween([0, 0], [1, 0]) - 90) < 0.001);
  const value = smoothBearing(350, 10, 0.5);
  assert.ok(value < 1 || value > 359);
});

test('haversine distance is realistic for one degree at the equator', () => {
  assert.ok(Math.abs(haversineMetres([0, 0], [1, 0]) - 111195) < 100);
});

test('all requested basemaps exist and offline has no remote sources', () => {
  const styles = createBasemapStyles();
  assert.deepEqual(Object.keys(styles), ['streets', 'outdoor', 'dark', 'satellite', 'hybrid', 'offline']);
  assert.deepEqual(styles.offline.style.sources, {});
  assert.match(styles.satellite.style.sources.base.tiles[0], /earthdata\.nasa\.gov/);
  assert.match(styles.streets.style.sources.base.attribution, /OpenStreetMap/);
});

test('runtime satellite config replaces the keyless fallback without embedding a key', () => {
  const styles = createBasemapStyles({ satelliteTiles: ['https://tiles.example/{z}/{x}/{y}.jpg'], satelliteAttribution: 'Example', satelliteMaxZoom: 16 });
  assert.deepEqual(styles.satellite.style.sources.base.tiles, ['https://tiles.example/{z}/{x}/{y}.jpg']);
  assert.equal(styles.satellite.maxUsefulZoom, 16);
  assert.equal(JSON.stringify(styles).includes('GEMINI'), false);
});
