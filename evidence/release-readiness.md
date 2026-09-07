# Pre-release verification record

Record date: 2026-09-08 (Africa/Johannesburg). Baseline commit: `c1c6befe348dca6d0355640daad4d3d86fbe9ad5` plus an uncommitted build worktree. Assessment status: **working towards TRL 5; release acceptance incomplete**.

This record captures local component checks plus automated smoke runs against final deployment version `7e8d7d9b-7595-4afa-bf94-87b48cff8cfa` at `https://shosholozatrail.giftvundla22.workers.dev`. It is not evidence for a physical phone, a live AI or MapTiler provider, corridor field performance, a human trial, an endurance run or independent assessment. R1–R16 remain governed by `evidence/acceptance.md`; a component or narrower-scope smoke PASS below does not advance an ordered T1–T15 release gate.

## Local checks completed

| Check | Actual result | Scope and artifact |
| --- | --- | --- |
| `npm test` | PASS, 22/22 tests | Node component tests for journey behavior, persistence failure, room authorization/isolation, moderation, AI validation and controlled provider failures. No browser, phone or live-service claim. |
| `npm run check` | PASS | TypeScript static check. |
| `npm run harness:r3` | COMPONENT PASS, 126/126 correct eligible encounters; 0 wrong hub, duplicates or missed | `results/r3.json`, generated `2026-09-07T22:40:13.553Z`; 126 synthetic analytic equatorial traces across 40/80/120 km/h, 1/5/15 s and both directions. This is explicitly not corridor or phone GPS evidence. |
| `npm run harness:ai` | Provider R10 **NOT RUN**; disabled fallback PASS, 50/50 safe responses, 0 citations | `results/r10.json`, generated `2026-09-07T22:39:11.638Z`. No provider was called; AI remains disabled. |
| Final build and deployment | PASS | 29 packaged files, 366,104 bytes, manifest SHA-256 `382a3d57ef83f67bcc8b7779bfac42fbc353f4a04152fe539c30148201848d89`, deployed as Worker version `7e8d7d9b-7595-4afa-bf94-87b48cff8cfa`. |
| `npm run security:scan` | PASS after build | Scanned the working tree, `public/`, built Worker output and committed Git patches. A deliberately fake Google-key fixture was detected during a negative control and removed before the final PASS. Values are never printed. |
| Presentation archive text scan | PASS | OOXML text in `ShosholozaTrail_Final_Deck.pptx` contained no recognized Google/OpenAI/GitHub/AWS/Slack/private-key signature. Embedded media still requires visual review before release. |
| Pack/source structure audit | PASS for structure | Seven chapters: three deep and four short; every chapter source ID resolves to one of nine register records. All nine records still state human review pending, so this does not pass R2. |
| Critical-path URL inspection | PASS for local dependencies | No remote script, stylesheet, font or tile URL is present in the current shell. The only shell URL is the visible OpenStreetMap attribution link. This also confirms that the full online MapTiler part of T5 is not implemented. |

Generated Python bytecode under `data/__pycache__/` was removed as repository hygiene. Vendored Leaflet PNGs and the presentation archive are binary and are listed by the scanner rather than silently treated as scanned text.

## Hosted smoke observations

| Check | Actual result | Scope and cleanup |
| --- | --- | --- |
| HTTPS and direct SPA routes | PASS in automated desktop/browser smoke | `/`, `/stories`, `/creative`, `/carriage`, `/contribute`, `/evidence` and `/api/health` each returned HTTP 200. The public response included Content-Security-Policy. No physical phone was used. |
| Deployed UI DOM | PASS for automated render smoke | The deployed Evidence screen rendered and showed the pending validations and narrower D1 board-smoke result. This checks routing/rendering, not the pending physical-device acceptance flows. |
| `/api/health` | PASS for configured service | Health reported D1 available and readiness `working-towards-trl5`. No provider, MapTiler or moderator secret was configured or exercised. |
| Remote D1 migration | PASS | Migration is applied to the remote D1 database used by deployment version `7e8d7d9b-7595-4afa-bf94-87b48cff8cfa`. |
| Board room isolation | PASS for automated two-room smoke | A posted message was visible in Room A (`1`) and absent from Room B (`0`). This used two automated remote rooms/sessions, not two declared physical users or devices. Sessions were revoked and the test message was removed afterward. |

