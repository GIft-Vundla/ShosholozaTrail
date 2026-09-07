const DWELL_MS = 8 * 60 * 1000;
function median(values) {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function initialMotion() {
  return { state: 'unknown', recent: [], stationary: [], exitStreak: 0, waitingSince: null, movementAnchor: null, acceptedCount: 0 };
}

export function advanceMotion(previous, fix) {
  const motion = structuredClone(previous);
  if (motion.state === 'offRoute') Object.assign(motion, initialMotion());
  const last = motion.recent.at(-1);
  const delta = last ? Math.abs(fix.s - last.s) : 0;
  // Observation gaps cannot substantiate an uninterrupted stationary interval.
  if (last && fix.t - last.t > 120000) {
    Object.assign(motion, initialMotion());
  }
  motion.recent.push({ s: fix.s, t: fix.t });
  motion.recent = motion.recent.slice(-3);
  motion.movementAnchor ??= fix.s;
  motion.acceptedCount++;
  if (motion.state === 'unknown' && motion.acceptedCount >= 3 &&
      Math.abs(fix.s - motion.movementAnchor) > 100) motion.state = 'moving';

  if (motion.state === 'waiting') {
    motion.exitStreak = delta > 200 ? motion.exitStreak + 1 : 0;
    if (motion.exitStreak >= 2) {
      motion.state = 'moving';
      motion.waitingSince = null;
      motion.stationary = [];
      motion.exitStreak = 0;
    }
  } else {
    if (!motion.stationary.length && last && fix.t - last.t <= 120000) motion.stationary.push(last);
    motion.stationary.push({ s: fix.s, t: fix.t });
    const positions = motion.stationary.map(value => value.s);
    // A small per-fix delta alone also describes a fast train sampled frequently.
    // Require a <100 m observation envelope before describing a stationary stop.
    if (Math.max(...positions) - Math.min(...positions) >= 100) motion.stationary = [{ s: fix.s, t: fix.t }];
    const changes = motion.stationary.slice(1).map((value, index) => Math.abs(value.s - motion.stationary[index].s));
    if (motion.state === 'moving' && changes.length && median(changes) < 50 &&
        fix.t - motion.stationary[0].t > DWELL_MS) {
      motion.state = 'waiting';
      motion.waitingSince = motion.stationary[0].t;
    }
    // Keep memory bounded without discarding the eight-minute proof window.
    while (motion.stationary.length > 2 && fix.t - motion.stationary[1].t > DWELL_MS + 120000) motion.stationary.shift();
  }
  return motion;
}
