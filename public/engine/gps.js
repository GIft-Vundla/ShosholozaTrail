export function createGpsSource({ geolocation = globalThis.navigator?.geolocation, onError = () => {}, sampleIntervalMs = 1000 } = {}) {
  let watchId = null, consume = null, lastDelivered = -Infinity, interval = sampleIntervalMs;
  const source = {
    source: 'gps',
    start(callback) {
      source.stop(); consume = callback; lastDelivered = -Infinity;
      if (!geolocation) { onError(new Error('Geolocation is unavailable')); return; }
      watchId = geolocation.watchPosition(position => {
        if (position.timestamp - lastDelivered < interval) return;
        lastDelivered = position.timestamp;
        Promise.resolve(consume({ lat: position.coords.latitude, lon: position.coords.longitude,
          accuracy: position.coords.accuracy, t: position.timestamp, source: 'gps' })).catch(onError);
      }, onError, { enableHighAccuracy: interval < 30000, maximumAge: interval, timeout: 60000 });
    },
    setSampleInterval(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 1000) throw new Error('Sampling interval must be at least one second');
      interval = milliseconds;
      if (watchId !== null) { const callback = consume; source.start(callback); }
    },
    stop() { if (watchId !== null) geolocation.clearWatch(watchId); watchId = null; },
  };
  return source;
}
