# Ride polish verification — 2026-09-08

- Hex River prompt is rendered only from 40 km before Worcester station to 8 km after it. At 1,380 km its measured box was `x=1188.9, y=96, w=169.1, h=51`; the route readout was `x=24, y=679, w=462.9, h=76`, with no overlap.
- Default camera is zoom 16, pitch 87 degrees and terrain exaggeration 1.8.
- Sound is opt-in and synthesized locally with the Web Audio API: low rail rumble, speed-linked wheel rhythm, discovery/arrival chimes, and one browser-local narrated arrival line.
- Arrival pauses travel, introduces a full-frame light transition, reveals the licensed photograph, and then exposes the localized scene, sourced overview and AI source finder.
- The verified detailed rail file is included in the 5.1 MB offline pack. With the browser disconnected, `/ride?hub=pretoria` renders the local rail world and arrival without remote tiles.
- Verification: 46 unit/backend tests passed; 25 browser tests passed before the final offline ride assertion; the focused ride/journey suite then passed 10/10 including full offline pack installation and offline `/ride` startup. TypeScript checks and secret scan passed.

Visual evidence: `ride-challenge-gated.png` and `ride-arrival-upgraded.png`.
