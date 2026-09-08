import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createJourneyEngine, ENGINE_VERSION } from '../public/engine/journey.js';
import { createReplaySource, parseTrace } from '../public/engine/replay.js';
import { along } from '../public/vendor/turf.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const traceDir = resolve(root, 'data/traces');
const metresPerDegree = Math.PI * 6371008.8 / 180;
// Analytic equatorial fixture: no engine projection/intersection function generates labels.
const syntheticRoute = { type: 'Feature', properties: { version: 'synthetic-equator-v1', provenance: 'synthetic',
  notes: 'Equatorial laboratory line; not South African rail geometry or field data.' },
  geometry: { type: 'LineString', coordinates: [[0, 0], [0.4, 0]] } };
const zones = Array.from({ length: 7 }, (_, i) => ({ hubId: `synthetic-hub-${i + 1}`, sEnter: (i + 1) * 5000, sExit: (i + 1) * 5000 + 20 }));
function fix(s, t) { return { lat: 0, lon: s / metresPerDegree, accuracy: 5, t }; }

export async function generateFixtures() {
  await mkdir(traceDir, { recursive: true });
  await writeFile(resolve(traceDir, 'synthetic-route.json'), JSON.stringify({ route: syntheticRoute, zones }, null, 2) + '\n');
  for (const speedKmh of [40, 80, 120]) for (const sampleGapS of [1, 5, 15]) for (const direction of [-1, 1]) {
    const step = speedKmh / 3.6 * sampleGapS;
    for (const zone of zones) {
      const traceId = `synthetic-${speedKmh}kph-${sampleGapS}s-${direction === 1 ? 'forward' : 'reverse'}-${zone.hubId}`;
      const start = direction === 1 ? zone.sEnter - 1.5 * step : zone.sExit + 1.5 * step;
      const header = { traceId, provenance: 'synthetic', speedKmh, sampleGapS, direction,
        routeVersion: syntheticRoute.properties.version, expectedHubIds: [zone.hubId],
        notes: 'One independently prescribed passage across a 20 m interval. Five analytic equatorial fixes; no field claims.' };
      const rows = [header, ...Array.from({ length: 5 }, (_, i) => fix(start + direction * step * i, 1700000000000 + i * sampleGapS * 1000))];
      await writeFile(resolve(traceDir, traceId + '.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    }
  }
  const t = 1700000000000;
  const demo = { header: { traceId: 'synthetic-equatorial-delay-demo', provenance: 'synthetic',
    notes: 'Equatorial laboratory fixture, not corridor travel. Movement, nine minutes stationary, then movement. Use rate 60 for demonstration.' },
    route: syntheticRoute, zones,
    fixes: [fix(4800, t), fix(4860, t + 10000), fix(4920, t + 20000), fix(5005, t + 30000),
      ...Array.from({ length: 19 }, (_, i) => fix(5005, t + 60000 + i * 30000)),
      fix(5250, t + 630000), fix(5500, t + 660000)] };
  await writeFile(resolve(traceDir, 'demo.json'), JSON.stringify(demo, null, 2) + '\n');
}

export async function runTraces() {
  const fixture = JSON.parse(await readFile(resolve(traceDir, 'synthetic-route.json'), 'utf8'));
  const result = { requirement: 'R3', status: 'RUNNING', executionScope: 'synthetic-laboratory-component',
    runner: 'harness/run-traces.js', traceCount: 0,
    eligible: 0, fired: 0, correctHub: 0, wrongHub: 0, duplicates: 0, missed: 0,
    byProfile: {}, generatedAt: null, engineVersion: ENGINE_VERSION,
    routeVersion: fixture.route.properties.version, provenance: 'synthetic',
    acceptance: { minimumEligible: 100, minimumCorrectFraction: 0.95, maximumWrongHub: 0, maximumDuplicates: 0 },
    limitations: ['Analytic equatorial laboratory geometry only; no corridor geometry or phone GPS validation.',
      'Synthetic trace performance does not establish real-device or relevant-environment TRL 5.'], encounters: [], failures: [] };
  for (const name of (await readdir(traceDir)).filter(name => name.endsWith('.jsonl')).sort()) {
    result.traceCount += 1;
    const trace = parseTrace(await readFile(resolve(traceDir, name), 'utf8'));
    const expected = trace.header.expectedHubIds;
    if (!Array.isArray(expected) || !expected.length || new Set(expected).size !== expected.length) throw new Error(`Independent unique expectedHubIds missing in ${name}`);
    if (trace.header.routeVersion !== fixture.route.properties.version) throw new Error(`Route version mismatch in ${name}; provide its own reviewed fixture and oracle`);
    const events = [];
    const engine = createJourneyEngine({ route: fixture.route, zones: fixture.zones, onEvent: event => events.push(event) });
    await createReplaySource(trace).replayAll(fix => engine.push(fix));
    const fired = events.filter(event => event.type === 'encounter' && event.fired);
    const counts = new Map();
    for (const event of fired) counts.set(event.hubId, (counts.get(event.hubId) ?? 0) + 1);
    const correctHub = expected.filter(id => counts.has(id)).length;
    const wrongHub = fired.filter(event => !expected.includes(event.hubId)).length;
    const duplicates = [...counts.values()].reduce((sum, value) => sum + Math.max(0, value - 1), 0);
    const metrics = { eligible: expected.length, fired: fired.length, correctHub, wrongHub, duplicates, missed: expected.length - correctHub };
    const profile = `${trace.header.speedKmh}kmh/${trace.header.sampleGapS}s/${trace.header.direction === 1 ? 'forward' : 'reverse'}`;
    result.byProfile[profile] ??= { eligible: 0, fired: 0, correctHub: 0, wrongHub: 0, duplicates: 0, missed: 0 };
    for (const key of Object.keys(metrics)) { result[key] += metrics[key]; result.byProfile[profile][key] += metrics[key]; }
    result.encounters.push(...events.filter(event => event.type === 'encounter').map(event => ({ ...event, correctHub: expected.includes(event.hubId) })));
    if (metrics.missed || wrongHub || duplicates) result.failures.push({ traceId: trace.header.traceId, expected, actual: fired.map(event => event.hubId), ...metrics });
  }
  result.correctFraction = result.eligible ? result.correctHub / result.eligible : null;
  result.passed = result.eligible >= 100 && result.correctFraction >= 0.95 && result.wrongHub === 0 && result.duplicates === 0;
  result.status = result.passed ? 'PASS' : 'FAIL';
  result.generatedAt = new Date().toISOString();
  await mkdir(resolve(root, 'results'), { recursive: true });
  await writeFile(resolve(root, 'results/r3.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

export async function generateCorridorDemo() {
  const route = JSON.parse(await readFile(resolve(root, 'data/route.geojson'), 'utf8'));
  const hubs = JSON.parse(await readFile(resolve(root, 'data/hubs.json'), 'utf8'));
  const zone = hubs.triggerZones.find(zone => zone.hubId === 'matjiesfontein');
  if (!zone) throw new Error('Matjiesfontein trigger required for corridor demo');
  const start = zone.sEnter - 300, stoppedAt = zone.sEnter + 300, t = 1700000000000;
  const at = (s, time) => {
    const [lon, lat] = along(route, s, { units: 'meters' }).geometry.coordinates;
    return { lat, lon, t: time, accuracy: 5 };
  };
  const trace = { header: { traceId: 'synthetic-matjiesfontein-delay-v1', provenance: 'synthetic',
    routeVersion: route.properties.routeVersion ?? route.properties.version, confidence: route.properties.confidence,
    notes: 'Authored demonstration near Matjiesfontein on the automated OSM rail candidate. Not measured rail travel or a field test. Movement, nine stationary minutes, then resumed movement.' },
    fixes: [at(start, t), at(start + 200, t + 10000), at(start + 400, t + 20000), at(stoppedAt, t + 30000),
      ...Array.from({ length: 19 }, (_, i) => at(stoppedAt, t + 60000 + i * 30000)),
      at(stoppedAt + 300, t + 630000), at(stoppedAt + 600, t + 660000)] };
  const events = [];
  const engine = createJourneyEngine({ route, zones: hubs.triggerZones, onEvent: event => events.push(event) });
  await createReplaySource(trace).replayAll(fix => engine.push(fix));
  if (!events.some(e => e.type === 'state' && e.to === 'waiting') ||
      !events.some(e => e.type === 'state' && e.from === 'waiting' && e.to === 'moving') ||
      !events.some(e => e.type === 'encounter' && e.hubId === 'matjiesfontein' && e.fired)) {
    throw new Error('Corridor demonstration did not produce the required real engine events');
  }
  await writeFile(resolve(traceDir, 'demo-corridor.json'), JSON.stringify(trace, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--generate')) await generateFixtures();
  if (process.argv.includes('--generate-demo')) await generateCorridorDemo();
  const result = await runTraces();
  console.log(JSON.stringify({ eligible: result.eligible, correctHub: result.correctHub, wrongHub: result.wrongHub,
    duplicates: result.duplicates, missed: result.missed, passed: result.passed, provenance: result.provenance }));
  if (!result.passed) process.exitCode = 1;
}
