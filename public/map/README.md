# Immersive map integration

This module is local-only on the `experiment/immersive-local-map` branch. It does not alter the deployed Leaflet journey.

Load the vendored MapLibre CSS/JS, the immersive CSS, then import the module:

```html
<link rel="stylesheet" href="/vendor/maplibre-gl/maplibre-gl.css">
<link rel="stylesheet" href="/map/immersive-map.css">
<script src="/vendor/maplibre-gl/maplibre-gl.js"></script>
<script type="module">
  import { createImmersiveMap } from '/map/immersive-map.js';
</script>
```

```js
const immersive = createImmersiveMap({
  container: 'map',
  route,
  hubs: hubs.stations,
  attractions: hubs.attractions,
  controlsContainer: document.querySelector('#journey-stage'),
  initialStyle: 'dark',
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  onHubSelect: station => showJourneyStoryCard(station.hubId),
  onAttractionSelect: showAttractionCard,
});

immersive.addStyleControl();
immersive.updatePosition({ lon: fix.lon, lat: fix.lat, s: snapshot.lastAccepted.s, source: fix.source });
immersive.setFollow(true);
immersive.flyToHub('kimberley');
```

The built-in satellite layer uses keyless NASA EOSDIS GIBS imagery. It is a daily Earth-observation layer with limited useful zoom, not Google imagery. A production-approved provider can be injected without committing a token:

```js
window.SHOSHOLOZA_MAP_CONFIG = {
  satelliteTiles: ['https://your-approved-provider.example/{z}/{x}/{y}.jpg'],
  satelliteAttribution: 'Required provider attribution',
  satelliteMaxZoom: 18,
  // A label-only source produces a cleaner hybrid than the keyless raster fallback.
  hybridLabelTiles: ['https://your-approved-provider.example/labels/{z}/{x}/{y}.png'],
};
```

The app must not add remote basemap tiles to its offline pack. OpenStreetMap's standard tile policy forbids bulk downloading and offline prefetching. When connectivity disappears, the controller switches to a local background while preserving the bundled route, progress line, markers and train.