## Release-gate traceability

| Gate | Current evidence | Release status / remaining evidence |
| --- | --- | --- |
| T1 | HTTPS landing and every declared direct SPA route returned 200 with CSP; `/api/health` reported D1 available and readiness `working-towards-trl5`; deployed Evidence DOM rendered; local built-output/history scan passed | **INCOMPLETE — physical phone NOT RUN**: test deployment `7e8d7d9b-7595-4afa-bf94-87b48cff8cfa` on a named phone and record make/model, OS, browser, URL/build and observed result. Inspect any release screenshots/binary artifacts and rerun the scan after the final commit. |
| T2 | Unresolved schematic with sourced OSM station anchors is visibly labelled | **NOT RUN**: a sourced Pretoria–Cape Town rail alignment, continuity inspection and human route review are absent. The schematic cannot pass the intended route-integrity claim. |
| T3 | Stations, trigger zones and attractions are separate records | Local structure exists; reviewer and exact-release acceptance record absent. |
| T4 | Synthetic R3 component run passes its frozen numerical threshold | Local component PASS only; exact committed release and relevant-environment review absent. |
| T5 | Leaflet/Turf vendored; packaged schematic renders without tiles; replay/GPS labels are distinct | **NOT RUN** on a phone and in airplane mode. The current map has no configured online MapTiler raster layer, so the full T5 implementation is incomplete. |
| T6 | Seven chapters and atomic pack code exist; manifest generated | **NOT RUN**: human content/rights approval and interrupted-install/rollback checks on declared phones are absent. |
| T7 | Deterministic prepared answers and three hints exist | Unit-level logic present; AI-on/off browser comparison and exact-release acceptance record absent. |
| T8 | Waiting transitions pass Node tests; fixed truthful UI copy and 30-second sample request exist | **NOT RUN** end to end: browser trace observation and measured battery-drain delta are absent. |
| T9 | IndexedDB draft and PNG export implementation exist | **NOT RUN**: hard-reload, airplane-mode reopen and exported artifact inspection on a declared browser/phone are absent. |
| T10 | Authorization component tests pass; deployed D1 automated smoke observed A=1/B=0 room isolation and cleaned up both sessions/test data | **BOARD-SCOPE SMOKE PASS; ordered release gate not advanced while T1 is incomplete.** Actual multi-device/user observation remains absent, and board-only scope cannot pass the older R8 matching/invitation criterion. |
| T11 | Role-gated moderation and publication component tests pass | **NOT RUN** against deployed D1; no moderator secret is configured, and the custodian/reviewer workflow and passenger-visibility observations are absent. |
| T12 | AI validation, budgets, circuit breaker and disabled fallback component tests pass | Provider R10 **NOT RUN**. Real successful calls, fixed-set scoring and separately controlled failures are absent; keep AI disabled. |
| T13 | Evidence route reads generated results and local IndexedDB | **NOT RUN** offline on a physical device; browser evidence and exact-release traceability absent. |
| T14 | Node tests cover 429, timeout, malformed output and provider outage; persistence failure is tested separately | **NOT RUN** as the five-case end-to-end core-journey injection. Storage-full browser behavior is absent. |
| T15 | Evidence screen can record an endurance session | **NOT RUN**: no four-hour defined-use physical-phone run and no ten-session own-Worker test with stubbed upstream AI. |

## Release blockers

1. Commit the intended candidate, rebuild and redeploy if the committed content differs, and rerun checks so evidence maps the deployment version to one immutable source release.
2. Complete the T1 physical-phone load check with device, OS, browser, URL, commit/build and observed result.
3. Replace or independently review the unresolved schematic before making a route-integrity claim; configure and origin-restrict MapTiler only if the online layer remains in scope.
4. Obtain human content, attribution/rights, accessibility and any claimed language review.
5. Run the browser/phone offline, rollback, saved-draft, export, evidence-console and failure-injection checks.
6. Exercise the deployed board with actual users/devices and record timing; the original R8 matching/request/accept flow remains explicitly out of the board-only scope. Configure a moderator secret before the deployed T11 workflow test.
7. Keep AI disabled and the provider secret absent until real-provider R10 and R11 pass.
8. Complete the defined four-hour endurance and ten-session own-Worker checks before R16 or TRL 5 assessment.
