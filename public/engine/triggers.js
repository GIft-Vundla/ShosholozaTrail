export function crossingZones(previous, current, zones) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return [];
  const low = Math.min(previous, current), high = Math.max(previous, current);
  return zones.filter(zone => low <= zone.sExit && high >= zone.sEnter)
    .sort((a, b) => current >= previous ? a.sEnter - b.sEnter : b.sExit - a.sExit);
}

export function validateZones(zones) {
  const ids = new Set();
  for (const zone of zones) {
    if (!zone.hubId || ids.has(zone.hubId) || !Number.isFinite(zone.sEnter) ||
      !Number.isFinite(zone.sExit) || zone.sEnter < 0 || zone.sExit < zone.sEnter) {
      throw new Error('Trigger zones require unique hubId and ordered non-negative metre intervals');
    }
    ids.add(zone.hubId);
  }
}
