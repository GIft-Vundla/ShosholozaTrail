// Reuse the MapLibre build already vendored at /vendor/maplibre-gl/maplibre-gl.js
// and loaded as a classic script by index.html. Classic scripts run before
// module scripts, so the global exists by the time this module evaluates.
// Without this alias the library ships twice: once bundled into the React
// chunk and once as the vendored file the engine app under /app depends on.
type MapLibreGlobal = typeof import('maplibre-gl');

const maplibregl = (globalThis as unknown as { maplibregl?: MapLibreGlobal }).maplibregl;

export default maplibregl as MapLibreGlobal;
