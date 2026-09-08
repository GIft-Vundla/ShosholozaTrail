import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('headline R3 evidence covers the shipped OSM rail candidate', async () => {
  const result = JSON.parse(await readFile(new URL('../results/r3.json', import.meta.url), 'utf8'));
  const routeBytes = await readFile(new URL('../data/route.geojson', import.meta.url));
  const route = JSON.parse(routeBytes.toString('utf8'));
  assert.equal(result.requirement, 'R3');
  assert.equal(result.executionScope, 'synthetic-traces-on-shipped-osm-rail-candidate');
  assert.equal(result.routeVersion, route.properties.routeVersion);
  assert.equal(result.routeSha256, createHash('sha256').update(routeBytes).digest('hex'));
  assert.equal(result.routePointCount, route.geometry.coordinates.length);
  assert.equal(result.routeLengthMetres, route.properties.lengthMetres);
  assert.equal(result.passed, true);
  assert.ok(result.eligible >= 100);
  assert.equal(result.correctHub, result.eligible);
  assert.equal(result.wrongHub, 0);
  assert.equal(result.duplicates, 0);
  assert.equal(result.missed, 0);
  assert.match(result.provenance, /shipped OSM rail candidate/);
  assert.ok(result.limitations.some(value => value.includes('not phone GPS')));
});
