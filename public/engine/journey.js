import { nearestPointOnLine, point, distance } from '../vendor/turf.js';
import { crossingZones, validateZones } from './triggers.js';
import { initialMotion, advanceMotion } from './state.js';

export const ENGINE_VERSION = '1.0.0';
export function createJourneyEngine({ route, zones, fired = [], queue = [], onEvent = () => {}, onState = () => {}, persist }) {
  validateZones(zones);
  if ((route.geometry ?? route).type !== 'LineString') throw new Error('Journey route must be a GeoJSON LineString');
  let model = { fired: [...new Set(fired)], queue: [...new Set(queue)], lastAccepted: null,
    lastInputTime: null, motion: initialMotion(), continuity: false, source: null, traceId: null };
  let serial = Promise.resolve();
  const snapshot = () => structuredClone({ ...model, state: model.motion.state, waitingSince: model.motion.waitingSince, engineVersion: ENGINE_VERSION });
  function notify(callback, value) { try { callback(value); } catch { /* Observers cannot undo a committed transaction. */ } }
  async function commit(next, events) {
    const before = model.motion.state;
    const payload = structuredClone({ ...next, state: next.motion.state, waitingSince: next.motion.waitingSince, engineVersion: ENGINE_VERSION });
    if (persist) await persist(payload, structuredClone(events));
    model = next;
    for (const event of events) notify(onEvent, event);
    if (before !== model.motion.state) notify(onState, payload);
    return snapshot();
  }
  async function consume(fix) {
    const next = structuredClone(model), events = [];
    const base = { t: fix?.t, source: fix?.source, traceId: fix?.traceId ?? null };
    const reject = async reason => {
      events.push({ type: 'rejected', reason, ...base });
      return commit(next, events);
    };
    if (!fix || !Number.isFinite(fix.lat) || Math.abs(fix.lat) > 90 ||
      !Number.isFinite(fix.lon) || Math.abs(fix.lon) > 180 || !Number.isFinite(fix.t) ||
      !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || !['gps', 'replay'].includes(fix.source)) return reject('invalid');
    if (next.source && (next.source !== fix.source || next.traceId !== (fix.traceId ?? null))) {
      if (next.motion.state === 'waiting') events.push({ type: 'state', from: 'waiting', to: 'unknown', reason: 'sourceChanged',
        durationMs: next.lastAccepted.t - next.motion.waitingSince, ...base });
      next.lastAccepted = null;
      next.lastInputTime = null;
      next.continuity = false;
      next.motion = initialMotion();
    }
    if (next.lastInputTime !== null && fix.t <= next.lastInputTime) return reject('outOfOrder');
    next.lastInputTime = fix.t;
    next.source = fix.source;
    next.traceId = fix.traceId ?? null;
    const projected = nearestPointOnLine(route, point([fix.lon, fix.lat]), { units: 'meters' });
    const s = projected.properties.location, distToLine = projected.properties.dist;
    if (!Number.isFinite(s) || !Number.isFinite(distToLine)) return reject('projection');
    if (distToLine > 2000) {
      events.push({ type: 'state', from: next.motion.state, to: 'offRoute',
        durationMs: next.motion.state === 'waiting' ? next.lastAccepted.t - next.motion.waitingSince : null, ...base });
      next.motion = { ...initialMotion(), state: 'offRoute' };
      next.continuity = false;
      return reject('offRoute');
    }
    const previous = next.lastAccepted;
    const gap = previous ? (fix.t - previous.t) / 1000 : null;
    const speed = previous ? distance(point([previous.lon, previous.lat]), point([fix.lon, fix.lat]), { units: 'kilometers' }) / (gap / 3600) : 0;
    const alongSpeed = previous ? Math.abs(s - previous.s) / gap * 3.6 : 0;
    if (speed > 200 || alongSpeed > 200) return reject('implausible');
    const accepted = { ...fix, s, distToLine };
    const oldState = next.motion.state, oldWaitingSince = next.motion.waitingSince;
    next.motion = advanceMotion(next.motion, accepted);
    if (oldState !== next.motion.state) events.push({ type: 'state', from: oldState, to: next.motion.state,
      waitingSince: next.motion.waitingSince, durationMs: oldState === 'waiting' ? fix.t - oldWaitingSince : null, ...base });
    if (previous && next.continuity) {
      for (const zone of crossingZones(previous.s, s, zones)) {
        const alreadyFired = next.fired.includes(zone.hubId);
        const event = { type: 'encounter', hubId: zone.hubId, fired: !alreadyFired, eligible: !alreadyFired,
          correctHub: null, duplicate: false, suppressedRepeat: alreadyFired, speed: alongSpeed,
          sampleGap: gap, direction: Math.sign(s - previous.s), ...base };
        events.push(event);
        if (!alreadyFired) { next.fired.push(zone.hubId); next.queue.push(zone.hubId); }
      }
    }
    next.lastAccepted = accepted;
    next.continuity = true;
    events.push({ type: 'position', s, distToLine, speed: alongSpeed, state: next.motion.state, ...base });
    return commit(next, events);
  }
  const enqueue = operation => {
    const result = serial.then(operation);
    serial = result.catch(() => {});
    return result;
  };
  return {
    push: fix => enqueue(() => consume(fix)), snapshot,
    acknowledgeChapter: hubId => enqueue(async () => {
      const next = structuredClone(model);
      next.queue = next.queue.filter(id => id !== hubId);
      return commit(next, [{ type: 'chapterAcknowledged', hubId }]);
    }),
  };
}
