# Codex fix plan — satellite, AI, animation, one theme

Written 8 September 2026 after reading the running code. Each item below states the
**actual root cause with file and line**, the fix, and a **verification that cannot be
faked**. Do not start a task until you can restate its root cause. Do not report a task
done until its verification command has been run and pasted.

Two things are not style choices and stay regardless of scope: photographs carry CC BY /
CC BY-SA licences that legally require the credit shown at `/credits`, and no named person
gets a quote they did not say. Everything else is open.

---

## Why the last few hours went in circles

You have been changing symptoms. Here is what is actually wrong.

| Symptom | Real cause | Evidence |
|---|---|---|
| "Satellite doesn't look like satellite, same look everywhere" | The satellite basemap is **EOxCloudless s2cloudless capped at zoom 14**. That source is a global annual Sentinel-2 mosaic at ~10 m/pixel. Zoom 14 *is* its resolution limit, so over the Karoo it can only ever render as a flat uniform wash. It is not broken — it is the wrong product. | `public/map/immersive-map.js:104-114`, `satelliteMaxZoom = 14` |
| "AI assistance is unavailable" | You are almost certainly testing against `harness/static-server.js`, which only implements `/api/health`. Every other `/api/*` falls through to the file handler and returns **`index.html`**, so the client parses HTML as JSON and shows the fallback. AI cannot work on that server no matter what you change in `ai.ts`. | `harness/static-server.js` handles only `/api/health`; fallback string at `src/routes/ai.ts:13` |
| Animations feel unimpressive | They are **deliberately abstract**. The content policy is `"Code-native vector artwork only. No archival image is reproduced or implied."` and the motifs are things like "Rising light and seven quiet rays". They are working exactly as specified — the spec was the problem. | `public/animations/scenes.v1.json` |
| Two visual identities | React uses Fraunces/Outfit on cream/gold at `/`. The engine app under `/app` uses its own `public/style.css` + `journey.css` dark-green (`#183e36`) theme. Nothing shares tokens. | `public/app.html`, `app/src/styles.css` |

**Trap that will waste another hour if you miss it:** `src/worker.ts:19` sets
`Referrer-Policy: no-referrer`. MapTiler origin-restricted keys are validated using the
`Referer` header. With `no-referrer`, an origin-restricted MapTiler key is **rejected and
the tiles silently fail**. You must change this to `strict-origin-when-cross-origin` when
you wire MapTiler, or you will conclude the key is bad when it is fine.

---

## Fix 1 — Real satellite imagery

**Goal:** zooming into Kimberley shows the Big Hole as a recognisable crater with roads and
buildings around it. Today it is a beige smear.

### 1a. Change the keyless default to Esri World Imagery

Highest impact, needs no account. Esri World Imagery serves genuine sub-metre aerial over
South African towns to z19, versus s2cloudless's 10 m at z14.

In `public/map/immersive-map.js`, replace the default `satelliteTiles` and raise the cap:

```js
const satelliteTiles = config.satelliteTiles ?? [
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];
const satelliteMaxZoom = config.satelliteMaxZoom ?? 19;
```

Add the attribution string (required):
`Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community`

Add `https://services.arcgisonline.com` to `mapHosts` in `src/worker.ts:10-17`.

Note Esri's tile URL is `{z}/{y}/{x}` — **y before x**. Getting this backwards returns
tiles from the wrong hemisphere, which looks like "wrong imagery" rather than an error.

### 1b. Add MapTiler Satellite as the keyed upgrade

The override hook already exists (`config.satelliteTiles`) and `configuredAttribution()`
already special-cases `api.maptiler.com` at `immersive-map.js:82`. Nothing supplies a key —
there is no `MAPTILER_KEY` anywhere in `wrangler.toml`. That is the entire gap.

1. `npx wrangler secret put MAPTILER_KEY`
2. Add `GET /api/map-config` (new file `src/routes/map-config.ts`) returning:

