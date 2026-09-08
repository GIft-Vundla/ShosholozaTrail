# Codex plan — populate the ride: what the world draws, and how it plays

The rail geometry is done and correct. The ride currently renders **an empty world**: a
satellite photo draped on a heightmap. Nothing stands up, nothing reacts, nothing is
labelled. This plan fills it.

Copy the code below. It is taken from working MapLibre examples and verified against this
repo's vendored build — do not re-derive it.

---

## Two corrections before you start (both cost hours if missed)

### 1. `FreeCameraOptions` does not exist in MapLibre. Delete that code path.

`Ride.tsx` branches on `map.getFreeCameraOptions && map.setFreeCameraOptions`. Neither
exists — not in the vendored bundle, **and not in the `maplibre-gl` npm package at all**:

```
grep FreeCamera public/vendor/maplibre-gl/maplibre-gl.js   -> 0
grep -rl getFreeCameraOptions node_modules/maplibre-gl/dist -> (no files)
```

It is a Mapbox GL JS v2 API. MapLibre forked from v1.13 and never had it. **Your
free-camera branch is dead code that has never once executed** — every frame falls through
to `map.jumpTo({ center, zoom: 17.5, pitch })`. That is also why the view reads as a low
aerial rather than eye level: the "elevation + 6 m" line never runs.

Remove the branch and the `FreeCameraLike` types. Control apparent eye height with
**zoom + pitch + terrain exaggeration** instead. Start at `zoom: 16.5`, `pitch: 85`,
`exaggeration: 1.4`. Higher exaggeration is the single best lever for making flat Highveld
read as landscape.

### 2. Vendored MapLibre is 5.7.1. Verified available: `setSky`, `setTerrain`,
`queryTerrainElevation`, `fill-extrusion`. There is **no** separate `setFog` — fog is a set
of properties *inside* `setSky`.

---

## Phase A — Atmosphere (do this first: one hour, biggest single visual gain)

The top third of the ride is currently flat black. That one defect makes the whole thing
look unfinished.

```js
// Verified property names, MapLibre docs "Sky, Fog, Terrain" example.
map.setSky({
  'sky-color': '#8fb8e0',
  'sky-horizon-blend': 0.6,
  'horizon-color': '#e8d3b0',
  'horizon-fog-blend': 0.55,
  'fog-color': '#d9c9ae',
  'fog-ground-blend': 0.08,
});
```

Then drive it from the real sun. You already compute sun position elsewhere; reuse it.

| Time | sky-color | horizon-color | fog-color |
|---|---|---|---|
| Dawn | `#3a5a80` | `#e8956b` | `#d8a882` |
| Midday | `#8fb8e0` | `#e8d3b0` | `#d9c9ae` |
| Dusk | `#2e4260` | `#d4703c` | `#b98a63` |
| Night | `#070d18` | `#16202f` | `#0d1420` |

Ease between them over ~800 ms when the ride clock crosses a boundary. Karoo haze is real —
`fog-ground-blend` near 0.08 gives distance without hiding the track.

**Acceptance:** the horizon is visible and coloured in a screenshot. No black band.

---

## Phase B — Make the world stand up: 3D buildings, keyless

This is the fix for "nothing is there". **OpenFreeMap** serves global vector tiles including
OSM building footprints with **no account and no API key**. Verified live:

```
GET https://tiles.openfreemap.org/styles/liberty        -> 200
GET https://tiles.openfreemap.org/planet                -> tilejson, vector_layers includes "building"
```

Add the source and one extrusion layer:

```js
map.addSource('ofm', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });

map.addLayer({
  id: '3d-buildings',
  source: 'ofm',
  'source-layer': 'building',
  type: 'fill-extrusion',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': [
      'interpolate', ['linear'], ['get', 'render_height'],
      0, '#c9b79c', 12, '#b09a7d', 40, '#8c7a63',
    ],
    // Buildings with no height tag collapse to zero. Give them a floor.
    'fill-extrusion-height': ['case',
      ['has', 'render_height'], ['get', 'render_height'], 6],
    'fill-extrusion-base': ['case',
      ['has', 'render_min_height'], ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.92,
  },
});
```

**Critical:** small Karoo towns have building *footprints* but almost no `height` tags. The
`case` fallback to 6 m is what stops Matjiesfontein rendering as flat paint. Without it this
phase looks like it did nothing.

Add `https://tiles.openfreemap.org` to `mapHosts` in `src/worker.ts`.

Also add, from the same source, in this order:
- `landuse` / `landcover` → tinted fills so scrub, farmland and orchards differ
- `waterway` + `water` → the Hex, Orange and Breede read as water, not grey
- `transportation` filtered to `class=rail` → the parallel track beside you

**Acceptance:** stop the ride in Matjiesfontein and Kimberley. Buildings must have visible
height and cast the terrain's shading. Screenshot both.

---

## Phase C — What a person actually sees and can touch

Now populate it with the things that make it a journey rather than a flight.

### Draw these, in priority order

| # | Object | How | Why it matters |
|---|---|---|---|
| 1 | **The track ahead** | `line` layer on `route-ride.geojson`, `line-width` interpolated so it is ~3 m wide on the ground, warm gold | Right now you ride *above* an invisible line. Seeing rails gives the eye something to follow |
| 2 | **Distance-graded POI billboards** | `symbol` layer, `icon-image` + `text-field`, `symbol-placement: point`, `text-variable-anchor` | This is the Street View pin. Tap = story |
| 3 | **Approach markers** | Symbols at 5 km / 2 km / 500 m before each hub, fading in by `['interpolate',['linear'],['zoom'],...]` | Anticipation. You *see* Matjiesfontein coming |
| 4 | **The train** | three.js custom layer, or cheaper: a `fill-extrusion` polygon following the track 40 m behind camera | Sells that you are *on* something |
| 5 | **Landmark silhouettes** | Billboard sprites at the 9 attractions in `hubs.json` | Big Hole headgear, Lord Milner, Table Mountain |
| 6 | **Kilometre posts** | Symbol every 10 km along the route | Cheap, and it reads as *rail* |

