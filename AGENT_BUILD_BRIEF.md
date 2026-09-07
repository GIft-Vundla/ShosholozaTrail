# ShosholozaTrail — Agent Build Brief (TRL 4 hard target, TRL 5 stretch)

**Written:** 8 September 2026. **Hackathon:** 25–27 Sep 2026, BCX HQ Centurion. **Build weekend:** ~47 hours.
**Days remaining before the event:** 17.

This brief supersedes the *sequencing* in `ShosholozaTrail_TRL5_Implementation_Plan.md`. That document's
*standards* (sections 7, 8, 11) are retained verbatim as the acceptance bar. Its *timeline* (6–8 weeks,
360–640 team-hours) is not executable in 17 days and is replaced by the phasing in section 8 below.

---

## 0. Non-negotiables — read before writing any code

| # | Rule | Why |
|---|---|---|
| N1 | **The app must fully function with the network pulled and AI switched off.** Offline is not a degraded mode; it is the default mode. | The demo happens in a conference room, not on a train. Organiser feedback was explicit: "align more to sense of reality (less AI reliance)". |
| N2 | **No CDN for anything on the critical path.** Vendor Leaflet, Turf, fonts and icons into `public/vendor/`. | A CDN-dependent "offline-first" app is a contradiction and R5 will fail. |
| N3 | **No provider secret ever reaches the browser bundle, the repo, or a screenshot.** | Acceptance criterion R14. The keys currently sitting in `API keys.txt` are burned — rotate them and put the new ones in Worker secrets only. |
| N4 | **Never assert a fact the app cannot source.** No invented delay reasons, no invented durations, no invented narrators, no fabricated citations. | R2 and R10. This is also the single thing that separates this team from every other AI wrapper in the room. |
| N5 | **Every number in the evidence console must come from a real run.** No seeded values, no hardcoded "97%". | If a judge taps the console and the number is fake, the whole TRL claim collapses. |
| N6 | Replay/simulated position and live GPS position must be **visually distinct at all times** and labelled in every screenshot and slide. | Plan §5. Mislabelling a replay as a field test is the fastest way to lose credibility. |

---

## 1. Ground truth — what actually exists today

- `ShosholozaTrail_Interactive_HTML_Prototype.html` — a **static 6-frame click-through storyboard**. 158 lines
  of JS doing `querySelector` and class toggling. **Zero** map, geolocation, service worker, IndexedDB,
  storage, SVG or network calls. Treat it as **art direction and copy deck only**. Do not extend it.
- Team profile PDF — a strong lean canvas with named revenue figures (R4,000–R8,000/mo operator SaaS;
  10–15% booking commission; R25–R45 per learner; R500–R1,500 per verified location to custodians).
  **This is what got the team selected.** The build must make that canvas look inevitable, not contradict it.
- `all info.txt` — problem framing and threat model. The problem framing is genuinely strong: named,
  documented, real. Build subset of the security model listed in section 9; cite the rest as design.
- **Honest current readiness: TRL 2–3.** Concept formulated, storyboard exists, nothing validated.

### Stack conflict to resolve on day one
The submitted team profile claims **React Native + FastAPI + PostgreSQL + Supabase + Mapbox + Firebase**.
The TRL 5 plan specifies **PWA + Leaflet + MapTiler + Cloudflare Workers + D1**. The judges have the first
document.

**Resolution to adopt, and to state on a slide before anyone notices it:** the Cloudflare/PWA stack is the
*pilot* implementation, chosen because install-free QR entry, HTTPS by default and a zero-cost free tier are
what a passenger boarding at Pretoria actually needs. The Supabase/React Native architecture is the *scale*
architecture and stays in the roadmap. Frame it as an engineering decision with a reason, not as drift.

---

## 2. Scope freeze

### IN — build these
1. Install-free PWA, QR entry, HTTPS, service worker, real installable content pack.
2. **Journey Engine** — one position pipeline consuming live GPS *or* a replay trace through an identical
   interface (section 5). This is the technical core; everything else consumes it.
3. **Three deep hubs**: Matjiesfontein, Kimberley, Beaufort West. The other four (Pretoria, De Aar,
   Worcester/Zwelethemba, Cape Town) ship as **short sourced chapters with no mode activities**, clearly
   marked as such. Depth over breadth.
4. **The Delay Engine** — the differentiator (section 3.1).
5. Adventure mode: one reusable challenge component, deterministic sourced answers, 3-step hint ladder.
6. Creative mode: postcard editor — save, reopen, export to a PNG file.
7. **Custodian contribution + moderation queue** (T11) — this is what makes it a platform, not an app.
8. **Evidence Console** (section 3.2) — the live self-measuring TRL dashboard.
9. Replay/trace harness producing real R3, R10 and R12 numbers (section 7).
10. AI as a **thin, optional, clearly labelled assistive layer** — off by default, app fully usable without it.

