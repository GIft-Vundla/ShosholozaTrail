import test from 'node:test';
import assert from 'node:assert/strict';
import { STOPS } from '../app/src/data.ts';
import {
  buildRideWaypoints,
  addTerrainToSatelliteStyle,
  coordinateAtDistance,
  cumulativeDistances,
  describeRouteSource,
  readRideRoute,
} from '../app/src/ride-model.ts';

const fixture = {
  type: 'Feature',
  properties: {
    railAlignmentVerified: true,
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

test('ride route accepts explicitly verified rail alignment and rejects incomplete geometry', () => {
  assert.equal(readRideRoute(fixture).geometry.coordinates.length, 4);
  assert.throws(() => readRideRoute({
    ...fixture,
    properties: { railAlignmentVerified: false, confidence: 'unresolved-schematic' },
  }), /not verified rail alignment/);
  assert.throws(() => readRideRoute({
    ...fixture,
    properties: { ...fixture.properties, unresolvedSegments: ['gap'] },
  }), /not verified rail alignment/);
});

test('waypoints sample source geometry and add only nearby, unambiguous hub arrivals', () => {
  const route = readRideRoute(fixture);
  const waypoints = buildRideWaypoints(route, STOPS, 2_000);
  assert.ok(waypoints.length > 20);
  assert.equal(waypoints[0].hubId, 'pretoria');
  assert.equal(waypoints.at(-1)?.hubId, 'johannesburg');
  assert.deepEqual([...new Set(waypoints.flatMap(point => point.hubId ? [point.hubId] : []))], ['pretoria', 'johannesburg']);
  assert.ok(waypoints.slice(1).every((point, index) => point.distanceMetres > waypoints[index].distanceMetres));
});

test('distance interpolation stays on source segments and source status uses feature properties', () => {
  const route = readRideRoute(fixture);
  const cumulative = cumulativeDistances(route.geometry.coordinates);
  const midpoint = coordinateAtDistance(route.geometry.coordinates, cumulative, cumulative.at(-1)! / 2);
  assert.ok(midpoint[0] <= 28.19 && midpoint[0] >= 28.05);
  assert.ok(midpoint[1] <= -25.75 && midpoint[1] >= -26.2);
  assert.equal(describeRouteSource(route), 'Mapped rail geometry / osm resolved / 1 resolved');
});

test('satellite ride style keeps its imagery and receives the terrain DEM source', () => {
  const satellite = { version: 8, sources: { base: { type: 'raster', tiles: ['imagery'] } }, layers: [] };
  const outdoor = { sources: { elevation: { type: 'raster-dem', tiles: ['terrain'], encoding: 'terrarium' } } };
  const result = addTerrainToSatelliteStyle(satellite, outdoor);
  assert.deepEqual(result.sources.base, satellite.sources.base);
  assert.deepEqual((result.sources as Record<string, unknown>).elevation, outdoor.sources.elevation);
  assert.equal('elevation' in satellite.sources, false);
});
