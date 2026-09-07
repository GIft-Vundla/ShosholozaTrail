# Journey engine contract and pre-test criteria

Build brief sections 5–7 control implementation; the implementation plan sections 7, 8 and 11 control readiness assessment. This is engineering design plus laboratory evidence, not corridor field validation.

## Interfaces and transactions

`createJourneyEngine({route,zones,fired=[],queue=[],onEvent,onState,persist})` accepts a GeoJSON LineString feature and separate `{hubId,sEnter,sExit}` metre intervals. It exposes asynchronous `push(fix)`, `acknowledgeChapter(hubId)` and synchronous `snapshot()`. A fix is `{lat,lon,accuracy,t,source:'gps'|'replay',traceId?}`; timestamps are milliseconds. Every push goes through the same projection, plausibility, state and trigger implementation in browser and Node.

`persist(snapshot,eventBatch)` is an optional async integration adapter. In the passenger app it must atomically store the snapshot and event batch in IndexedDB before resolving. The engine commits and notifies observers only after it resolves. A rejected storage write leaves the old engine state intact; the caller surfaces recovery and can retry the same fix. Restore `fired` and `queue` for the saved journey before attaching a position source. Drafts must use their own object store and must not be cleared by journey updates. Concurrent pushes serialize. Observers cannot undo successful persistence. A new journey is a new instance and a new persisted journey identifier; source changes within a journey retain its fired set.

`createReplaySource(trace,{rate,onError})` accepts JSONL or `{header,fixes}`, exposes `start(async consume)`, `stop()` and `replayAll(async consume)`. Every emission carries `source:'replay'` and the provenance header's `traceId`. `createGpsSource({onError,sampleIntervalMs})` exposes `start`, `stop`, `setSampleInterval`. The app starts GPS only after explicit passenger action/permission and must render a permanent live/replay label. Waiting calls `setSampleInterval(30000)` and stops other polling/animation. This lowers accepted-fix delivery and requests low accuracy: browser `watchPosition` does not guarantee a hardware sampling cadence or measured battery savings.

## Exact rules

- Reject malformed coordinates, timestamps, accuracy and source labels. Reject equal/older timestamps within a source stream; switching streams establishes a fresh baseline.
- Project with locally vendored Turf `nearestPointOnLine`, in metres. Greater than 2,000 m from the line sets `offRoute` and awards nothing.
- Reject either geographic or along-route implied speed greater than 200 km/h, measured from the previous accepted fix. Rejected fixes do not become the accepted baseline.
- The first accepted fix establishes a baseline; it does not award a hub merely because it lands inside a zone. Manual access remains available.
- Award when the closed interval between consecutive accepted route positions intersects the hub's closed trigger interval, including endpoints. Forward and reverse travel both qualify. Sort simultaneous triggers in travel order.
- Award each hub once per journey. Repeated overlapping segments log `suppressedRepeat:true`, `fired:false`, `eligible:false`; these are suppressed attempts, not duplicate awards. Trigger events append to the saved queue and never initiate audio or replace an open draft. Only explicit acknowledgement removes a queued chapter.
- Off-route re-entry and source changes break segment continuity. The returning fix establishes a new baseline, avoiding awards across unobserved off-route travel.
- `unknown → moving`: at least three accepted observations and more than 100 m displacement from the initial observation. This window accumulates until motion is established; using only the last three one-second observations would never detect ordinary slower travel.
- `moving → waiting`: median absolute inter-fix displacement below 50 m, for strictly more than eight minutes, **and a total observation-position envelope below 100 m**. This additional safety interpretation prevents a 120 km/h train sampled every second (33 m per fix) from being described as stationary. The guard tightens the literal brief condition; it does not lower an acceptance threshold.
- `waiting → moving`: displacement greater than 200 m on each of two consecutive accepted fixes. Interrupted movement resets the consecutive-fix count. This literal threshold can delay exit at frequent sampling; the waiting-mode source uses 30-second delivery.
- An accepted observation gap greater than 120 seconds clears state evidence to `unknown`. It cannot establish sustained stationarity. `offRoute` re-entry also restarts state evidence.
- Record waiting entry and exit events. Fixed copy may describe observed inactivity, with no official cause, predicted duration or restart time. The waiting time anchor is the beginning of the observed stationary window, not the time its eight-minute threshold was crossed.

## Independent R3 oracle and frozen threshold

`harness/run-traces.js --generate` produces 126 JSONL traces: 40/80/120 km/h × 1/5/15 second updates × two directions × seven synthetic hub intervals. Each trace prescribes a single labelled hub passage in its provenance header **before the engine runs**. Coordinates are calculated analytically on an equatorial line, without importing the engine projection or crossing helpers to derive expected outcomes. Each short trajectory stays clear of the other six intervals. The engine receives all seven intervals, allowing unexpected awards to be detected.

The eligible denominator comes from the input labels, not from whatever encounters the engine happens to log. This catches an engine that silently drops all events. Actual awards come exclusively from the production engine's `onEvent` encounter stream. The harness reports expected labels absent from awards as missed, unexpected IDs as wrong-hub awards, and repeated awards as duplicates; every failure remains in `results/r3.json`. `correctHub:null` in raw runtime logs means no ground-truth label was available. The harness assigns correctness by comparing to independent fixture labels; live GPS never self-certifies its own accuracy.

Frozen pass criteria: at least 100 labelled eligible encounters; at least 95% correct; zero wrong-hub awards; zero duplicate awards. The generated profiles include 20 m intervals skipped completely between samples at faster/sparser profiles. This proves interval-crossing behavior under these prescribed mathematical inputs. It does not verify South African railway geometry, phone geolocation, real carriage reception or replay representativeness.

`node --test tests/engine.test.js` separately checks boundaries, direction, jitter, suppression, queue preservation, rejected timestamps/jumps, off-route re-entry, persistence rollback, restart suppression, serialized writes, moving-state false positives, waiting thresholds/exit, observation gaps and source contracts. Tests are separate from the measured R3 denominator.

`node harness/run-traces.js --generate-demo` produces `data/traces/demo-corridor.json` from the current route and Matjiesfontein zone, preserving its unresolved confidence. It asserts that the actual engine emits a chapter award, a waiting entry and a resumed-movement exit. This short synthetic demonstration is excluded from the independent R3 denominator. Regenerate whenever route or trigger data changes.

## Remaining acceptance evidence

Physical-phone restart and airplane-mode tests must verify the IndexedDB integration. R4 must exercise real audio/draft interruption. R16 must measure actual battery start/end, hardware, duration and source sampling settings; no delta is inferred from code. Corridor route and hub review remains an upstream gate independent of this laboratory fixture. T4/R3 laboratory success alone cannot establish TRL 5.
