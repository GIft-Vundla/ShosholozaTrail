import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(name, ROOT), 'utf8'));
const haversine = (a, b) => {
  const rad = n => n * Math.PI / 180;
  const [lon1, lat1, lon2, lat2] = [a[0], a[1], b[0], b[1]].map(rad);
  const value = Math.sin((lat2-lat1)/2) ** 2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(value));
};

test('rail ride output is detailed, continuous and provenance-backed', async () => {
  const route = await load('data/route-ride.geojson');
  const provenance = await load('data/provenance/rail-alignment.json');
  const points = route.geometry.coordinates;
  assert.equal(route.geometry.type, 'LineString');
  assert.ok(points.length >= 40_000, `expected detailed ride path, got ${points.length}`);
  assert.deepEqual(route.properties.hubOrder, ['pretoria','johannesburg','kimberley','de-aar','beaufort-west','matjiesfontein','worcester','cape-town']);
  assert.equal(route.properties.segments.length, 7);
  assert.ok(route.properties.lengthMetres > 1_200_000 && route.properties.lengthMetres < 1_900_000,
    `implausible routed length ${route.properties.lengthMetres}`);
  let largestGap = 0;
  for (let i = 1; i < points.length; i++) largestGap = Math.max(largestGap, haversine(points[i-1], points[i]));
  assert.ok(largestGap <= 25, `ride path has ${largestGap.toFixed(2)} m discontinuity`);
  assert.equal(route.properties.railAlignmentVerified, true);
  assert.deepEqual(route.properties.unresolvedSegments, []);
  assert.equal(route.properties.resolvedSegments.length, 7);
  assert.equal(route.properties.stationAnchors.length, 8);
  assert.ok(provenance.acquisitions.every(item => item.query.includes('way["railway"="rail"]')));
  assert.ok(provenance.acquisitions.every(item => item.rawSha256?.length === 64));
  assert.ok(provenance.usedOsmWayIds.length > 100);
  for (const segment of route.properties.segments) {
    assert.ok(['osm-mapped-connected-candidate', 'unresolved-schematic-connector'].includes(segment.confidence));
    if (segment.confidence === 'unresolved-schematic-connector') assert.ok(segment.unresolvedReason);
    else assert.ok(segment.osmWayIds.length > 0);
    assert.ok(segment.startSnap.distanceMetres < 5000, `${segment.id} start snap is ${segment.startSnap.distanceMetres} m`);
    assert.ok(segment.endSnap.distanceMetres < 5000, `${segment.id} end snap is ${segment.endSnap.distanceMetres} m`);
    if (segment.precedingJunctionConnector) {
      assert.equal(segment.precedingJunctionConnector.confidence, 'unresolved-schematic-connector');
      assert.ok(segment.precedingJunctionConnector.lengthMetres > 0);
    }
  }
});

test('overview is simplified and the detailed ride is copied into the offline pack', async () => {
  const overview = await load('data/route.geojson');
  const ride = await load('data/route-ride.geojson');
  const publicRide = await load('public/data/route-ride.geojson');
  assert.ok(overview.geometry.coordinates.length >= 500 && overview.geometry.coordinates.length <= 2500,
    `overview point count ${overview.geometry.coordinates.length}`);
  assert.ok(overview.properties.segments.every(segment => segment.startIndex === undefined && segment.endIndex === undefined));
  assert.ok(ride.geometry.coordinates.length > overview.geometry.coordinates.length * 10);
  assert.deepEqual(publicRide, ride);
  const buildScript = await readFile(new URL('scripts/build-assets.mjs', ROOT), 'utf8');
  assert.match(buildScript, /cp\('data\/route-ride\.geojson', 'public\/data\/route-ride\.geojson'\)/);
  assert.doesNotMatch(buildScript, /file\.endsWith\('\/data\/route-ride\.geojson'\)/);
});

test('Hex River candidate contains curved mapped geometry', async () => {
  const route = await load('data/route-ride.geojson');
  const hex = route.geometry.coordinates.filter(([lon, lat]) => lon >= 19.35 && lon <= 19.85 && lat >= -33.75 && lat <= -33.35);
  assert.ok(hex.length > 1000, `only ${hex.length} Hex River points`);
  const direct = haversine(hex[0], hex.at(-1));
  let along = 0;
  for (let i = 1; i < hex.length; i++) along += haversine(hex[i-1], hex[i]);
  assert.ok(along / direct > 1.08, `Hex River sinuosity ${(along/direct).toFixed(3)} is too straight`);
});

test('legacy hub data uses the same eight route anchors and measured distances', async () => {
  const route = await load('data/route-ride.geojson');
  const hubs = await load('data/hubs.json');
  const source = await load('data/provenance/osm-stations-selected.json');
  assert.deepEqual(hubs.hubOrder, route.properties.hubOrder);
  assert.equal(hubs.stations.length, 8);
  assert.equal(hubs.triggerZones.length, 7);
  assert.equal(hubs.version, route.properties.routeVersion);
  assert.ok(source.records.some(record => record.hubId === 'johannesburg' && record.osmId === 326084268 && record.rawSha256.length === 64));
  assert.ok(Math.abs(hubs.triggerZones.at(-1).stationAlongMetres - route.properties.lengthMetres) < 2);
  assert.equal(hubs.stations.find(station => station.hubId === 'johannesburg').storyTriggerStatus, 'not-created-no-sourced-chapter');
  assert.ok(!hubs.triggerZones.some(zone => zone.hubId === 'johannesburg'));
});
