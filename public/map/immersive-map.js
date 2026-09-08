const EARTH_RADIUS_METRES = 6371008.8;
const DEFAULT_CENTER = [23.31, -30.03];

const ATTRIBUTION = Object.freeze({
  osm: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
  topo: 'Map style: <a href="https://opentopomap.org" target="_blank" rel="noopener">© OpenTopoMap</a>',
  eox: 'Imagery: <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (modified Copernicus Sentinel data 2025)',
  eoxOverlay: 'Labels: <a href="https://maps.eox.at" target="_blank" rel="noopener">© EOX and MapServer</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
});

const BACKGROUNDS = Object.freeze({
  streets: '#d8ded5', outdoor: '#c9d7bc', dark: '#081611', satellite: '#101918', hybrid: '#101918', offline: '#102820',
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function rad(value) { return value * Math.PI / 180; }
function deg(value) { return value * 180 / Math.PI; }

export function haversineMetres(a, b) {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function bearingBetween(from, to) {
  const lon = rad(to[0] - from[0]), lat1 = rad(from[1]), lat2 = rad(to[1]);
  const y = Math.sin(lon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function smoothBearing(previous, next, factor = 0.28) {
  if (!Number.isFinite(previous)) return ((next % 360) + 360) % 360;
  const delta = ((next - previous + 540) % 360) - 180;
  return (previous + delta * clamp(factor, 0, 1) + 360) % 360;
}

export function sliceLineAtDistance(route, targetMetres) {
  const coordinates = route?.geometry?.coordinates ?? route?.coordinates ?? [];
  if (!coordinates.length) return [];
  if (coordinates.length === 1) return [coordinates[0]];
  const lengths = coordinates.slice(1).map((point, index) => haversineMetres(coordinates[index], point));
  const measuredTotal = lengths.reduce((sum, length) => sum + length, 0);
  const declaredTotal = Number(route?.properties?.lengthMetres) || measuredTotal || 1;
  const target = clamp(Number(targetMetres) || 0, 0, declaredTotal) / declaredTotal * measuredTotal;
  const result = [coordinates[0]];
  let travelled = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const length = lengths[index - 1];
    if (travelled + length <= target) {
      result.push(coordinates[index]);
      travelled += length;
      continue;
    }
    const fraction = length ? clamp((target - travelled) / length, 0, 1) : 0;
    const from = coordinates[index - 1], to = coordinates[index];
    result.push([from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]);
    break;
  }
  return result;
}

function rasterSource(tiles, attribution, maxzoom = 19, tileSize = 256) {
  return { type: 'raster', tiles: Array.isArray(tiles) ? tiles : [tiles], tileSize, maxzoom, attribution };
}

function rasterStyle(id, sources, layers, metadata = {}) {
  return {
    version: 8,
    name: `Shosholoza ${id}`,
    metadata: { 'shosholoza:basemap': id, ...metadata },
    sources,
    layers: [
      { id: 'canvas', type: 'background', paint: { 'background-color': BACKGROUNDS[id] ?? BACKGROUNDS.offline } },
      ...layers,
    ],
  };
}

function configuredAttribution(tiles, fallback) {
  const urls = Array.isArray(tiles) ? tiles : [tiles];
  if (urls.some(url => String(url).includes('api.maptiler.com'))) {
    return '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';
  }
  return fallback;
}

/**
 * Returns self-contained MapLibre style objects. Tile URLs may be replaced at
 * runtime, including with a restricted MapTiler URL supplied by the caller.
 * No credentials are read from localStorage or embedded in the source tree.
 */
export function createBasemapStyles(config = {}) {
  const streetsTiles = config.streetsTiles ?? ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
  const outdoorTiles = config.outdoorTiles ?? [
    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
  ];
  // CARTO's anonymous raster service now adds an API-key watermark. Reuse the
  // standard OSM raster with a restrained night treatment for a keyless view.
  const darkTiles = config.darkTiles ?? streetsTiles;
  const satelliteTiles = config.satelliteTiles ?? [
    'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg',
    'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg',
    'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg',
  ];
  const hybridLabelTiles = config.hybridLabelTiles ?? [
    'https://a.tiles.maps.eox.at/wmts/1.0.0/overlay_3857/default/g/{z}/{y}/{x}.png',
    'https://b.tiles.maps.eox.at/wmts/1.0.0/overlay_3857/default/g/{z}/{y}/{x}.png',
    'https://c.tiles.maps.eox.at/wmts/1.0.0/overlay_3857/default/g/{z}/{y}/{x}.png',
  ];
  const terrainTiles = config.terrainTiles ?? ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
  const satelliteMaxZoom = config.satelliteMaxZoom ?? 14;
  const satelliteAttribution = config.satelliteAttribution ?? (config.satelliteTiles ? configuredAttribution(satelliteTiles, ATTRIBUTION.eox) : ATTRIBUTION.eox);

  return {
    streets: {
      id: 'streets', label: 'Streets', online: true, maxUsefulZoom: 19,
      style: rasterStyle('streets', { base: rasterSource(streetsTiles, ATTRIBUTION.osm) }, [
        { id: 'streets-raster', type: 'raster', source: 'base' },
      ], { 'shosholoza:provider': config.streetsTiles ? 'configured' : 'openstreetmap' }),
    },
    outdoor: {
      id: 'outdoor', label: 'Terrain', online: true, maxUsefulZoom: 17,
      style: rasterStyle('outdoor', {
        base: rasterSource(outdoorTiles, config.outdoorTiles ? configuredAttribution(outdoorTiles, ATTRIBUTION.osm) : `${ATTRIBUTION.topo} · ${ATTRIBUTION.osm}`, 17),
        elevation: { type: 'raster-dem', tiles: terrainTiles, tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: 'Elevation: Mapzen terrain tiles' },
      }, [
        { id: 'outdoor-raster', type: 'raster', source: 'base' },
        { id: 'terrain-hillshade', type: 'hillshade', source: 'elevation', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#46351e', 'hillshade-highlight-color': '#f6e6be' } },
      ], { 'shosholoza:terrain': true, 'shosholoza:provider': config.outdoorTiles ? 'configured' : 'opentopomap' }),
    },
    dark: {
      id: 'dark', label: 'Night', online: true, maxUsefulZoom: 19,
      style: rasterStyle('dark', { base: rasterSource(darkTiles, configuredAttribution(darkTiles, ATTRIBUTION.osm), 19, 256) }, [
        { id: 'dark-raster', type: 'raster', source: 'base', paint: {
          'raster-brightness-min': 0.025,
          'raster-brightness-max': 0.34,
          'raster-saturation': -0.72,
          'raster-contrast': 0.16,
        } },
      ], { 'shosholoza:provider': config.darkTiles ? 'configured' : 'openstreetmap-night-treatment' }),
    },
    satellite: {
      id: 'satellite', label: 'Satellite', online: true, maxUsefulZoom: satelliteMaxZoom,
      style: rasterStyle('satellite', { base: rasterSource(satelliteTiles, satelliteAttribution, satelliteMaxZoom) }, [
        { id: 'satellite-raster', type: 'raster', source: 'base', paint: { 'raster-saturation': 0.12, 'raster-contrast': 0.09, 'raster-brightness-max': 1 } },
      ], { 'shosholoza:provider': config.satelliteTiles ? 'configured' : 'eox-cloudless-2025' }),
    },
    hybrid: {
      id: 'hybrid', label: 'Hybrid', online: true, maxUsefulZoom: satelliteMaxZoom,
      style: rasterStyle('hybrid', {
        imagery: rasterSource(satelliteTiles, satelliteAttribution, satelliteMaxZoom),
        labels: rasterSource(hybridLabelTiles, config.hybridLabelTiles ? configuredAttribution(hybridLabelTiles, ATTRIBUTION.osm) : ATTRIBUTION.eoxOverlay, 19),
      }, [
        { id: 'hybrid-imagery', type: 'raster', source: 'imagery', paint: { 'raster-saturation': 0.05, 'raster-contrast': 0.08 } },
        { id: 'hybrid-reference', type: 'raster', source: 'labels', paint: { 'raster-opacity': config.hybridLabelOpacity ?? (config.hybridLabelTiles ? 0.38 : 0.92), 'raster-contrast': config.hybridLabelTiles ? 0.28 : 0.08 } },
      ], { 'shosholoza:provider': config.satelliteTiles ? 'configured' : 'eox-cloudless-2025' }),
    },
    offline: {
      id: 'offline', label: 'Offline', online: false, maxUsefulZoom: 12,
      style: rasterStyle('offline', {}, [], { 'shosholoza:fallback': true }),
    },
  };
}

function normalizeFeature(featureOrGeometry, properties = {}) {
  if (featureOrGeometry?.type === 'Feature') return structuredClone(featureOrGeometry);
  return { type: 'Feature', properties, geometry: structuredClone(featureOrGeometry) };
}

function markerButton(className, label, content) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML = content;
  return button;
}

function boundsForCoordinates(maplibre, coordinates) {
  const bounds = new maplibre.LngLatBounds();
  for (const coordinate of coordinates) bounds.extend(coordinate);
  return bounds;
}

export function createImmersiveMap(options) {
  const maplibre = options.maplibre ?? globalThis.maplibregl;
  if (!maplibre?.Map) throw new Error('MapLibre GL JS is unavailable. Load /vendor/maplibre-gl/maplibre-gl.js before this module.');
  const route = normalizeFeature(options.route);
  if (route.geometry?.type !== 'LineString' || route.geometry.coordinates.length < 2) throw new Error('An immersive map requires a GeoJSON LineString route.');

  const runtimeConfig = { ...(globalThis.SHOSHOLOZA_MAP_CONFIG ?? {}), ...(options.mapConfig ?? {}) };
  const styles = createBasemapStyles(runtimeConfig);
  const keylessStyles = createBasemapStyles();
  const containerElement = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
  if (!containerElement) throw new Error('The immersive map container was not found.');
  let activeStyle = styles[options.initialStyle] ? options.initialStyle : (globalThis.navigator?.onLine === false ? 'offline' : 'dark');
  let activeDefinition = styles[activeStyle];
  let preferredOnlineStyle = activeStyle === 'offline' ? 'dark' : activeStyle;
  let follow = options.follow !== false;
  let cinematic = options.cinematic !== false;
  let destroyed = false;
  let lastPosition = null;
  let trainBearing = 0;
  let distanceMetres = 0;
  let previewFrame = null;
  let styleSequence = 0;
  let styleControl = null;
  const providerFallbacks = new Set();
  const markers = new Map();
  containerElement.dataset.mapEngine = 'maplibre';
  containerElement.dataset.activeStyle = activeStyle;
  containerElement.dataset.offlineFallback = String(activeStyle === 'offline');
  containerElement.dataset.mapProvider = activeDefinition.style.metadata?.['shosholoza:provider'] ?? 'local';

  const notify = (status, detail = {}) => options.onStatus?.({ status, basemap: activeStyle, ...detail });
  const map = new maplibre.Map({
    container: containerElement,
    style: styles[activeStyle].style,
    center: options.center ?? DEFAULT_CENTER,
    zoom: options.zoom ?? 4.6,
    pitch: cinematic && !options.reducedMotion ? (options.pitch ?? 52) : 0,
    bearing: 0,
    antialias: true,
    attributionControl: true,
    maxPitch: 70,
    cooperativeGestures: options.cooperativeGestures ?? false,
  });
  map.addControl(new maplibre.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right');
  map.addControl(new maplibre.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

  const trainElement = markerButton('immersive-train immersive-train--manual', 'Journey position', '<span aria-hidden="true">&#128646;</span>');
  const trainMarker = new maplibre.Marker({ element: trainElement, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' });

  function addJourneyLayers() {
    if (!map.isStyleLoaded() || map.getSource('journey-route')) return;
    map.addSource('journey-route', { type: 'geojson', data: route });
    map.addSource('journey-progress', { type: 'geojson', data: normalizeFeature({ type: 'LineString', coordinates: [route.geometry.coordinates[0], route.geometry.coordinates[0]] }) });
    map.addLayer({ id: 'journey-route-shadow', type: 'line', source: 'journey-route', paint: { 'line-color': '#06110e', 'line-width': 10, 'line-opacity': 0.68, 'line-blur': 2 } });
    map.addLayer({ id: 'journey-route-line', type: 'line', source: 'journey-route', paint: { 'line-color': '#d69b52', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.2, 2.2] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'journey-progress-glow', type: 'line', source: 'journey-progress', paint: { 'line-color': '#ffd66b', 'line-width': 12, 'line-opacity': 0.24, 'line-blur': 4 } });
    map.addLayer({ id: 'journey-progress-line', type: 'line', source: 'journey-progress', paint: { 'line-color': '#ffe08a', 'line-width': 6, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    setRouteProgress(distanceMetres, { animate: false });
  }

  function addMarkers() {
    if (markers.size) return;
    for (const [index, hub] of (options.hubs ?? []).entries()) {
      const longitude = Number(hub.lon ?? hub.longitude), latitude = Number(hub.lat ?? hub.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      const element = markerButton('immersive-hub', `Open ${hub.name} story`, `<span>${String(index + 1).padStart(2, '0')}</span><strong>${hub.name}</strong>`);
      element.dataset.hub = hub.hubId ?? hub.id;
      element.addEventListener('click', () => options.onHubSelect?.(hub));
      const marker = new maplibre.Marker({ element, anchor: 'center' }).setLngLat([longitude, latitude]).addTo(map);
      markers.set(`hub:${hub.hubId ?? hub.id}`, marker);
    }
    for (const attraction of options.attractions ?? []) {
      const longitude = Number(attraction.lon ?? attraction.longitude), latitude = Number(attraction.lat ?? attraction.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      const element = markerButton('immersive-attraction', `Open ${attraction.name}`, '<span aria-hidden="true">&#9670;</span>');
      element.title = attraction.name;
      element.dataset.attraction = attraction.id;
      element.addEventListener('click', () => options.onAttractionSelect?.(attraction));
      const marker = new maplibre.Marker({ element, anchor: 'center' }).setLngLat([longitude, latitude]).addTo(map);
      markers.set(`attraction:${attraction.id}`, marker);
    }
  }

  function setRouteProgress(metres, { animate = true } = {}) {
    distanceMetres = clamp(Number(metres) || 0, 0, Number(route.properties?.lengthMetres) || Infinity);
    const coordinates = sliceLineAtDistance(route, distanceMetres);
    if (coordinates.length === 1) coordinates.push(coordinates[0]);
    const source = map.getSource('journey-progress');
    source?.setData(normalizeFeature({ type: 'LineString', coordinates }));
    if (animate && coordinates.length > 1) options.onProgress?.({ distanceMetres, coordinates });
    return coordinates;
  }

  function updatePosition(position, movement = {}) {
    const next = [Number(position.lon ?? position.lng), Number(position.lat)];
    if (!next.every(Number.isFinite)) return;
    const inferred = lastPosition && haversineMetres(lastPosition, next) > 2 ? bearingBetween(lastPosition, next) : trainBearing;
    trainBearing = smoothBearing(trainBearing, Number.isFinite(position.bearing) ? position.bearing : inferred, movement.bearingSmoothing ?? 0.32);
    lastPosition = next;
    trainMarker.setLngLat(next).setRotation(trainBearing);
    if (!trainMarker.getElement().parentNode) trainMarker.addTo(map);
    trainElement.className = `immersive-train immersive-train--${position.source ?? 'manual'}`;
    trainElement.setAttribute('aria-label', position.source === 'replay' ? 'Simulated journey position' : 'Current journey position');
    if (Number.isFinite(position.s ?? movement.distanceMetres)) setRouteProgress(position.s ?? movement.distanceMetres);
    if (follow) {
      const motion = options.reducedMotion || !cinematic ? 'jumpTo' : 'easeTo';
      map[motion]({
        center: next,
        bearing: cinematic ? trainBearing : map.getBearing(),
        pitch: cinematic ? (movement.pitch ?? 58) : map.getPitch(),
        zoom: Math.min(activeDefinition.maxUsefulZoom, movement.zoom ?? Math.max(map.getZoom(), 7.2)),
        duration: options.reducedMotion ? 0 : (movement.duration ?? 900),
        essential: true,
        padding: movement.padding ?? { top: 80, right: 30, bottom: 180, left: 30 },
      });
    }
    options.onPosition?.({ coordinates: next, bearing: trainBearing, follow, cinematic });
  }

  async function setBasemap(id, { remember = true, definition } = {}) {
    const requested = definition ?? styles[id] ?? styles.offline;
    if (requested.online && globalThis.navigator?.onLine === false) {
      notify('offline-fallback', { requested: id });
      return setBasemap('offline', { remember: false });
    }
    if (!definition) providerFallbacks.delete(requested.id);
    if (remember && requested.online) preferredOnlineStyle = requested.id;
    activeStyle = requested.id;
    activeDefinition = requested;
    containerElement.dataset.activeStyle = activeStyle;
    containerElement.dataset.offlineFallback = String(activeStyle === 'offline');
    containerElement.dataset.mapProvider = requested.style.metadata?.['shosholoza:provider'] ?? 'local';
    const sequence = ++styleSequence;
    map.setStyle(requested.style, { diff: false });
    await new Promise(resolve => map.once('style.load', resolve));
    if (destroyed || sequence !== styleSequence) return activeStyle;
    addJourneyLayers();
    if (requested.style.metadata?.['shosholoza:terrain'] && map.getSource('elevation')) {
      try { map.setTerrain({ source: 'elevation', exaggeration: 1.15 }); } catch { notify('terrain-unavailable'); }
    }
    if (styleControl) {
      for (const candidate of styleControl.querySelectorAll('[data-map-style]')) candidate.setAttribute('aria-pressed', String(candidate.dataset.mapStyle === activeStyle));
      const status = styleControl.querySelector('.immersive-map-status');
      if (status) {
        const provider = requested.style.metadata?.['shosholoza:provider'];
        status.textContent = activeStyle === 'offline'
          ? 'Offline map active. Route and stops remain available.'
          : `${requested.label} map active${provider === 'eox-cloudless-2025' ? ' · cloudless Sentinel-2 mosaic' : ''}.`;
      }
    }
    options.onStyleChange?.({ id: activeStyle, definition: requested });
    notify('style-ready');
    return activeStyle;
  }

  function fitRoute(fitOptions = {}) {
    map.fitBounds(boundsForCoordinates(maplibre, route.geometry.coordinates), {
      padding: fitOptions.padding ?? 45,
      pitch: cinematic && !options.reducedMotion ? 28 : 0,
      bearing: 0,
      duration: options.reducedMotion ? 0 : (fitOptions.duration ?? 1100),
      maxZoom: fitOptions.maxZoom ?? 6,
      essential: true,
    });
  }

  function flyToHub(hubId, flyOptions = {}) {
    const hub = (options.hubs ?? []).find(item => (item.hubId ?? item.id) === hubId);
    if (!hub) return false;
    map.flyTo({ center: [hub.lon ?? hub.longitude, hub.lat ?? hub.latitude], zoom: flyOptions.zoom ?? 11, pitch: cinematic ? 58 : 0,
      bearing: flyOptions.bearing ?? trainBearing, duration: options.reducedMotion ? 0 : (flyOptions.duration ?? 2200), essential: true });
    markers.get(`hub:${hubId}`)?.getElement()?.classList.add('immersive-hub--pulse');
    setTimeout(() => markers.get(`hub:${hubId}`)?.getElement()?.classList.remove('immersive-hub--pulse'), 2600);
    return true;
  }

  function playRoutePreview({ duration = 12000, onComplete } = {}) {
    cancelAnimationFrame(previewFrame);
    const total = Number(route.properties?.lengthMetres) || route.geometry.coordinates.slice(1).reduce((sum, point, index) => sum + haversineMetres(route.geometry.coordinates[index], point), 0);
    const start = performance.now();
    follow = true;
    const frame = now => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const prefix = sliceLineAtDistance(route, total * eased);
      const point = prefix.at(-1), previous = prefix.at(-2) ?? point;
      updatePosition({ lon: point[0], lat: point[1], bearing: bearingBetween(previous, point), s: total * eased, source: 'replay' }, { duration: 250, zoom: 7.1 });
      if (progress < 1 && !destroyed) previewFrame = requestAnimationFrame(frame);
      else onComplete?.();
    };
    previewFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(previewFrame);
  }

  function addStyleControl() {
    styleControl?.remove();
    const control = document.createElement('div');
    control.className = 'immersive-style-control';
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Map appearance');
    const status = document.createElement('p');
    status.className = 'immersive-map-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = `${styles[activeStyle].label} map active.`;
    for (const style of Object.values(styles).filter(item => item.id !== 'offline')) {
      const button = markerButton('immersive-style-button', `Use ${style.label} map`, `<span class="immersive-style-swatch immersive-style-swatch--${style.id}" aria-hidden="true"></span><span>${style.label}</span>`);
      button.dataset.mapStyle = style.id;
      button.setAttribute('aria-pressed', String(style.id === activeStyle));
      button.addEventListener('click', async () => {
        status.textContent = `Loading ${style.label} map...`;
        await setBasemap(style.id);
      });
      control.append(button);
    }
    control.append(status);
    options.controlsContainer?.append(control);
    styleControl = control;
    return control;
  }

  const onlineHandler = () => { if (activeStyle === 'offline') setBasemap(preferredOnlineStyle); };
  const offlineHandler = () => setBasemap('offline', { remember: false });
  globalThis.addEventListener?.('online', onlineHandler);
  globalThis.addEventListener?.('offline', offlineHandler);
  map.on('load', () => { addJourneyLayers(); addMarkers(); fitRoute({ duration: 0 }); notify('ready'); });
  map.on('error', () => {
    const provider = activeDefinition.style.metadata?.['shosholoza:provider'];
    if (provider === 'configured' && !providerFallbacks.has(activeStyle)) {
      providerFallbacks.add(activeStyle);
      // Provider errors can include credential-bearing URLs. Never expose the
      // raw MapLibre error to callbacks, logs, or the DOM.
      notify('provider-fallback', { requested: activeStyle, fallbackProvider: keylessStyles[activeStyle].style.metadata?.['shosholoza:provider'] });
      queueMicrotask(() => setBasemap(activeStyle, { remember: false, definition: keylessStyles[activeStyle] }));
      return;
    }
    notify('map-resource-error', { resource: activeStyle });
  });

  return {
    map,
    styles: Object.values(styles).map(({ style, ...summary }) => summary),
    addStyleControl,
    setBasemap,
    setRouteProgress,
    updatePosition,
    fitRoute,
    flyToHub,
    playRoutePreview,
    setFollow(value) { follow = Boolean(value); if (follow && lastPosition) updatePosition({ lon: lastPosition[0], lat: lastPosition[1] }, { duration: 700 }); return follow; },
    setCinematic(value) { cinematic = Boolean(value); map.easeTo({ pitch: cinematic && !options.reducedMotion ? 52 : 0, duration: options.reducedMotion ? 0 : 700 }); return cinematic; },
    getState() { return { basemap: activeStyle, preferredOnlineStyle, follow, cinematic, distanceMetres, bearing: trainBearing, position: lastPosition && [...lastPosition] }; },
    resize() { map.resize(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(previewFrame);
      globalThis.removeEventListener?.('online', onlineHandler);
      globalThis.removeEventListener?.('offline', offlineHandler);
      map.remove();
    },
  };
}
