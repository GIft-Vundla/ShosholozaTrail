# CODEX fix-plan execution evidence

Run date: 8 September 2026. Branch: `experiment/immersive-local-map`.

This record follows `CODEX_FIX_PLAN.md`. It records observed behavior and keeps failed checks visible.

## Fix 1a — real keyless satellite imagery

Root cause restated: the former EOxCloudless annual Sentinel-2 mosaic was capped at zoom 14 and could not show judge-visible town detail. The default now uses Esri World Imagery with the required `{z}/{y}/{x}` order and zoom cap 19. The Worker permits `services.arcgisonline.com`, and the map shows the Esri/Maxar/Earthstar/GIS User Community attribution.

Verification:

- `npm.cmd test`: 32 tests passed, 0 failed.
- `npm.cmd run check`: passed.
- `npm.cmd run check:app`: passed.
- `npx.cmd playwright test --config browser-tests/.provider.config.mjs`: 8 tests passed, including successful Esri Satellite and Esri+EOX Hybrid tile responses.
- Landmark capture observed successful World Imagery responses across zooms 6–19, the required attribution, and zero console/CSP errors.
- `satellite-kimberley-z17.png`: the Big Hole, surrounding excavation, roads and buildings are identifiable.
- `satellite-matjiesfontein-z18.png`: the settlement, station area and individual buildings are distinguishable. Esri's highest native tile at this rural point can be lower than the requested display zoom; MapLibre overzoom preserves the last available imagery rather than showing the former coarse global wash.

The repeatable capture script is `harness/capture-satellite-evidence.mjs`.

## Fix 3 - localized, efficient story animation

Root cause restated: the earlier story treatment did not give each route destination a place-specific visual scene, a visible source trail, or reliable motion controls. The scene manifest now covers Pretoria, Johannesburg, Kimberley, De Aar, Beaufort West, Matjiesfontein, Worcester and Cape Town. Each scene binds to a matching licensed local photograph, exposes its `photo:<hubId>` source ID and credit, and labels the animated layer as interpretation rather than documentary fact.

The legacy animation module and the React destination panel now use the same scene implementation. Motion is limited to `transform` and `opacity`; scenes pause when offscreen, while the document is hidden, while the journey is waiting, or when low-power mode is active. A manual pause control is available when animation is enabled. `prefers-reduced-motion` renders a complete static composition and removes the moving control.

Verification:

- `npm.cmd test`: 34 tests passed, 0 failed, including manifest/photo/source integrity and a check that animation keyframes use only `transform` and `opacity`.
- `npx.cmd playwright test browser-tests/immersive-local.spec.js browser-tests/theme-consistency.spec.js --grep "localized animation module|canonical theme"`: 6 tests passed, including eight distinct sourced scenes, reduced-motion behavior, photo credit visibility, and automatic/manual pause states.
- `animation-kimberley.png`, `animation-matjiesfontein.png`, and `animation-johannesburg.png` are desktop headless-Chromium still captures.
- `animation-kimberley.webm`, `animation-matjiesfontein.webm`, and `animation-johannesburg.webm` are the corresponding short motion captures.
- `animation-kimberley-reduced.png` records the static reduced-motion result.
- `animation-performance.json` records the repeatable requestAnimationFrame sample produced by `harness/capture-animation-evidence.mjs`.

The separate no-video headless requestAnimationFrame samples held 60.0 fps for Kimberley, Matjiesfontein and Johannesburg over 3 seconds, with p95 frame intervals of 16.7-16.8 ms. Video encoding was deliberately excluded from this frame sample because it competes for renderer resources; the WebM captures are recorded separately by the same harness. These are not Chrome DevTools Performance-panel recordings and were not collected on a physical phone. The captures reported no page errors, but device performance, thermal behavior and touch interaction remain unvalidated.

## Fix 4 - one canonical theme across both shells

Root cause restated: the React journey and legacy `/app` engine had separate fonts, color literals and navigation treatments. Both entry documents now load `/theme.css`, which defines the shared cream, navy and gold tokens and stable self-hosted Fraunces and Outfit font paths under `/fonts/`. React consumes those tokens directly; the legacy styles, journey styles, map controls, scene surface and postcard canvas use the same variables. The legacy header now follows the same brand and navigation structure while retaining its existing `data-nav` client routing and journey-status controls. Its provider text also names Esri World Imagery consistently.

Verification:

- `node --check public/app.js`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run check:app`: passed.
- `npx.cmd vite build`: passed; 1,690 modules transformed. Vite reported expected runtime-resolution warnings for `/theme.css` and the vendored MapLibre assets.
- `npx.cmd playwright test browser-tests/theme-consistency.spec.js browser-tests/cinematic-journey.spec.js`: 8 tests passed.
- The current focused animation/theme run above passed all 6 selected checks, including shared computed tokens, Fraunces/Outfit loading, brand/header geometry, accessible legacy mobile navigation, retained internal tab routing, and absence of the retired `#183e36` palette in the checked legacy sources.
- `theme-react-journey.png` and `theme-engine-app.png` are desktop headless-Chromium captures. During their capture, `document.fonts.check` returned true for Fraunces and Outfit and the page/console error lists were empty.

