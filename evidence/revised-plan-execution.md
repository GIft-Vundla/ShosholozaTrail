# Revised implementation execution

Date: 2026-09-08
Branch: `experiment/immersive-local-map`
Baseline: `f9f7639`

This pass implements the priorities in `CODEX_REVISED_IMPLEMENTATION_PLAN.md`: a mapped rail candidate, a recognizable Kimberley scene, and an interactive ride. It also integrates the existing source-locked Workers AI experiment and shared visual theme. Production was not redeployed during this pass.

## Rail geometry

- `data/acquire-rail.py` builds the corridor from OpenStreetMap railway ways using graph connectivity and haversine-weighted Dijkstra routing.
- The dated Geofabrik source extract is recorded in `data/provenance/rail-alignment.json`; the 419 MB raw PBF is excluded from Git.
- The detailed ride geometry contains 76,536 coordinates across all seven station-to-station segments. The overview contains 2,000 coordinates.
- Measured length: 1,582.417 km.
- Maximum adjacent detailed-point spacing: 24.375 m.
- Start and end checks are 15.905 m from Pretoria Station and 32.967 m from Cape Town Station.
- The Hex River sample covers 61.440 km along track over a 51.768 km endpoint distance, for sinuosity 1.1868.
- Detailed geometry SHA-256: `4af7762f6552ce7c3e57911ca91c4ffca4cac3bdd061686687c6702ed6e401ac`.
- Validation: `evidence/rail-alignment-validation.json` reports PASS.
- Visual proof: `evidence/rail-alignment-hexriver.png`.

The geometry is an automated, source-backed OSM rail candidate. Its graph connectivity does not establish a current passenger itinerary, timetable, operating condition, permission to alight, or field validation.

## Real-corridor trigger replay

`harness/run-corridor-traces.js` samples the shipped OSM overview geometry around all seven sourced trigger zones. It covers 40, 80, and 120 km/h; 1, 5, and 15 second sampling gaps; and both travel directions.

- Traces: 126
- Eligible encounters: 126
- Correct triggers: 126
- Wrong hub: 0
- Duplicate triggers: 0
- Missed triggers: 0
- Result: PASS in `results/r3-corridor.json`

These are synthetic positions on the mapped rail candidate. They are not phone GPS or carriage observations.

## Kimberley animation

The Kimberley scene now keeps the licensed Big Hole photograph visible and animates a photographic push and gentle crater-centered spiral. Decorative overlays occupy 4.6% of the frame; treated luminance is 96.4% of the untreated photograph.

- Photographic push: PASS
- Waiting-mode pause: PASS
- Reduced-motion complete still: PASS
- Runtime errors: 0
- Separate requestAnimationFrame sample: approximately 60 fps, p95 16.8 ms
- Measurements: `evidence/animation-kimberley-visual-proof.json`
- Visuals: `evidence/animation-kimberley-crater-start.png`, `evidence/animation-kimberley-crater-push.png`, and `evidence/animation-kimberley-crater-reduced.png`

## Interactive ride

The React application now exposes `/ride`. It lazy-loads the detailed mapped geometry, follows it with a low-aerial MapLibre camera, uses satellite imagery and terrain, and provides step, hold, automatic ride, and drag-to-look controls. Eight arrivals are matched within 10 km and open place-specific arrival panels. Reduced-motion mode uses immediate steps. The ride fails closed if the detailed route is missing, discontinuous, schematic, or unverified.

- Route visualization: `evidence/ride-karoo-final.png`
- Arrival payoff: `evidence/ride-arrival-matjiesfontein.png`
- Motion recording: `evidence/ride-karoo.webm`

The ride is explicitly labelled as a simulated camera over mapped geometry and satellite imagery. It is not train-window footage or a live train position.

## AI

The Worker supports an experimental source-locked Workers AI mode. It may return only an exact excerpt from an eligible registered source. Deterministic challenge hints remain local; unsupported requests fail safely. `evidence/ai-live-smoke.json` records successful explain, icebreaker, draft, and unsupported-request behavior using `@cf/zai-org/glm-4.7-flash`.

The fixed provider evaluation remains pending, so the product labels this mode experimental and keeps human source review visible.

## Release limits

- No physical-phone or carriage field validation was performed in this local pass.
- No claim of current passenger service or TRL 5 completion is made.
- Human or organiser review of the mapped itinerary is pending.
- Johannesburg is a mapped arrival with overview copy; it does not have a source-backed chapter trigger.
- Production remains on its prior deployment until the local revision is reviewed and explicitly deployed.