### OUT — do not build, and say so out loud
Bookings, payments, real-time multi-device matching, live operator/timetable integration, background or
locked-screen geolocation, native app builds, 3D, languages beyond English plus one reviewed second
language, unlimited AI, vector-database retrieval.

**Networking mode is demoted.** It is the highest-risk, lowest-defensibility feature: it needs multiple real
devices, real-time sync and a real crowd to be anything other than a mock. Ship a **carriage code + shared
discussion board** (join, post, read, strict room isolation, D1-backed) and put the matching engine on the
roadmap. A demoted honest feature beats a demoed fake one under a theme called "Build for Use".

---

## 3. The two things that win this hackathon

### 3.1 The Delay Engine — "the delay is the product"
Every comparable product (Bernina Express digital companion, VoiceMap, Questo) assumes the vehicle is
**moving** and the network is **up**. The documented South African reality is the opposite: 27–36 hour
journeys, three of four PRASA long-distance routes suspended indefinitely since October 2024, and
passengers Siphesihle Manzini and Zubenathu Ngondi stranded eight hours at Laing's Nek at 1am with no power.
**Nobody else is building for the stationary, dark, disconnected hour.** That is the defensible position.

Implement:
- Detect a `waiting` state from the Journey Engine (definition in 5.4). **Never claim a cause or a duration.**
  The UI copy is fixed and truthful: *"The train has not moved for 23 minutes. We don't have an official
  reason or a restart time. Here's what's around you, and something to do."*
- On entering `waiting`, surface: the nearest sourced story regardless of trigger state, one short cached
  activity, a creative prompt, and a low-power reading mode (dark, no animation, no polling).
- Log every `waiting` entry and exit with its duration into the evidence console.
- **Power discipline:** on `waiting`, drop geolocation to 30-second sampling, stop all polling, stop
  animation. Measure and display the battery-drain delta. This is the R16 endurance evidence *and* the
  strongest demo moment in the build.

