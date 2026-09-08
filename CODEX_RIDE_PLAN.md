# Codex plan — "The Ride": a first-person, step-through journey page

Goal: a **separate page with no map-overview UI**, where you travel the Pretoria–Cape Town
line from track level and step through it the way Google Street View steps down a road —
forward, back, look around, arrive at a place, read it, move on. Not a video. Not a
timeline scrub. Real geography, real elevation, real imagery.

---

## Read this before you write any code

### Blocker: there is no rail geometry in this project

`data/route.geojson` is **7 points across 1,356 km** — straight lines averaging 226 km
apart, tagged `"0.1.0-unresolved-schematic"` and `railAlignmentVerified: false`.
`data/build-route.py` line 1 says it outright: *"Build an explicitly unresolved schematic
from OSM station anchors, NOT rail alignment."*

A ride-through built on this flies dead straight across the Karoo, through mountains,
nowhere near the actual track. **Every part of this plan depends on fixing that first.**
Do not attempt the camera work before Phase 1 passes.

### There is no Street View of a railway, and there never will be

Google Street View and Mapillary are captured from **roads**. The Pretoria–Cape Town line
runs through country with no adjacent road for long stretches. Literal street-level
photography along the track does not exist and cannot be licensed.

So do not go looking for it. What we build instead is a **synthesised ride** from three
real datasets: the true rail alignment (OSM), true elevation (Mapzen terrarium DEM, already
configured), and true satellite imagery draped over it. That is geographically honest and
it is the thing nobody else will have.

### Most of the machinery already exists

`public/map/immersive-map.js` already has `setTerrain({source:'elevation', exaggeration:1.15})`
at line 325, terrarium DEM tiles at line 112, pitch up to 58, `flyToHub()`, and bearing
smoothing. You are extending this, not starting over.

---

## Phase 1 — Acquire the real rail alignment (nothing else matters until this is done)

**Target: a continuous LineString from Pretoria to Cape Town with ≤ 25 m point spacing
(~55,000 points), following the actual curves, including the Hex River Pass switchbacks.**

### Method
Write `data/acquire-rail.py`. For each of the six consecutive station pairs:

1. Build a bounding corridor around the straight line between the two stations, buffered
   ~30 km each side.
2. Query Overpass for the rail in that corridor:
   ```
   [out:json][timeout:300];
   way["railway"="rail"]["service"!~"siding|spur|yard|crossover"](bbox);
   out geom;
   ```
3. Build a graph: nodes are OSM node ids, edges are ways, edge weight is segment length.
4. Snap each station to its nearest rail node.
5. Dijkstra shortest path between the two snapped nodes.
6. Concatenate the six paths into one LineString.

### Guard rails
- If a pair returns no connected path, **record it as an unresolved gap** with its own
  `confidence` flag and keep the schematic connector for that segment only. Do not silently
  interpolate and do not let one bad segment invalidate five good ones.
- Sanity check: total length should land near **1,530 km** (the figure already on the site
  via `TOTAL_KM`). A result near 1,356 km means you are still on straight lines.
- Keep full provenance: Overpass query, timestamp, way ids, `rawSha256`, exactly as
  `build-route.py` already does for stations.

### Output — two levels of detail
| File | Spacing | Purpose |
|---|---|---|
| `data/route.geojson` | Douglas–Peucker simplified, ~2,000 pts | The overview line on the map. Replaces the schematic. |
| `data/route-ride.geojson` | ~25 m, coordinates rounded to **5 decimals** | The ride path only. Loaded on demand, never in the base pack. |

5 decimals is ~1 m precision — plenty, and it roughly halves the file. Expect ~1.2 MB raw,
~400 KB gzipped. **Lazy-load it on `/ride` only.** Do not add it to `pack-manifest.json`
for the default install; make it a separate opt-in download so the base pack stays ~3.4 MB.

### Verification
```
python data/acquire-rail.py
node -e "const g=require('fs').readFileSync('data/route-ride.geojson','utf8');const c=JSON.parse(g).geometry.coordinates;console.log('points',c.length)"
```
Paste: point count, total length in km, and per-segment resolved/unresolved status.
Then render it over satellite and screenshot the **Hex River Pass** — the switchbacks must
be visibly curved. A straight line there means the stitching failed.

---

## Phase 2 — The Ride page

New route `/ride` in React (`app/src/components/Ride.tsx`). Full-bleed. **No route summary
card, no timeline, no stop list, no basemap switcher.** Just the world and three controls.

### Camera: use FreeCameraOptions, not easeTo
`easeTo`/`flyTo` are for looking *at* a map. A first-person ride needs the camera placed in
space. MapLibre exposes this:

```js
const cam = map.getFreeCameraOptions();
cam.position = maplibregl.MercatorCoordinate.fromLngLat(
  { lng, lat },
  terrainHeightMetres + 6      // ~6 m: eye level from a carriage window
);
cam.lookAtPoint(pointAheadOnTrack);
map.setFreeCameraOptions(cam);
```

- Get `terrainHeightMetres` from `map.queryTerrainElevation([lng, lat])`.
- `pointAheadOnTrack` is the route coordinate ~400 m further along, so the camera always
  looks down the line into the curve, not at a fixed compass bearing.
- Keep `exaggeration: 1.15` — the Karoo is subtle and flat terrain reads as dead.

### Stepping, the Street View way
Precompute **waypoints** from `route-ride.geojson`: one every ~2 km, plus one at every
station, trigger zone and attraction.

- **Forward / back arrows** (or `←` `→`) hop exactly one waypoint. Each hop is a **1.4 s
  eased camera move** along the track, not a jump cut. This is the "step by step as if you
  are journeying through it" the brief asks for.
- **Hold forward** to run continuously at ~3 waypoints/sec for a cinematic sweep.
- **Drag left/right** rotates bearing freely, exactly like Street View. Releasing does
  **not** snap back — let people look out the other window.
- **Drag up/down** adjusts pitch between 60° and 88°.

### Arriving at a place — this is the payoff
When a hop lands on a waypoint tagged as a hub:

1. Camera settles, slight slow-down.
2. A card rises with the place name, distance travelled, and the **licensed photograph**
   from `public/assets/photos/` — real ground-level truth of that exact place.
3. The hub's signature animation plays in the card (see `CODEX_FIX_PLAN.md` Fix 3).
4. The sourced chapter text is one tap away.
5. Forward arrow returns you to the track.

That sequence — terrain ride → arrive → real photo → animation → sourced story — is the
whole product in fifteen seconds. It is what you demo.

### Basemap
Satellite only, at the highest zoom that has real imagery (see `CODEX_FIX_PLAN.md` Fix 1 —
Esri World Imagery to z19). s2cloudless at z14 will look like a blurred wash at ground
level and will make the ride worthless. **Phase 2 depends on Fix 1a being done.**

---

## Phase 3 — Localise the ride

Make each stretch feel like *that* place, not generic terrain.

- **Real sky.** You already compute sun position for the astronomy idea. Set fog and sky
  colour from the actual sun angle for the ride's clock. `map.setSky()` and `setFog()` take
  colour and horizon blend — dawn over the Highveld and 2 a.m. in the Karoo must look
  different.
- **Distance-to-next-place** readout, always visible, low contrast. It is the one number a
  passenger actually wants.
- **Named terrain moments.** Tag a handful of waypoints as "look left" cues: the Hex River
  switchbacks, the Karoo escarpment, the approach to Table Bay. A one-line caption fades in
  and out. This is the "guide" feeling without inventing facts.
- **Mapillary spike (optional, timeboxed to 1 hour).** Free API, free token, CC BY-SA
  imagery. Coverage exists in the towns, not along the track. If a station has coverage
  within 200 m, offer a "step into the town" panorama at that hub only. If the spike shows
  thin coverage, **drop it** and rely on the licensed photographs — do not spend a day on it.

---

## Performance and honesty rules

- Target 60 fps. Sample position with `requestAnimationFrame`, never `setInterval`.
- Stop everything on `document.hidden` and when engine state is `waiting` (low-power mode).
- `prefers-reduced-motion`: disable continuous motion, keep arrow stepping as instant jumps
  with the same cards. The ride must remain usable, not disabled.
- **Offline:** the ride needs satellite tiles, so it is an online feature. Say so plainly on
  the page and fall back to the packaged overview when offline. Do not pretend the ride
  works with no signal.
- Label the ride as a **simulated camera path along mapped rail geometry**, not footage and
  not a field recording. Same rule as replay vs live GPS.

---

## Order, and what to hand back

1. **Phase 1** — real rail alignment. Nothing else until the Hex River screenshot proves curves.
2. **Fix 1a** from `CODEX_FIX_PLAN.md` — Esri satellite. The ride is pointless on blurred imagery.
3. **Phase 2** — `/ride` with FreeCameraOptions and arrow stepping.
4. **Phase 3** — sky, captions, optional Mapillary spike.

After each phase run and paste:
```
npm test && npm run check && npm run check:app && npm run security:scan
npx vite build && node scripts/build-assets.mjs
```

Deliver per phase: one line on what changed, the pasted verification, and a screenshot or
short capture. Required artefacts:
- `evidence/rail-alignment-hexriver.png` — curved switchbacks over satellite
- `evidence/ride-karoo.webm` — 10 s of stepping, 60 fps
- `evidence/ride-arrival-matjiesfontein.png` — the arrival card with the real photograph

A straight line through the Hex River Pass, or a ride over a beige blur, is a failed phase
no matter what the tests say.
