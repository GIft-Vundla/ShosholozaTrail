# ShosholozaTrail

ShosholozaTrail is an install-free, offline-first journey companion for the Pretoria–Cape Town story corridor. The pilot combines a foreground GPS or clearly labelled synthetic replay pipeline, locally packaged stories and activities, a truthful waiting mode, saved postcards, an online carriage board, a moderated contribution workflow, and an in-product evidence console.

The current build is **working towards TRL 5; validation is incomplete**. It does not claim corridor field validation, a verified railway alignment, physical-phone acceptance, operator integration, community endorsement, second-language readiness, or demonstrated tourism and income impact.

## Pilot architecture

The pilot uses a PWA with vendored Leaflet and Turf assets, Cloudflare Workers and D1. This differs intentionally from the React Native/Supabase scale architecture in the original team profile: the pilot favors install-free QR entry, HTTPS hosting, offline use and a low-cost deployment path. The native scale architecture remains roadmap work.

AI is optional and off by default. Prepared stories, source passages, deterministic challenge answers, hints, journey triggers, waiting mode and saved work remain usable without it. The room and moderation APIs are online-only and are explicitly excluded from service-worker caching.

The current corridor line joins sourced OpenStreetMap station anchors with authored straight connectors. It is displayed as an **unverified schematic** and must not be used as rail routing, live tracking, departure, alighting or safety advice.

## Run and verify locally

Requirements: Node.js 22 or newer and a Cloudflare account for deployed Worker/D1 checks.

```bash
npm ci
npm test
npm run check
npm run harness:r3
npm run harness:ai
npm run build
npm run security:scan
npm run dev
```

Open the local URL printed by Wrangler. Use **Run labelled replay** for a conference-room demonstration; the UI labels this source as synthetic replay at all times. **Start live GPS** requests foreground browser geolocation and does not imply background or locked-screen support.

`npm run harness:r3` writes a real synthetic-laboratory run to `results/r3.json`. It does not create corridor or physical-phone evidence. `npm run harness:ai` currently verifies the disabled-provider fallback path and keeps the provider R10 status at `NOT RUN`. `npm run security:scan` requires `dist/`, scans the working tree, public and built output, and Git patch history, and reports binary artifacts that still require manual review.

## Deployment

Configure the D1 binding and apply `migrations/0001.sql`, then deploy with Wrangler. Keep provider credentials in Cloudflare Worker secrets; never place them in `.dev.vars`, repository files, browser assets, screenshots or evidence exports. `AI_ENABLED` remains `false` until the fixed 30/10/10 provider evaluation and failure gates pass.

T1 passes only when all of the following are retained for the exact release:

- the public HTTPS URL and `/api/health` response;
- a clean built-output and repository-history secret scan;
- a physical phone make/model, OS, browser, tested URL/build and observed result.

A desktop or local response does not complete the phone gate. Local work on later components is allowed while this remains pending, but it does not advance the ordered release gates.

## Evidence and source status

- `evidence/acceptance.md` freezes requirements R1–R16 and records the release-gate policy.
- `evidence/journey-design.md` defines the common GPS/replay engine contract and pre-test criteria.
- `evidence/research-notes.md` records route/content provenance and review limits.
- `results/r3.json` contains synthetic trigger-harness output with failure classes.
- `results/r10.json` keeps provider AI grounding at `NOT RUN` and separately identifies the local fallback check.

Every factual chapter points to `data/sources.json`. Entries are original paraphrases with attribution and rights notes, but human editorial approval remains pending. `data/route.geojson` and the trace headers state whether geometry is unresolved or synthetic. Preserve those labels in screenshots, slides and exports.

## Scope limits

This pilot includes three deep hubs (Kimberley, Beaufort West and Matjiesfontein) and four short chapters (Pretoria, De Aar, Worcester/Zwelethemba and Cape Town). It does not include bookings, payments, live operator or timetable feeds, automatic passenger matching, native builds, background geolocation, cached MapTiler tile archives, unlimited AI or unreviewed languages.

The earlier `ShosholozaTrail_Interactive_HTML_Prototype.html` remains an art-direction storyboard. It contains simulated interactions and is not the pilot application or acceptance evidence. The working pilot is served from `public/` through the Worker.