For the train model, the working reference is MapLibre's
[Adding 3D models using three.js on terrain](https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain/)
example — copy its custom-layer `onAdd`/`render` structure exactly. Do not invent a
projection; use `MercatorCoordinate.fromLngLat` as that example does.

### The interactivity — reuse the trigger engine you already built

Do **not** write new proximity logic. `public/engine/triggers.js` already does
segment-crossing detection with `sEnter`/`sExit`, once-per-journey firing, and duplicate
suppression. The ride's distance-travelled value is the same `s`. Feed it in.

Game loop:

1. **Discover.** Riding past a trigger interval fires the hub. Its billboard blooms from dim
   to lit and stays lit for the rest of the session.
2. **Collect.** A discovered place is added to a strip along the bottom — a filling
   constellation. By Cape Town you have a visible record of what you found.
3. **Look.** Some places are only visible if you are facing the right way. "Look left as you
   cross the Hex" — award only if bearing is within ±60° of the landmark when you pass. This
   turns free-look from a toy into a mechanic.
4. **Ask.** Tapping a lit billboard opens the sourced chapter and the licensed photograph,
   with the AI "ask about this place" action already wired.
5. **Miss and recover.** A missed place stays reachable from the collection strip. Never
   punish. Show it greyed with "passed — open anyway".
6. **Speed.** 1× / 4× / 16×, plus hold-to-run. At 16× the sky clock advances too, so a long
   run visibly moves from afternoon into Karoo night.

### Controls
Keep what exists (step forward/back, look, auto-ride) and add:
- `WASD` / arrows for desktop
- Swipe forward, drag to look on touch
- `Space` = toggle auto-ride
- Tap billboard = open place

**Acceptance:** ride Pretoria → Kimberley at 16×. At least four billboards must light up as
you pass, the collection strip must fill, and one "look left" award must be earnable and
missable. Capture 20 s of video.

---

## Phase D — Then, and only then: the satellite/basemap upgrade

Do this after the world is populated, because imagery quality matters far less once
buildings, sky and objects are in frame.

1. **Wire the MapTiler key** — `npx wrangler secret put MAPTILER_KEY`, serve tile URLs from
   `GET /api/map-config`, never in the bundle. MapTiler Satellite reaches z20 vs Esri's z19,
   and is sharper over South African towns.
2. **Change `Referrer-Policy` to `strict-origin-when-cross-origin`** in `src/worker.ts`.
   MapTiler validates origin-restricted keys via the `Referer` header; the current
   `no-referrer` silently rejects them. This has already cost time once.
3. **Keep Esri as the keyless fallback.** The map must never blank because a key is absent
   or over quota.
4. **Hybrid** = imagery + OpenFreeMap labels at low opacity, not the EOX raster overlay.
5. Cap satellite at its true native zoom and let MapLibre overzoom rather than showing a
   coarse wash — you already documented this behaviour, keep it.

---

## Order, and what to hand back

1. **Phase A** — sky and fog. One hour. Do not skip; everything after looks better on it.
2. **Phase B** — OpenFreeMap 3D buildings with the 6 m height fallback.
3. **Phase C1–C3** — track line, billboards, approach markers.
4. **Phase C interactivity** — wire the existing trigger engine, collection strip, look-award.
5. **Phase C4** — the train model (cut this first if time runs short).
6. **Phase D** — MapTiler and basemap polish.

Also still outstanding from before, do not lose them:
- Re-run `harness/run-traces.js` against the **real** alignment. `results/r3.json` still says
  `routeVersion: synthetic-equator-v1`, so the headline trigger number does not cover the
  corridor you now ship.
- Five of eight localized scenes are still abstract line art over near-invisible photos.
  Kimberley and Johannesburg prove the standard — bring De Aar, Beaufort West,
  Matjiesfontein, Worcester and Cape Town up to it.
- The gallery header still claims "No archival image ... is shown" while showing photographs.

After each phase:
```
npm test && npm run check && npm run check:app && npm run security:scan
npx vite build && node scripts/build-assets.mjs
```

Deliver per phase: one line on what changed, pasted gate output, and a screenshot or capture.
Required artefacts: `evidence/ride-sky-dusk.png`, `evidence/ride-buildings-matjiesfontein.png`,
`evidence/ride-buildings-kimberley.png`, `evidence/ride-discovery-run.webm`.

**A screenshot where the horizon is black, or where a town is flat paint, is a failed phase
regardless of what the tests say.**

---

## Sources

- [MapLibre GL JS — Sky, Fog, Terrain](https://maplibre.org/maplibre-gl-js/docs/examples/sky-fog-terrain/)
- [MapLibre GL JS — Display buildings in 3D](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)
- [MapLibre GL JS — Adding 3D models using three.js on terrain](https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain/)
- [MapLibre GL JS — 3D Terrain](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
- [OpenFreeMap](https://openfreemap.org/) — keyless vector tiles, verified 200 OK
- [Stadia Maps — Adding 3D buildings with MapLibre](https://docs.stadiamaps.com/tutorials/adding-3d-buildings-to-your-maps-with-maplibre/)