```json
{
  "satelliteTiles": ["https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=KEY"],
  "satelliteMaxZoom": 20,
  "hybridLabelTiles": ["https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=KEY"],
  "provider": "maptiler"
}
```

When `MAPTILER_KEY` is unset, return `{"provider":"esri"}` and let the client keep the
keyless default. **The map must never go blank because a key is missing.**

3. Client fetches `/api/map-config` once and passes the result into `createImmersiveMap`.
   Cache it in memory only — do **not** let `sw.js` cache it (it already excludes `/api/`).
4. Change `Referrer-Policy` to `strict-origin-when-cross-origin` (see trap above).
5. Restrict the key to your deployed origin in the MapTiler dashboard.

### 1c. Make "Hybrid" mean something

Hybrid currently overlays EOx's label raster at opacity 0.92, which washes the imagery out.
With real imagery beneath, drop overlay opacity to ~0.35 and keep imagery saturation at 0.

### Verification (paste the output)
```
npx wrangler dev
```
Then in the browser at `/app`:
- Switch to Satellite, zoom to Kimberley (-28.7383, 24.7719) at z17.
- Screenshot to `evidence/satellite-kimberley-z17.png`. **The Big Hole must be a visible crater.**
- Repeat at Matjiesfontein (-33.2306, 20.5806) z18 — individual buildings must be distinguishable.
- Confirm the attribution control names the imagery provider.
- Confirm no console CSP violation.

A screenshot where you cannot identify the landmark is a failure, regardless of what the
network tab says.

---

## Fix 2 — AI: prove it before you change it

**Do not edit `src/routes/ai.ts` until you have run this.** The current gating already
permits requests:

- `wrangler.toml`: `AI_ENABLED="true"`, `AI_EXPERIMENTAL="true"`, `AI` binding present, model `@cf/zai-org/glm-4.7-flash` matches the `^@cf\/` pattern.
- All 13 records in `data/sources.json` are `"automated-source-review; human-review-pending"`, which **passes** `sourceApproved()` at `ai.ts:33-35`.

So the code path is open. The fallback you are seeing is the static server.

### Step 1 — establish ground truth
```
npx wrangler dev
curl -s -X POST http://127.0.0.1:8787/api/ai \
  -H 'content-type: application/json' \
  -d '{"action":"explain","hubId":"pretoria","question":"What is Freedom Park?"}'
```
- If this returns a grounded answer: **AI is not broken.** Fix the preview instead — add
  `/api/ai` and `/api/rooms` stubs to `harness/static-server.js` that return an explicit
  `503 {"status":"preview-server-no-backend"}` so nobody mistakes the preview for a defect.
- If it returns `fallback`, the JSON `reason` field names the exact gate. Fix only that gate.

### Step 2 — known intentional behaviour, do not "fix"
`ai.ts:128` returns fallback for `action:"hint"` **by design** — hints are deterministic and
come from the pack. That is correct and must stay.

### Step 3 — make the UI honest
The current message blames the AI for what is often a config or preview state. Replace with
the specific reason returned by the API, e.g. "Assistance is off in this preview build" vs
"The provider did not respond — here is the sourced chapter instead."

### Verification
Paste the raw `curl` output for all four actions (`explain`, `hint`, `icebreaker`, `draft`),
plus one deliberately unanswerable question showing it declines rather than inventing.

---

## Fix 3 — Real animation

The abstraction rule that produced "seven quiet rays" is lifted. You now have nine
licensed photographs in `public/assets/photos/` with credits at `/credits`, so
place-specific artwork is no longer a rights problem.

### What to build
Replace each abstract motif in `public/animations/scenes.v1.json` with a **signature
animation for that specific place**, driven by real geometry or the licensed photo:

| Hub | Animation |
|---|---|
| Kimberley | Camera spirals down into the Big Hole; concentric rings draw inward, headgear silhouette rises against the sky |
| De Aar | Rail lines fan out from the junction centre and illuminate one at a time — it is the country's largest rail junction |
| Matjiesfontein | Victorian street draws itself in stroke by stroke, then gas lamps warm on in sequence |
| Beaufort West | Ground goes translucent; a therapsid skeleton fades in beneath the track — Beaufort Group, Permian |
| Pretoria | Jacaranda canopy blooms outward from the line |
| Worcester | Hex River Pass switchbacks trace themselves down the escarpment |
| Cape Town | Table Mountain profile draws, then the city lights come up |
| Johannesburg | Skyline rises block by block from the reef line |

### Technique — pick per scene, all free
1. **SVG stroke-draw**: trace the licensed photo into paths, animate `stroke-dashoffset`.
   Cheap, consistent, beautiful, and provably derived from a cited source.
2. **Ken Burns on the real photo**: slow scale+pan with an easing curve, gold vignette.
   Nearly free and instantly reads as premium.
3. **Real geometry**: for De Aar and Worcester, animate the *actual* OSM rail geometry
   already in `data/route.geojson` — real data, drawn in.

### Non-negotiable mechanics
- 60 fps, `transform`/`opacity` only. No animating `width`, `top`, `left` or `filter`.
- Honour `prefers-reduced-motion`: static, complete final frame. Tests already assert this.
- `IntersectionObserver` — nothing animates off-screen.
- Everything stops when `document.hidden` or the engine state is `waiting` (low-power).
- Each scene declares its `sourceIds`, and photo-derived artwork keeps the photo credit.

### Verification
Record `evidence/animation-<hub>.webm` for three hubs. Show a Performance panel capture
holding ~60 fps. Show the reduced-motion render of the same scene as a complete still.

---

## Fix 4 — One theme, React's

React's identity wins everywhere. Today the engine app under `/app` has a completely
separate dark-green look.

1. Extract tokens from `app/src/styles.css` into `public/theme.css`:
   `--ink:#111a29; --cream:#f8f2e8; --gold:#f4bd4f; --muted:#737988; --border:#ded8ce`
   plus the Fraunces/Outfit stacks.
2. Link `theme.css` from **both** `app/index.html` and `public/app.html`.
3. Rewrite `public/style.css` and `public/journey.css` to consume the tokens. Delete the
   `#183e36` palette. Keep class names — `app.js` depends on them.
4. Reuse the React header/tab-bar markup and classes in `public/app.html` so navigating
   between `/` and `/app` shows no visual seam.
5. Fonts are already self-hosted at `/app-assets/*.woff2`; reference those, add no CDN link
   (the CSP blocks it and it breaks offline).

### Verification
Screenshots of `/journey` and `/app` side by side. Same typography, same palette, same
header. A stranger should not be able to tell they are two applications.

---

## Order and verification protocol

Do them in this order — each is independent, and this front-loads what judges see first:

1. **Fix 1a** (Esri default) — one file, biggest visible gain, no account needed.
2. **Fix 4** (one theme) — makes the whole thing feel like one product.
3. **Fix 3** (animation) — the differentiator.
4. **Fix 1b** (MapTiler upgrade) — only after 1a proves the pipeline works.
5. **Fix 2** (AI) — verify first; it may need no code change at all.

After every task, run and paste:
```
npm test && npm run check && npm run check:app && npm run security:scan
npx vite build && node scripts/build-assets.mjs
```

Then re-run the smoke check across `/`, `/journey`, `/destinations`, `/stories`, `/plan`,
`/credits`, `/app` and confirm zero console errors and zero broken images.

**Two standing rules:**
- `browser-tests/provider-recovery.spec.js` needs its own config on port 4177
  (`browser-tests/.provider.config.mjs`). The main `playwright.config.js` sweeps it in and
  reports false failures. Exclude it via `testIgnore`.
- `browser-tests/immersive-local.spec.js:225` still asserts CARTO attribution, which you
  removed from `immersive-map.js`. Two of your own tests contradict each other. Update the
  stale assertion.

**Report format:** for each task, one line of what changed, the verification output pasted,
and the screenshot path. "Done" without pasted evidence is not done.
