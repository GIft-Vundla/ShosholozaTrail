import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createJourneyEngine, ENGINE_VERSION } from '../public/engine/journey.js';
import { along } from '../public/vendor/turf.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routeBytes = await readFile(resolve(root, 'data/route.geojson'));
const route = JSON.parse(routeBytes.toString('utf8'));
const hubs = JSON.parse(await readFile(resolve(root, 'data/hubs.json'), 'utf8'));

if (route.properties.railAlignmentVerified !== true || route.properties.unresolvedSegments.length) {
  throw new Error('Corridor traces require a fully connected mapped rail candidate.');
}
if (hubs.version !== route.properties.routeVersion) throw new Error('Hub and route versions differ.');

const result = {
  requirement: 'R3-corridor',
  status: 'RUNNING',
  executionScope: 'synthetic-traces-on-shipped-osm-corridor',
  runner: 'harness/run-corridor-traces.js',
  traceCount: 0,
  eligible: 0,
  fired: 0,
  correctHub: 0,
  wrongHub: 0,
  duplicates: 0,
  missed: 0,
  generatedAt: null,
  engineVersion: ENGINE_VERSION,
  routeVersion: route.properties.routeVersion,
  routeSha256: createHash('sha256').update(routeBytes).digest('hex'),
  provenance: 'synthetic positions sampled from the shipped OSM rail candidate',
  acceptance: { minimumEligible: 100, minimumCorrectFraction: 0.95, maximumWrongHub: 0, maximumDuplicates: 0 },
  limitations: [
    'Positions are generated from mapped corridor geometry; they are not phone GPS or field observations.',
    'This verifies trigger behavior on the shipped curved alignment and does not establish operational passenger service or TRL 5.',
  ],
  byProfile: {},
  failures: [],
};

const routeLength = route.properties.lengthMetres;
const pointAt = metres => {
  const [lon, lat] = along(route, Math.max(0, Math.min(routeLength, metres)), { units: 'meters' }).geometry.coordinates;
  return { lat, lon };
};

for (const speedKmh of [40, 80, 120]) {
  for (const sampleGapS of [1, 5, 15]) {
    for (const direction of [-1, 1]) {
      const profile = `${speedKmh}kmh/${sampleGapS}s/${direction === 1 ? 'forward' : 'reverse'}`;
      result.byProfile[profile] = { eligible: 0, fired: 0, correctHub: 0, wrongHub: 0, duplicates: 0, missed: 0 };
      const step = speedKmh / 3.6 * sampleGapS;
      for (const zone of hubs.triggerZones) {
        result.traceCount += 1;
        result.eligible += 1;
        result.byProfile[profile].eligible += 1;
        const boundary = direction === 1 ? zone.sEnter : zone.sExit;
        const positions = [-1.5, -.5, .5, 1.5, 2.5].map(offset => boundary + direction * offset * step);
        const traceId = `corridor-${zone.hubId}-${speedKmh}-${sampleGapS}-${direction}`;
        const fixes = positions.map((distance, index) => ({
          ...pointAt(distance),
          accuracy: 5,
          t: 1_700_000_000_000 + index * sampleGapS * 1000,
          source: 'replay',
          traceId,
        }));
        const events = [];
        const engine = createJourneyEngine({ route, zones: hubs.triggerZones, onEvent: event => events.push(event) });
        for (const fix of fixes) await engine.push(fix);
        const fired = events.filter(event => event.type === 'encounter' && event.fired);
        const correct = fired.filter(event => event.hubId === zone.hubId).length;
        const wrong = fired.filter(event => event.hubId !== zone.hubId).length;
        const duplicates = Math.max(0, correct - 1);
        const missed = correct ? 0 : 1;
        const metrics = { fired: fired.length, correctHub: Math.min(1, correct), wrongHub: wrong, duplicates, missed };
        for (const key of Object.keys(metrics)) {
          result[key] += metrics[key];
          result.byProfile[profile][key] += metrics[key];
        }
        if (wrong || duplicates || missed) result.failures.push({ hubId: zone.hubId, profile, actual: fired.map(event => event.hubId), ...metrics });
      }
    }
  }
}

result.correctFraction = result.correctHub / result.eligible;
result.passed = result.eligible >= 100 && result.correctFraction >= .95 && result.wrongHub === 0 && result.duplicates === 0;
result.status = result.passed ? 'PASS' : 'FAIL';
result.generatedAt = new Date().toISOString();
await mkdir(resolve(root, 'results'), { recursive: true });
await writeFile(resolve(root, 'results/r3-corridor.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ eligible: result.eligible, correctHub: result.correctHub, wrongHub: result.wrongHub,
  duplicates: result.duplicates, missed: result.missed, passed: result.passed, routeVersion: result.routeVersion }));
if (!result.passed) process.exitCode = 1;
