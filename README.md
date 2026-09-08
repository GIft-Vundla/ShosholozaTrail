# ShosholozaTrail

ShosholozaTrail is an install-free, offline-first journey companion for the Pretoria–Cape Town story corridor. The pilot combines a foreground GPS or clearly labelled synthetic replay pipeline, locally packaged stories and activities, a truthful waiting mode, saved postcards, an online carriage board, a moderated contribution workflow, and an in-product evidence console.

The current build is **working towards TRL 5; validation is incomplete**. It does not claim corridor field validation, physical-phone acceptance, operator integration, community endorsement, second-language readiness, or demonstrated tourism and income impact. The mapped rail candidate is graph-connected and source-backed, but the current or historic passenger itinerary still needs human or organiser review.

## Pilot architecture

The pilot uses a React PWA and a companion journey-engine shell with vendored MapLibre and Turf assets, Cloudflare Workers and D1. This differs intentionally from the React Native/Supabase scale architecture in the original team profile: the pilot favors install-free QR entry, HTTPS hosting, offline use and a low-cost deployment path. The native scale architecture remains roadmap work.

AI remains optional. This local experiment enables a clearly labelled, source-locked Workers AI mode while keeping the release-validation flag false. It can only select an exact excerpt from one registered source, and draft sources are returned with a human-review-pending label. Prepared stories, source passages, deterministic challenge answers, hints, journey triggers, waiting mode and saved work remain usable without it. The AI, room and moderation APIs are online-only and are explicitly excluded from service-worker caching.

The overview and `/ride` use an automated OpenStreetMap rail-graph candidate with 76,536 detailed coordinates, seven connected station-to-station segments and eight mapped station anchors. Its measured length is 1,582.4 km. This establishes mapped geometric continuity; it must not be presented as a confirmed current service, timetable, live train position, permission to alight, or safety advice.

## Run and verify locally

Requirements: Node.js 22 or newer and a Cloudflare account for deployed Worker/D1 checks.

```bash
npm ci
npm test
npm run check
npm run harness:r3
node harness/run-corridor-traces.js
npm run harness:ai
npm run build
npm run security:scan
npm run dev
```

Open the local URL printed by Wrangler. Use **Run labelled replay** for a conference-room demonstration; the UI labels this source as synthetic replay at all times. **Start live GPS** requests foreground browser geolocation and does not imply background or locked-screen support.

`npm run harness:r3` writes the analytic synthetic-laboratory run to `results/r3.json`. `node harness/run-corridor-traces.js` separately validates synthetic movements against the shipped curved OSM corridor and writes `results/r3-corridor.json`; neither is phone GPS or field evidence. `npm run harness:ai` without `--provider` verifies only the disabled fallback and keeps R10 at `NOT RUN`; the experimental binding does not turn that fallback run into provider evidence. `npm run security:scan` requires `dist/`, scans the working tree, public and built output, and Git patch history, and reports binary artifacts that still require manual review.

## Deployment

Configure the D1 binding and apply `migrations/0001.sql`, then deploy with Wrangler. The Workers AI binding uses the Cloudflare account directly and requires no provider secret. The experiment sets `AI_ENABLED=true`, `AI_EXPERIMENTAL=true`, and keeps `AI_VALIDATED=false`; this permits local source-locked testing without claiming the fixed 30/10/10 provider gate has passed. If another provider is used later, keep its credential in a Cloudflare Worker secret and never place it in `.dev.vars`, repository files, browser assets, screenshots or evidence exports.

T1 passes only when all of the following are retained for the exact release:

- the public HTTPS URL and `/api/health` response;
- a clean built-output and repository-history secret scan;
- a physical phone make/model, OS, browser, tested URL/build and observed result.

A desktop or local response does not complete the phone gate. Local work on later components is allowed while this remains pending, but it does not advance the ordered release gates.

## Evidence and source status

- `evidence/acceptance.md` freezes requirements R1–R16 and records the release-gate policy.
- `evidence/journey-design.md` defines the common GPS/replay engine contract and pre-test criteria.
- `evidence/research-notes.md` records route/content provenance and review limits.
- `results/r3.json` contains analytic synthetic trigger-harness output with failure classes.
- `results/r3-corridor.json` contains the same trigger profiles sampled from the shipped mapped rail geometry.
- `results/r10.json` keeps provider AI grounding at `NOT RUN` and separately identifies the local fallback check.

Every factual chapter points to `data/sources.json`. Entries are original paraphrases with attribution and rights notes, but human editorial approval remains pending. `data/route.geojson`, its provenance record and the trace headers distinguish the mapped candidate from synthetic movement and field evidence. Preserve those labels in screenshots, slides and exports.

## Scope limits

This pilot includes eight mapped ride arrivals, three deep sourced hubs (Kimberley, Beaufort West and Matjiesfontein), and four short sourced chapters (Pretoria, De Aar, Worcester/Zwelethemba and Cape Town). Johannesburg is a mapped arrival with overview copy and no source-backed chapter trigger. The online `/ride` lazy-loads detailed rail geometry and satellite/terrain tiles; the offline pack retains the overview and sourced stories. The pilot does not include bookings, payments, live operator or timetable feeds, automatic passenger matching, native builds, background geolocation, cached tile archives, unlimited AI or unreviewed languages.

The earlier `ShosholozaTrail_Interactive_HTML_Prototype.html` remains an art-direction storyboard. It contains simulated interactions and is not the pilot application or acceptance evidence. The working pilot is served from `public/` through the Worker.
