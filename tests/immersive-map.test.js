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
  assert.match(styles.satellite.style.sources.base.tiles[0], /services\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/);
  assert.equal(styles.satellite.maxUsefulZoom, 19);
  assert.equal(styles.satellite.style.metadata['shosholoza:provider'], 'esri-world-imagery');
  assert.match(styles.satellite.style.sources.base.attribution, /Esri.*Maxar.*GIS User Community/);
  assert.equal(styles.hybrid.style.sources.labels.url, 'https://tiles.openfreemap.org/planet');
  assert.match(styles.hybrid.style.glyphs, /tiles\.openfreemap\.org\/fonts/);
  assert.equal(styles.hybrid.style.layers.find(layer => layer.id === 'hybrid-imagery').paint['raster-saturation'], 0);
  assert.equal(styles.hybrid.style.layers.find(layer => layer.id === 'hybrid-place-labels').paint['text-opacity'], 0.72);
  assert.match(styles.streets.style.sources.base.attribution, /OpenStreetMap/);
});

test('keyless Night has no CARTO watermark dependency and applies a dark treatment', () => {
  const styles = createBasemapStyles();
  assert.deepEqual(styles.dark.style.sources.base.tiles, styles.streets.style.sources.base.tiles);
  assert.equal(JSON.stringify(styles.dark).includes('cartocdn'), false);
  assert.equal(styles.dark.style.metadata['shosholoza:provider'], 'openstreetmap-night-treatment');
  const paint = styles.dark.style.layers.find(layer => layer.id === 'dark-raster').paint;
  assert.ok(paint['raster-brightness-max'] < 0.5);
  assert.ok(paint['raster-saturation'] < 0);
});

test('runtime satellite config replaces the keyless fallback without embedding a key', () => {
  const styles = createBasemapStyles({ satelliteTiles: ['https://tiles.example/{z}/{x}/{y}.jpg'], satelliteAttribution: 'Example', satelliteMaxZoom: 16 });
  assert.deepEqual(styles.satellite.style.sources.base.tiles, ['https://tiles.example/{z}/{x}/{y}.jpg']);
  assert.equal(styles.satellite.maxUsefulZoom, 16);
  assert.equal(JSON.stringify(styles).includes('GEMINI'), false);
});

test('configured MapTiler tiles receive required provider attribution without persisting a credential', () => {
  const browserKey = ['public', 'browser', 'value'].join('-');
  const styles = createBasemapStyles({
    darkTiles: [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${browserKey}`],
    satelliteTiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${browserKey}`],
  });
  assert.match(styles.dark.style.sources.base.attribution, /MapTiler/);
  assert.match(styles.satellite.style.sources.base.attribution, /MapTiler/);
  assert.equal(styles.dark.style.metadata['shosholoza:provider'], 'configured');
  assert.equal(styles.satellite.style.metadata['shosholoza:provider'], 'configured');
  assert.equal(styles.hybrid.style.layers.find(layer => layer.id === 'hybrid-place-labels').paint['text-opacity'], 0.72);
});
