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

## Providers used by the experiment

`Night` no longer calls CARTO. CARTO's anonymous raster tiles now display an
API-key watermark, so the keyless Night view applies a dark MapLibre raster
treatment to the standard OpenStreetMap tiles already used by `Streets`.

The keyless `Satellite` and `Hybrid` views use the 2025 EOxCloudless
Sentinel-2 mosaic at zoom 0–14. Hybrid adds EOX's transparent OSM/Natural Earth
overlay rather than placing a semi-opaque street map over the imagery. These
URLs follow EOX's official Web Mercator WMTS template, whose final coordinates
are `{z}/{y}/{x}`. EOX requires the visible attribution included in the style.
The 2025 viewing layer is free for non-commercial use under CC BY-NC-SA 4.0 and
is served as-is with rate limiting. It is appropriate for this local prototype;
commercial use needs a separate EOX licence or a different approved provider.

- [EOX map service and availability notes](https://maps.eox.at/)
- [EOxCloudless licence and exact attribution](https://cloudless.eox.at/license-non-commercial)
- [EOxCloudless integration guidance](https://cloudless.eox.at/documentation/usage)

For sharper imagery above zoom 14, a production-approved provider can be
injected without committing a token:

```js
window.SHOSHOLOZA_MAP_CONFIG = {
  satelliteTiles: ['https://your-approved-provider.example/{z}/{x}/{y}.jpg'],
  satelliteAttribution: 'Required provider attribution',
  satelliteMaxZoom: 18,
  // A label-only source produces a cleaner hybrid than the keyless raster fallback.
  hybridLabelTiles: ['https://your-approved-provider.example/labels/{z}/{x}/{y}.png'],
};
```

The current app accepts a MapTiler **browser** key for the current tab and
passes its raster URLs into this config. MapTiler requires a key for all API
requests. Restrict it to the exact local origins used for testing (for example,
both `http://127.0.0.1:4174` and `http://localhost:4174` if both are used).
MapTiler recommends a separate protected key per app. If a configured provider
fails, the controller automatically returns to the corresponding keyless style
and reports only a sanitized provider-fallback event; it never emits a raw
resource error containing the credential-bearing URL.

- [MapTiler API key requirements](https://docs.maptiler.com/cloud/api/authentication-key/)
- [MapTiler raster maps API](https://docs.maptiler.com/cloud/api/maps/)
- [MapTiler key restrictions](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-protect-your-map-key/)

The app must not add remote basemap tiles to its offline pack. OpenStreetMap's standard tile policy forbids bulk downloading and offline prefetching. When connectivity disappears, the controller switches to a local background while preserving the bundled route, progress line, markers and train.
