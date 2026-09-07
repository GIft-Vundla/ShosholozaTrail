import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyEngine } from '../public/engine/journey.js';
import { crossingZones } from '../public/engine/triggers.js';
import { createReplaySource, parseTrace } from '../public/engine/replay.js';
import { createGpsSource } from '../public/engine/gps.js';
const scale = Math.PI * 6371008.8 / 180;
const route = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] } };
const zones = [{ hubId: 'a', sEnter: 1000, sExit: 1020 }, { hubId: 'b', sEnter: 1500, sExit: 1520 }];
const fix = (s, t, other = {}) => ({ lat: 0, lon: s / scale, t, accuracy: 5, source: 'replay', traceId: 'test', ...other });
function setup(options = {}) { const events = []; return { events, engine: createJourneyEngine({ route, zones, onEvent: e => events.push(e), ...options }) }; }

test('segment crossing covers complete intervals, boundaries and reverse order', () => {
  assert.deepEqual(crossingZones(900, 1700, zones).map(z => z.hubId), ['a', 'b']);
  assert.deepEqual(crossingZones(1700, 900, zones).map(z => z.hubId), ['b', 'a']);
  assert.equal(crossingZones(900, 1000, zones).length, 1);
});
test('first fix is a baseline; queue survives repeated entry and acknowledgements', async () => {
  const { engine, events } = setup();
  await engine.push(fix(900, 0));
  await engine.push(fix(1600, 15000));
  await engine.push(fix(900, 30000));
  assert.deepEqual(engine.snapshot().queue, ['a', 'b']);
  assert.equal(events.filter(e => e.fired).length, 2);
  assert.ok(events.some(e => e.suppressedRepeat));
  await engine.acknowledgeChapter('a');
  assert.deepEqual(engine.snapshot().queue, ['b']);
});
test('invalid, out-of-order and implausible fixes never award', async () => {
  const { engine, events } = setup();
  await engine.push(fix(900, 1000));
  await engine.push(fix(1200, 1000));
  await engine.push(fix(1200, 1100));
  await engine.push(fix(1200, 2000, { lat: NaN }));
  assert.deepEqual(engine.snapshot().fired, []);
  assert.deepEqual(events.filter(e => e.type === 'rejected').map(e => e.reason), ['outOfOrder', 'implausible', 'invalid']);
});
test('off-route fixes reject and re-entry does not bridge unknown travel', async () => {
  const { engine } = setup();
  await engine.push(fix(900, 0));
  await engine.push(fix(1000, 10000, { lat: 0.03 }));
  assert.equal(engine.snapshot().state, 'offRoute');
  await engine.push(fix(1600, 30000));
  assert.deepEqual(engine.snapshot().fired, []);
});
test('persistence failure preserves old committed state; reload suppresses awards', async () => {
  let fail = false, saved;
  const { engine } = setup({ persist: async snapshot => { if (fail) throw new Error('quota'); saved = snapshot; } });
  await engine.push(fix(900, 0)); fail = true;
  await assert.rejects(engine.push(fix(1100, 10000)), /quota/);
  assert.deepEqual(engine.snapshot().fired, []);
  fail = false; await engine.push(fix(1100, 10000));
  const reloaded = setup({ fired: saved.fired, queue: saved.queue });
  await reloaded.engine.push(fix(900, 20000)); await reloaded.engine.push(fix(1100, 30000));
  assert.equal(reloaded.events.filter(e => e.fired).length, 0);
  assert.deepEqual(reloaded.engine.snapshot().queue, ['a']);
});
test('concurrent submissions serialize persistence and award only once', async () => {
  const { engine, events } = setup({ persist: async () => new Promise(resolve => setTimeout(resolve, 1)) });
  await Promise.all([engine.push(fix(900, 0)), engine.push(fix(1100, 10000)), engine.push(fix(900, 20000))]);
  assert.equal(events.filter(e => e.fired).length, 1);
});
test('moving train sampled every second never becomes waiting', async () => {
  const { engine } = setup();
  for (let i = 0; i <= 600; i++) await engine.push(fix(i * (120 / 3.6), i * 1000));
  assert.equal(engine.snapshot().state, 'moving');
});
test('stationary jitter enters waiting only after eight minutes; two moving fixes exit', async () => {
  const { engine, events } = setup();
  await engine.push(fix(0, 0)); await engine.push(fix(60, 10000)); await engine.push(fix(120, 20000));
  assert.equal(engine.snapshot().state, 'moving');
  for (let i = 1; i <= 16; i++) await engine.push(fix(120 + (i % 2), 20000 + i * 30000));
  assert.equal(engine.snapshot().state, 'moving');
  await engine.push(fix(120, 530000));
  assert.equal(engine.snapshot().state, 'waiting');
  await engine.push(fix(350, 560000)); assert.equal(engine.snapshot().state, 'waiting');
  await engine.push(fix(600, 590000)); assert.equal(engine.snapshot().state, 'moving');
  assert.ok(events.some(e => e.type === 'state' && e.from === 'waiting' && e.durationMs === 570000));
});
test('a long observation gap cannot count as stationary evidence', async () => {
  const { engine } = setup();
  await engine.push(fix(0, 0)); await engine.push(fix(60, 10000)); await engine.push(fix(120, 20000));
  await engine.push(fix(120, 700000));
  assert.equal(engine.snapshot().state, 'unknown');
});
test('switching position sources resets clock/continuity but retains journey awards', async () => {
  const { engine, events } = setup();
  await engine.push(fix(900, 10000)); await engine.push(fix(1100, 20000));
  await engine.push(fix(1600, 0, { traceId: 'new-stream' }));
  assert.deepEqual(engine.snapshot().fired, ['a']);
  assert.equal(engine.snapshot().lastAccepted.t, 0);
  assert.equal(events.filter(e => e.reason === 'outOfOrder').length, 0);
});
test('GPS and replay sources emit the same input contract', async () => {
  const seen = [];
  const trace = parseTrace(JSON.stringify({ traceId: 'fixture', provenance: 'synthetic' }) + '\n' + JSON.stringify(fix(0, 0)));
  await createReplaySource(trace).replayAll(value => seen.push(value));
  assert.equal(seen[0].source, 'replay'); assert.equal(seen[0].traceId, 'fixture');
  let callback, cleared = 0;
  const gps = createGpsSource({ geolocation: { watchPosition(cb) { callback = cb; return 1; }, clearWatch() { cleared++; } } });
  gps.start(value => seen.push(value));
  callback({ coords: { latitude: 0, longitude: 0, accuracy: 10 }, timestamp: 1000 });
  assert.equal(seen.at(-1).source, 'gps');
  gps.setSampleInterval(30000); gps.stop(); assert.equal(cleared, 2);
});