Limitations: the theme captures are desktop headless-Chromium evidence only. No physical-device, manual screen-reader or DevTools validation is claimed. The immersive journey header intentionally has a compact route-specific layout, so the two shells share identity, typography and tokens without having identical page structure. Browser behavior outside the tested Chromium environment remains unverified.

## Fix 1b / 1c - MapTiler runtime upgrade and readable Hybrid

Root cause restated: the map renderer already accepted runtime tile URLs, but neither interface requested a Worker-supplied configuration. The Worker also sent `Referrer-Policy: no-referrer`, which prevents origin-restricted MapTiler keys from being validated. Hybrid's former 0.92 label-overlay opacity obscured most of its imagery.

`GET /api/map-config` now returns `{ "provider": "esri" }` without a key and an uncached MapTiler configuration when `MAPTILER_KEY` is present. Both React and `/app` fetch it once in memory and pass it into the shared renderer. A tab-local browser key remains an optional override. The Worker now sends `strict-origin-when-cross-origin`; Hybrid uses zero imagery saturation and 0.35 label opacity. Selecting an attraction now flies to its own coordinate, which made the Big Hole inspection reliable rather than returning to Kimberley station.

Verification:

- The configured local Worker reported `provider: maptiler`, zoom 20, Hybrid opacity 0.35, the `api.maptiler.com` tile host and a populated key query without printing the credential.
- `harness/capture-maptiler-evidence.mjs` observed 324 MapTiler responses, all HTTP 200, correct MapTiler/OpenStreetMap attribution and no browser errors.
- `maptiler-satellite-kimberley-z17.png` shows the Big Hole as a recognisable crater at the mapped attraction coordinate.
- `maptiler-hybrid-kimberley-z17.png` shows the same imagery with the reference layer retained at readable opacity.
- `npx.cmd playwright test --config browser-tests/.provider.config.mjs`: 8 tests passed against the keyless Worker, including Esri satellite and Esri/EOX Hybrid recovery.
- `npm.cmd test`: 36 tests passed, including keyless/configured map-config responses, no-store caching, referrer policy, MapTiler attribution and Hybrid paint values.

The MapTiler key was loaded only from an ignored local `.dev.vars` during this proof and the file was removed afterward. No credential is in the repository or evidence output. Production was not changed during this local implementation pass.

## Fix 2 - Workers AI proof and visible assistant

Root cause restated: the static preview previously returned the React HTML shell for unimplemented `/api/*` requests, causing JSON parsing failures that appeared to be an AI defect. The real Wrangler Worker was configured and reachable. The API also accepted `creative` but not the plan's requested `draft` action.

The static preview now returns an explicit `preview-server-no-backend` JSON response for backend-only routes while still returning the keyless Esri map configuration. The AI route accepts `draft` as a public alias for its source-selection `creative` action, and its provider prompt more clearly requires a verbatim excerpt. Both UIs translate reason codes into concrete recovery messages. The React destination panel now exposes Explain, Start a conversation and Inspire a postcard actions with source IDs and review state.

Real-Worker verification is recorded in `ai-live-smoke.json`:

- `explain`: HTTP 200, `source-excerpt`, Workers AI, exact `freedom-park` passage.
- `hint`: HTTP 200, intentional deterministic-pack fallback.
- `icebreaker`: HTTP 200, `source-excerpt`, exact `freedom-park` passage.
- `draft`: HTTP 200, `source-excerpt`, exact `freedom-park` passage.
- deliberately unsupported breakfast question: HTTP 200, `insufficient-source-evidence`; no invented answer.
- `ai-react-grounded-excerpt.png` shows a real grounded `sol-plaatje` response in the React Kimberley panel; the capture reported no browser errors.

The first unauthenticated probe also identified the real `daily-assistance-budget-reached` gate. The successful five-action proof used a newly created carriage session, exercising the separate session quota without weakening or bypassing the persisted limits.

## Final regression

- `npm.cmd test`: 36 passed.
- `npm.cmd run check`: passed.
- `npm.cmd run check:app`: passed.
- `npm.cmd run security:scan`: passed after the ignored local secret file was removed.
- `npm.cmd run test:browser`: 18 passed, including the `/`, `/journey`, `/destinations`, `/stories`, `/plan`, `/credits` and `/app` smoke test with zero console errors and zero broken images.
- `npx.cmd playwright test --config browser-tests/.provider.config.mjs`: 8 passed.
- `npm.cmd run build`: passed; Vite transformed 1,692 modules, regenerated the 3,452,266-byte offline pack manifest, and Wrangler completed its deployment dry run.