### 3.2 The Evidence Console — a live TRL dashboard inside the product
Section 8 of the existing plan is a table in a document. Turn it into a **screen inside the app** at
`/evidence`. No other team will walk up to a judge and tap a live counter. It converts every claim from
assertion into demonstration and speaks directly to judging criterion 3 ("evidence of thorough research...
does the team have a game plan").

It must render, from real stored data only:
- **R3 trigger accuracy** — `correct / eligible`, with failure classes broken out, per speed and sample-rate profile.
- **R5/R6 offline** — cache manifest hash, bytes installed vs expected, last successful install, current
  online/offline/last-synced state, and a **"simulate storage failure"** button that proves the last good
  pack and all drafts survive.
- **R10 AI grounding** — score over the fixed 30/10/10 question set, with the fabricated-citation count (must be 0).
- **R12 performance** — measured p50/p95 for offline first paint, cached chapter open, AI response or fallback.
- **R16** — last endurance run duration, battery start/end, restarts.
- **Provenance panel** — every factual claim in the pack linked to its source record and review date.
- A permanent, prominent **"Not yet validated"** list: corridor field conditions, untested devices,
  unreviewed languages. Volunteering your limits is the most credible thing on the screen.

---

## 4. Repository layout

```
shosholoza-trail/
  wrangler.toml
  package.json
  src/
    worker.ts              # Cloudflare Worker: API + static assets binding
    routes/
      ai.ts                # POST /api/ai — server-side Gemini only, budgeted, circuit-broken
      rooms.ts             # POST/GET /api/rooms/* — carriage board, D1, room-isolated
      contrib.ts           # POST /api/contributions, GET /api/moderation (role-gated)
      health.ts            # GET /api/health — provider status, quota state, model id
  public/
    index.html
    app.js                 # shell + router
    engine/
      journey.js           # THE CORE — position pipeline (section 5)
      triggers.js          # segment-crossing logic
      state.js             # moving | waiting | offRoute | unknown
      replay.js            # trace player, identical interface to geolocation
    storage/
      pack.js              # Cache Storage install / verify / rollback
      drafts.js            # IndexedDB: creative drafts, progress, trigger log
    ui/                    # screens
    vendor/                # leaflet, turf — VENDORED, no CDN
    sw.js                  # service worker; NEVER caches /api/ai or /api/rooms
  data/
    route.geojson          # rail alignment, ONE named source, versioned
    hubs.json              # station | trigger-zone | attraction as SEPARATE record types
    pack.v1.json           # chapters, activities, hint ladders
    sources.json           # source register: url, author/institution, passage, pub date, review date, rights
    traces/                # *.jsonl — each with a provenance header
  harness/
    run-traces.js          # headless replay -> results/r3.json
    ai-eval.js             # 30 answerable / 10 unsupported / 10 adversarial -> results/r10.json
  results/                 # real measurement output, read by the evidence console
  evidence/                # the section 11 evidence folder
```

---

## 5. The Journey Engine — build this first, get it exactly right

Everything else consumes it. It is also the entire TRL 4 argument.

### 5.1 One interface, two sources
```js
// A PositionSource emits: { lat, lon, accuracy, t, source: 'gps'|'replay', traceId? }
// Consumers MUST NOT know which one they are attached to.
createGpsSource(opts)      // navigator.geolocation.watchPosition, foreground only
createReplaySource(trace)  // plays a .jsonl trace at 1x or Nx
```
This single decision is what lets the same code path serve the live demo, the conference-room demo and the
headless measurement harness. **Do not fork the logic.**

### 5.2 Projection, not proximity
For every fix:
1. `turf.nearestPointOnLine(routeLine, fix)` gives `{ distToLine, alongDistance }`.
2. **Reject** if `distToLine > 2000 m` — state becomes `offRoute`, log as rejected, fire no triggers.
3. **Reject** if implied speed from the previous accepted fix exceeds `200 km/h` — log as `implausible`.
   (This doubles as the GPS-spoofing plausibility check the threat model calls for.)
4. Direction = `sign(alongDistance - prevAlongDistance)`.

### 5.3 Triggers are segment crossings, never point radii
Each hub trigger is an **interval along the route**: `{ hubId, sEnter, sExit }` in metres from route origin.

```
fired  <=>  [min(sPrev, sNow), max(sPrev, sNow)]  overlaps  [sEnter, sExit]
```

This is mandatory. The existing plan raises the problem — *at 120 km/h a 15-second update gap spans about
500 m and a small circular trigger can be skipped entirely* — but does not solve it. Interval overlap solves
it completely, and it is what makes the ≥95% R3 criterion achievable rather than aspirational. Copying a
walking-tour radius will fail R3.

Additional rules:
- Fire **once per hub per journey**; persist the fired set to IndexedDB so a reload cannot re-award.
- Newly fired chapters **queue**; never interrupt playing audio or an open creative draft.
- **Every chapter has a manual entry point.** A missed trigger must never mean lost content.
- Log every eligible encounter with `hubId, fired, correctHub, duplicate, speed, sampleGap, direction,
  traceId, source`. The harness reads exactly this log — no separate instrumentation.

### 5.4 State machine
```
unknown -> moving   : >=3 accepted fixes with |delta s| > 100 m over the window
moving  -> waiting  : median |delta s| < 50 m sustained for > 8 minutes
waiting -> moving   : |delta s| > 200 m over 2 consecutive accepted fixes
any     -> offRoute : distToLine > 2000 m
```
`waiting` asserts **only** "not moving for N minutes". It asserts nothing about why, or for how much longer.

---

## 6. Build order — each task has a binary acceptance test

Do them in order. Do not start a task before the previous test passes.

| # | Task | Acceptance test |
|---|---|---|
| T1 | Cloudflare Worker + Static Assets on HTTPS; `/api/health` returns model id and provider status. | Public URL loads on a phone. Secrets absent from built output (grep it). |
| T2 | `data/route.geojson` Pretoria–Cape Town from ONE named open source; continuity inspected; unresolved connectors marked `confidence: "unresolved"`. | Rendered line has no unexplained breaks. Schematic segments are visibly styled as unverified. |
| T3 | `hubs.json` with station, trigger-zone and attraction as three separate record types; `sEnter`/`sExit` computed along the route. | A trigger zone can be edited without moving a station, and vice versa. |
| T4 | Journey Engine (section 5) + replay source + synthetic traces at 40/80/120 km/h crossed with 1/5/15 s sampling. | Headless harness runs and writes `results/r3.json` with a real number. |
| T5 | Map screen: Leaflet vendored; MapTiler raster when online; **packaged GeoJSON overview layer** (line, towns, pins, blank background, no tiles) when offline. Live vs replay visually distinct. | Airplane mode: map still orients. MapTiler tiles are never written into the pack — their terms forbid redistributing an offline archive. |
| T6 | Content pack v1: 3 deep + 4 short chapters, transcripts, `sources.json` complete. Service worker installs by manifest hash, verifies, rolls back on failure. | Kill the download mid-install: previous complete pack and all drafts survive; a partial pack **never** reports ready (R5, R6). |
| T7 | Adventure challenge component + 3-step hint ladder; answers come from `pack.v1.json`, never from a model. | Answer correctness is identical with AI on and AI off. |
| T8 | **Delay Engine** (3.1) + low-power waiting mode. | Feed a stationary trace: `waiting` fires, fixed truthful copy renders, sampling drops to 30 s, polling stops. |
| T9 | Creative postcard: edit, save to IndexedDB, close app, reopen, export PNG. | Draft survives a hard reload and airplane mode. Any AI edit requires explicit accept and preserves the original. |
| T10 | Carriage-code board on D1: join by code, post, read, strict room isolation. | Room A cannot read room B by any request. A code in the URL alone grants nothing — server-validated session token required. |
| T11 | Custodian contribution + moderation queue: submit a story with a source URL, role-gated review, publish into pack v2. | An unmoderated submission is invisible to passengers. |
| T12 | AI layer: `/api/ai` server-side only, four scoped actions, retrieval from `sources.json` passages, returned source IDs validated against the register, explicit insufficient-evidence path, per-session and global budget, timeout, circuit breaker. | `harness/ai-eval.js` over 30/10/10 writes `results/r10.json`. **Zero fabricated citations**, or the feature ships disabled. |
| T13 | **Evidence Console** (3.2) reading `results/*.json` plus live IndexedDB logs. | Every number on screen traces to a real run. Kill the network: console still renders from cache. |
| T14 | Failure injection: 429, timeout, malformed AI output, provider down, storage full. | Core journey unbroken in all five cases (R11). |
| T15 | Endurance: 4-hour defined-use run, plus 10 concurrent sessions against your own Worker with a **stubbed** upstream AI. | Battery, network and D1 usage recorded in the console. Do not load-test third-party APIs. |

---

## 7. The harness — how R3, R10 and R12 become real numbers

`harness/run-traces.js`:
- Imports `engine/journey.js` **unmodified** — this is why 5.1 matters.
- Replays every trace in `data/traces/`, each carrying a provenance header:
  `{ traceId, provenance: "synthetic" | "measured" | "sourced", speedKmh, sampleGapS, direction, notes }`.
- Target: at least 100 labelled eligible encounters across the profile matrix.
- Writes `results/r3.json`: `{ eligible, fired, correctHub, wrongHub, duplicates, missed, byProfile, generatedAt, engineVersion, routeVersion }`.
- **Failure classes are reported, not hidden.** A missed trigger that stays manually reachable is a different
  class from a wrong-hub trigger; the console shows them separately.

`harness/ai-eval.js`: the fixed 30 answerable / 10 unsupported / 10 adversarial prompt set, re-run after
**any** prompt or model change. Writes `results/r10.json`.

Every synthetic coordinate stays in `data/traces/` and is **never** relabelled as corridor field data. If a
local Gauteng train or walking test is run, it enters as `provenance: "measured"` with its real location
named — a Centurion street is a Centurion street, not Matjiesfontein.

---

## 8. Honest phasing — what is claimable, and when

| Milestone | Date | Claim you may make |
|---|---|---|
| **Pre-event build** | by 24 Sep | T1–T9 complete. **TRL 4** — critical components (engine, triggers, offline pack, delay state) validated in a laboratory environment with documented synthetic traces on real phones. |
| **Build weekend** | 25–27 Sep | T10–T15. **Working towards TRL 5** — end-to-end hosted system on real devices with real services, measured against pre-frozen criteria, with the relevant-environment rationale and its gaps stated openly in the console. |
| **After** | — | TRL 5 confirmed only if the section 7 environment rationale survives independent review. |

**Freeze the acceptance thresholds before testing, not after.** If R3 lands at 91%, report 91% and the
failure classes. A team reporting 91% honestly with a live console beats a team claiming 99% on a slide,
under a theme literally called "Build for Use" and the question "Would a real user trust and use this?"

---

## 9. Security subset to actually implement (the rest stays documented design)

Server-validated session tokens with expiry; room isolation enforced in D1 queries, not in the UI; schema
validation on every Worker route; rate limits per session plus a global AI budget; allow-listed CORS;
MapTiler key restricted to approved origins; Gemini key in Worker secrets only; service worker explicitly
excluding `/api/ai` and `/api/rooms` from caching; contribution uploads restricted by MIME type, file
signature and size with server-generated filenames; geolocation requested only at journey start with
explicit permission copy; no precise location history persisted server-side.

---

## 10. Do not

- Do not extend the storyboard HTML. Start clean; reuse its copy and visual language only.
- Do not use a road-routing API as a train-routing authority.
- Do not cache MapTiler tiles into the offline pack.
- Do not let a model produce or alter a challenge answer or a historical fact.
- Do not simulate testers. If fewer than six people test it, report the real number.
- Do not exhaust free-tier quotas load-testing someone else's infrastructure.
- Do not present a replay as a field test in any screenshot, slide, or sentence.
