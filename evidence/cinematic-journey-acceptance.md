# Cinematic 2D journey — local browser acceptance

Run date: 2026-09-08 (Africa/Johannesburg). Baseline repository HEAD at run time: `a6cce8c`; the cinematic UI, attraction data, acceptance harness and this record were uncommitted working-tree changes. This is a local regression run, not evidence for the deployed Worker version, a physical phone, corridor GPS, route accuracy, user acceptance or TRL 5.

## Test environment

- Windows host, Node.js `v24.15.0`.
- Playwright `1.63.0`, bundled headless Chromium `153.0.8010.12`.
- Local HTTP origin `http://127.0.0.1:4173`, served from `public/` by `harness/static-server.js` with SPA fallback.
- Service workers enabled. The offline case installs the real manifest-verified pack, switches the Chromium context offline, and performs direct navigations.
- Replay uses the packaged trace `public/data/traces/demo-corridor.json`, labelled synthetic by the product. It is not corridor or field data.

## Result

Command: `npm run test:browser`

Result: **PASS, 5/5 tests**.

| Check | Actual observation | Scope limit |
| --- | --- | --- |
| Route, story and attraction markers | The rendered map kept its unverified-schematic label and OpenStreetMap attribution visible. Seven keyboard-focusable hub markers rendered; Enter opened a story preview with an offline chapter link. Every attraction with finite coordinates rendered as a separate keyboard-focusable marker; its preview stated that visibility and rail access are not established and linked to the coordinate source. | Desktop headless Chromium only. Marker usability on touch and assistive technologies is not established. Ungeocoded attractions remain intentionally absent. |
| Moving train and route progress | Starting the labelled replay showed `SIMULATED REPLAY`, rendered an accessible replay train marker, advanced the progress value above zero and drew a non-empty traversed-route SVG path. | Synthetic local replay only. This does not validate GPS accuracy or the schematic as railway alignment. |
| Reduced motion | Under `prefers-reduced-motion: reduce`, the replay train remained visible and journey status continued updating while computed animation was `none` with duration `0s`. | One emulated browser preference; no physical accessibility review. |
| Waiting and low power | The packaged stationary replay entered `.low-power`, rendered the fixed no-cause/no-restart-time copy, stated the 30-second foreground GPS delivery request, hid the map and disabled visual animation. | The browser check does not prove hardware GPS cadence, polling cessation outside the UI contract, or battery savings. R16 remains not run. |
| Offline journey and chapter | After a complete verified pack install, Chromium was disconnected. A direct Kimberley chapter navigation rendered from cache, reported Offline, and the root journey reopened with its local schematic map. | Local Chromium/service-worker check only. Interrupted installation, storage failure and physical-phone airplane-mode acceptance remain separate gates. |

## Defects found and retested

The first browser run found a root-screen crash caused by adding an empty Leaflet traversed polyline before the map had a view. The route bounds are now fitted before the traversed layer is initialized. A second run found replay stopped because `cumulative` in route-prefix calculation was declared constant, and found that Enter did not open a focused hub marker. The accumulator was made mutable and explicit Enter/Space handlers were added. The 5/5 result above is the rerun after those corrections.

## Adjacent checks

- `npm test`: **PASS, 22/22 component tests** on the corrected working tree. This suite does not execute `public/app.js`.
- `npm run check`: **PASS** on the corrected working tree. This checks Worker TypeScript and does not type-check the browser module.
- `npm run build`: **PASS** as a Wrangler dry run. The final regenerated pack manifest contains 30 files, 398,733 bytes, SHA-256 `7baf7340ab669beb38b80a117ddebc55d73d0f8a584e492e63193f74c88d3563`.
- `npm run test:browser`: **PASS, 5/5** again after that manifest regeneration.
- `npm run security:scan`: **PASS** for recognized credential signatures in the working tree, public assets, built Worker output and Git patch history. The existing presentation archive and vendored PNG assets remain outside content scanning and require the already-recorded manual release review.

The ordered release gates remain unchanged. T1 still needs a named physical-phone load check. T2 still lacks verified rail geometry. T5, T8 and R15 now have local Chromium evidence for the scoped behaviors above, but still require the declared physical-device and relevant-environment observations. R16 remains not run.
