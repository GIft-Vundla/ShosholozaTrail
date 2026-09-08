# Revised implementation plan

Date: 8 September 2026
Branch: `experiment/immersive-local-map`
Safety baseline: `f9f7639`

## Diagnosis

The last implementation cycle did useful foundation work: detailed Esri satellite imagery,
the optional MapTiler upgrade, live source-locked Workers AI, a shared visual theme, runtime
motion controls, and repeatable evidence capture. Those changes are preserved in the safety
baseline.

It did not yet deliver the central experience. The route remained a seven-point schematic,
the animation evidence proved that files existed rather than that places were recognisable,
and there was no first-person ride. The implementation also described some gaps accurately
instead of closing them. This revision evaluates visible and geographic outcomes.

## Execution order

The three workstreams may be built in parallel, but integration passes in this order:

1. Real rail geometry
2. Recognisable place animation
3. First-person ride on the acquired geometry
4. Integrated regression, evidence, commit, and deployment readiness

The published deployment stays unchanged until the integrated local build passes.

## Gate 1: mapped rail geometry

Acquire OpenStreetMap railway ways, build a connected graph, snap station anchors to rail,
and route between consecutive stations. Preserve source query details, OSM identifiers,
timestamps, hashes, and per-segment resolution status.

The stop model must reconcile Pretoria, Johannesburg, Kimberley, De Aar, Beaufort West,
Matjiesfontein, Worcester, and Cape Town. If the source cannot connect a segment, keep that
segment explicitly unresolved. Never invent rail coordinates or hide a gap.

Outputs:

- `data/route.geojson`: overview geometry with enough detail to show curves.
- `data/route-ride.geojson`: dense ride geometry, loaded only by the ride.
- acquisition script and cached/source provenance sufficient to reproduce the result.
- a report of point count, measured length, station snap distance, and resolved status for
  every consecutive station pair.

Pass criteria:

- The route has substantially more than the former seven coordinates.
- Every coordinate is finite and within the South African corridor.
- The measured length is reported from the data, not adjusted to match marketing copy.
- The Hex River alignment visibly follows railway curves over satellite imagery.
- `evidence/rail-alignment-hexriver.png` makes a straight schematic connector immediately
  distinguishable from the acquired alignment.

## Gate 2: recognisable local animation

Rebuild Kimberley first. The Big Hole is the subject, not a dark backdrop for an abstract
motif. Use the licensed place photograph at readable brightness and make motion follow a
feature that exists in that image. Only extend the treatment to other hubs after Kimberley
passes.

Pass criteria for Kimberley:

- A new viewer can point to the crater without reading the title or metadata.
- The source photograph remains at roughly 60% perceived brightness or higher.
- Decorative overlays cover no more than one-third of the visible frame.
- The motion leads the eye toward or around the actual crater and does not replace it.
- Visible photo credit remains present.
- Pause, page visibility, low-power waiting, and reduced-motion states work.
- `evidence/animation-kimberley.png` and the short capture prove the visible result.

Each later hub needs its own equally recognisable place feature and motion direction. Renamed
scene metadata, a generic overlay, or a heavily obscured photograph does not pass.

## Gate 3: first-person ride

Add a dedicated `/ride` route that lazy-loads the dense rail geometry. The page uses real
satellite imagery and terrain and positions the camera along mapped rail. It is a simulated
camera journey, clearly labelled as such.

Required behavior:

- Free-camera view follows a coordinate ahead on the rail rather than a fixed bearing.
- Forward and back move between sampled waypoints; holding forward produces continuous
  travel.
- Pointer or touch drag changes bearing and pitch without snapping back.
- Arrival detection uses hub identity and geographic proximity so the eight-stop UI cannot
  silently drift from the acquired route.
- An arrival card shows the matching licensed photo, local animation, distance, and sourced
  story link.
- Offline state explains that the ride needs online tiles and links to the packaged overview.
- Reduced motion keeps instant step controls and arrival content usable.

Pass criteria:

- The camera follows bends in the route and never crosses the landscape on the old straight
  hub-to-hub chords.
- Satellite tiles are visibly detailed at the tested location.
- A ten-second Karoo capture shows multiple successful steps with no stuck or black map.
- The Matjiesfontein arrival capture shows the correct real photo and story affordance.

Required evidence:

- `evidence/ride-karoo.webm`
- `evidence/ride-arrival-matjiesfontein.png`

## Gate 4: integration

Preserve the verified satellite provider recovery, Workers AI assistant, source locks,
credits, and shared theme. Remove stale UI claims derived from the schematic route and align
the stop count across the engine, React app, route data, and ride.

Run the repository tests, both TypeScript checks, security scan, production build, route
smoke test, provider recovery test, and targeted visual captures. Inspect evidence images;
their existence alone is not a pass.

Commit the integrated local result to the experiment branch. Deployment follows after local
review; production Cloudflare data and secrets are not changed during these workstreams.
