# Frozen acceptance baseline

Baseline date: 2026-09-08. Baseline version: 1. Status: **NOT RUN**.

This document freezes the supplied implementation plan sections 7, 8 and 11 below without rewriting their standards. The agent build brief supersedes the older timeline and scope sequencing. No test result, physical-device validation, environmental endorsement or TRL attainment is implied by this document. Every acceptance requirement R1–R16 starts at **NOT RUN**; maintain actual results separately, with evidence links and the exact tested release. Do not edit thresholds after seeing results. A critical defect overrides aggregate percentages.

## Scope and precedence

- Keep brief T1–T15 as the release-gate order. T1 requires a public HTTPS URL loading on a physical phone and a clean built-output secret scan. On 8 September 2026, the project owner explicitly authorized agents to build and test later components while the phone check remains pending. The Worker is now deployed on HTTPS and has passed an automated desktop-browser smoke check, but those results do not pass T1, advance a later release gate, or substitute for physical-device and relevant-environment acceptance.
- Target T1–T9 by 24 September for a potential TRL 4 assessment; T10–T15 during 25–27 September work towards TRL 5. Dates are planning targets, never evidence of attainment.
- Three deep hubs: Matjiesfontein, Kimberley and Beaufort West. Pretoria, De Aar, Worcester/Zwelethemba and Cape Town are short sourced chapters without mode activities. The older four-deep-chapter instruction is superseded.
- Networking is a carriage-code discussion board with join, post, read and D1 room isolation. Matching and accepted invitations are deferred. The original R8 and section 7 shared-participation wording are retained below to expose the scope difference; do not mark their full matching/invitation scenario PASS for a board-only release. Report the narrower board scope and obtain independent assessment of that reduction. Retain membership, authorization, isolation and the 15-second normal-network update target for the board.
- AI is optional and off by default. No critical journey or deterministic challenge answer depends on it. If the fixed AI evaluation does not meet R10, keep AI disabled and identify R10 as unmet or excluded from an explicitly narrower assessed scope, never as an unearned PASS.
- Foreground PWA only; no background/locked-screen trigger guarantee. Replay is visibly labelled everywhere and is never corridor field evidence. No payments, bookings, operator feeds, matching, native build or unreviewed language claims.
- A TRL 5 claim requires the retained relevant-environment rationale and independent review, beyond passing numerical criteria. Current assessment: **working towards TRL 5; validation incomplete**.

## Execution register

| Requirements | Status | Owner / evidence required |
| --- | --- | --- |
| R1–R2 | NOT RUN | Content/route reviewer unassigned; sourced rail alignment, all seven chapter audits, attribution and rights records |
| R3–R4 | NOT RUN | Journey/validation owners unassigned; at least 100 labelled encounters, trace provenance, complete failure classes and audio queue observations |
| R5–R7 | NOT RUN | Offline/validation owners unassigned; physical-device install/restart/update/storage-failure runs and saved-work/retry records |
| R8 | NOT RUN | Narrower board smoke: PASS for two automated remote rooms/sessions against deployed D1, with one Room A message visible in A (1) and absent from B (0); test sessions were revoked and the message removed. Actual multi-device/user participation, the 15-second observation, and the original matching/request/accept/leave scenario remain unrun or out of scope, so R8 is not passed. |
| R9 | NOT RUN | Creative/validation owners unassigned; reopen and export artifacts with retained credit and original drafts |
| R10–R11 | NOT RUN | AI/validation owners unassigned; fixed 30/10/10 evaluations, real-service success and controlled failure results |
| R12 | NOT RUN | Validation owner unassigned; five offline starts and chapter opens per declared physical device; real latency distributions |
| R13 | NOT RUN | Human trial facilitator unassigned; actual first/second-round records and exact sample; no simulated participants |
| R14 | NOT RUN | Security reviewer unassigned; security test evidence and secret scan, including repository history review |
| R15 | NOT RUN | Accessibility and competent-language reviewers unassigned; checked flows and exact reviewed coverage |
| R16 | NOT RUN | Endurance/validation owners unassigned; four-hour defined-use run and ten active sessions against own Worker with stubbed upstream AI |

Each run must identify requirement, status, timestamp, commit/build, deployment URL, route/content/model/prompt versions as applicable, device/OS/browser, network and position profile, expected result, actual numerator/denominator or measurements, artifacts, failures, fix and retest links. Preserve both trial rounds. Use NOT RUN, FAIL or PASS explicitly; unavailable evidence is not a zero measurement.

The 2026-09-08 cinematic-journey working tree passed 5/5 local headless-Chromium checks for marker/card interaction, replay labelling and route progress, reduced motion, waiting/low-power presentation, and complete-pack offline navigation. See `evidence/cinematic-journey-acceptance.md` for the exact environment, failures fixed, and limits. This local run adds component evidence only; it does not change any NOT RUN release-gate status above or replace physical-device and relevant-environment testing.

## External dependencies and open inputs

1. Cloudflare deployment access and D1 scope were supplied. Remote migration and deployment version `b8a8af7e-f547-44a7-9e6c-8df7703805f1` succeeded at `https://shosholozatrail.giftvundla22.workers.dev`. Provider, MapTiler and moderator secrets remain unconfigured; any replacement credentials belong only in Worker secret storage. Do not paste keys into evidence, screenshots, commits or chat.
2. A human must open the deployed HTTPS URL on a real phone to complete T1. Record make/model, OS/browser, URL, build and observed result. Freeze the supported device inventory before acceptance testing: at least three physical phones if available, including weakest supported Android; iOS only if claimed.
3. Assign named requirement owners and an independent reviewer. Obtain a written review of why controlled route inputs, local GPS checks, realistic interruptions and the declared real services represent the proposed scope; explicitly list missing carriage/corridor effects.
4. Source and rights reviewers must approve actual route evidence and all published factual chapters. A competent speaker must review any claimed second language; English-only work does not establish second-language readiness.
5. Recruit actual testers and a facilitator, ideally 6–10 adults for formative tasks. Record real sample limitations, anonymized observations and consent where relevant. Agent-generated personas are not test participants.
6. Schedule a real four-hour endurance run with brightness, network, audio, interaction and power settings declared; record battery start/end, duration, crashes/restarts, network and cloud usage. Schedule ten active application sessions using a labelled stubbed AI upstream; do not load-test third-party services.
7. Confirm allowed origins, provider quotas, retention/removal procedures and the AI data-handling decision before enabling optional integrations. Do not enable paid plans or automatic top-ups implicitly.

## Initial repository observations and implementation risks

The initial repository contains the storyboard HTML, a presentation and README. The HTML's JavaScript is UI demonstration logic, including simulated download/playback. An initial textual inspection found no service-worker registration, IndexedDB, GPS pipeline or backend integration in that file. The README itself labels the prototype's partners, contributors, feeds, journey state and metrics as demonstration content unless verified. These observations are a quick baseline scan, not a complete security audit or a test result. Start a new application; reuse only the art direction and reviewed copy.

One automated live smoke run observed server-token-protected Room A/Room B isolation on deployed D1 and removed its test data afterward. This is retained as narrower board evidence, not a full security or R8 acceptance run. Remaining unvalidated security work includes session expiry under real elapsed time; broader authorization and isolation cases; schema validation and injection defenses against the deployed release; per-session rate limits and global AI budgets; allowed origins; protected provider secrets; MapTiler origin restrictions; explicit exclusions for `/api/ai` and `/api/rooms` from service-worker caching; upload type/signature/size checks and server-generated filenames; role-gated moderation before passenger publication; opt-out and removal; foreground geolocation permission at journey start; and no server-side precise-location history.

Critical implementation risks include atomic pack verification/rollback while preserving drafts; vendoring every critical-path dependency; never archiving MapTiler tiles; distinguishing stations, trigger intervals and attractions; segment-crossing triggers and persisted once-per-journey awards; rejected implausible/off-route fixes; truthful waiting-state copy without an invented cause/restart time; low-power waiting behavior; metrics derived exclusively from stored real runs; and source-register validation for every factual AI citation. Local implementation and component testing may continue under the owner's authorization above; this register still does not authorize an unearned release-gate or TRL claim.

## Retained source standards (verbatim)

The following three sections are copied from the supplied implementation plan. Their original section numbers are retained. Scope differences are recorded above rather than silently changing the source acceptance text.
## 7. What constitutes a relevant test environment for this project?

### Recommended approach given the team's constraints

Combine **real phones + the real hosted backend/AI/database + a sourced route dataset + controlled journey/location inputs + realistic interruptions and user tasks**. Supplement this with a safe nearby movement test if feasible. No journey to each story town is assumed.

| Real-use condition | How we reproduce or investigate it | What this still cannot establish |
| --- | --- | --- |
| Mixed passenger devices | At least three physical phones if available, including the weakest supported Android; include iOS only if claimed supported | Compatibility with untested devices or OS versions |
| Changing train position | Labelled route traces with variable speed, stops, skipped zones and direction changes; separate real local-device GPS checks | Actual carriage GPS accuracy or location timing on unmeasured corridor segments |
| Intermittent mobile data | Real airplane-mode/reconnect transitions plus controlled throttling, latency and packet loss on the test network | A measured coverage map of the Karoo |
| Cloud dependencies | Real Gemini, MapTiler and D1 calls; controlled timeouts, provider errors and quota responses | A guarantee of future provider availability |
| Seated travel and divided attention | Longer sessions with headphones, noise, interruptions and screen lock/unlock | All onboard conditions or universal passenger acceptance |
| Shared participation | Actual multi-device rooms and accepted invitations | Operation at the entire event's unknown attendance |
| Long duration | Multi-hour measured run plus separate update/recovery tests | Full Pretoria–Cape Town battery endurance unless tested for the claimed duration |
| Localized content | Review by a competent speaker for the stated language subset | Community endorsement or unreviewed-language quality |

Example stress inputs to define at the start: synthetic speeds of 0/40/80/120 km/h, location updates at 1/5/15 seconds, 30–120 second position gaps, and 5/30/120 minute network outages. These are proposed engineering test bounds, **not measured train speeds, update rates or corridor outages**. Use measured inputs if obtained and document why the selected bounds are appropriate.

Test trigger crossing between samples: at 120 km/h, a 15-second update gap spans about 500 metres. A small circular trigger can be skipped entirely. Decide how segment-crossing logic, conservative location handling and manual access work; do not blindly copy a walking-tour radius.

For any local test route, keep its coordinates in a separate test dataset. Never relabel a local street as Matjiesfontein or count that test as corridor field validation.

### Decision if access is limited

- A suitable simulation may support a scoped TRL 5 assessment when the critical environmental effects are justified and reproduced.
- If key effects cannot be represented credibly, retain the relevant TRL 4/component evidence and state that TRL 5 validation is incomplete.
- A local rail test, if later accessible, strengthens the evidence but is not automatically sufficient by itself. One urban train trip does not validate all route conditions.
- If the intended promise expands to hands-free locked-screen operation throughout the actual corridor, revisit platform choice, test access and scope. A native/hybrid implementation may be needed; this is not solved by another API key.

## 8. Acceptance matrix

These are **proposed team criteria**, not official TRL numerical thresholds. Confirm them early and freeze them before acceptance testing. Record numerator/denominator, device, build, network profile and actual evidence; do not present a small sample as a population estimate.

| ID / requirement | Test | Proposed acceptance criterion |
| --- | --- | --- |
| R1 Route integrity | Inspect alignment and every hub against recorded evidence | No unexplained breaks/misplaced hubs; uncertain sections visibly excluded from verified-alignment claims |
| R2 Content integrity | Audit all seven chapters and packaged assets | All factual chapters source-linked and reviewed; rights/attribution recorded; no fabricated narrator/partner |
| R3 Trigger reliability | At least 100 labelled eligible encounters across direction/speed/update-gap profiles | At least 95% correct triggers, no wrong-hub triggers or duplicate awards; report failure classes; missed content remains manually accessible |
| R4 Audio scheduling | Encounter another zone during playback; pause/resume and change mode | No overlapping narration; queued chapter remains accessible; transcript and controls work |
| R5 Offline installation | Install, disconnect, terminate/reopen; visit every hub | All required pack assets and local activities usable on all declared devices; incomplete packs never report ready |
| R6 Update resilience | Interrupt download/update; simulate missing files and storage failure | Last complete pack and existing work preserved; actionable recovery message |
| R7 Saved work and synchronization | Edit offline, restart, reconnect and retry an action twice | No lost draft or duplicate award/request; explicit conflict handling and correct server state |
| R8 Networking | Actual users join, match, request, accept and leave; test another private room | Membership/consent enforced; no cross-room disclosure; updates visible within 15 seconds on declared normal network |
| R9 Creative | Create, save, reopen, edit and export | Output opens correctly; source credit retained where supplied content is reused; AI edits never silently replace the original |
| R10 AI grounding | Fixed set of 30 answerable questions, 10 unsupported questions and 10 adversarial/safety prompts; repeat after model/prompt changes | At least 90% of answerable responses correct and supported; unsupported questions decline unsupported factual claims; zero fabricated citations or unsafe operational advice in the test set |
| R11 AI failure | Inject 429, timeout, malformed output and unavailable provider; test separately with real successful calls | Clear fallback, bounded retries and no broken core journey; optional backup evaluated before use |
| R12 Performance | Five repeated offline starts/chapter opens per device; record AI latency distribution | Initial targets: offline usable screen within five seconds; cached chapter within two seconds; AI answer or explicit fallback within 20 seconds |
| R13 User task flow | Round-two tasks with 6–10 available testers where feasible | At least 80% complete the core task set without facilitator rescue; report exact sample and per-task difficulties |
| R14 Security/privacy | Test input injection, invalid sessions, unauthorized room access, rate limits, opt-out and test-data removal | No open critical disclosure/injection/authorization defect; no provider secrets in client or repository |
| R15 Accessibility/localization | Keyboard, narrow screen, transcripts, reduced motion and language review | All declared core flows usable; language coverage matches what is actually reviewed |
| R16 Endurance/scale | Four-hour defined-use run and ten-active-user session | No unrecoverable data loss/crash; report battery/network/cloud usage and observed capacity, not a 27-hour or event-scale extrapolation |

Use both real-device/real-service tests and synthetic inputs, recording which is which. Do not deliberately exhaust public API quotas or load-test third-party infrastructure. Larger load checks should target our own application with a controlled upstream substitute.

Any critical defect overrides aggregate percentages. Preserve failures and rerun after fixing them. Passing this table supports the assessment only if section 7's relevant-environment rationale is also sound.

## 11. Evidence to retain and final decision

Keep one release evidence folder containing:

1. Requirements, owners, performance predictions and the reviewed relevant-environment rationale.
2. Source register, chapter review, media rights, language coverage and route provenance.
3. Architecture, online/offline behaviour and threat/privacy review.
4. Versioned code, deployment, dependencies, AI model/prompt and content pack.
5. Location traces marked measured/sourced/synthetic; network profiles and device inventory.
6. Actual results from both trial rounds, including failures, fixes, AI evaluations and retests.
7. Exact usability sample, consent records as appropriate, task observations and anonymized findings.
8. Resource usage, costs, endurance measurements and scaling predictions.
9. Rollback/recovery procedure, remaining defects and assessment signoff.

Separate three claims: (a) the stories concern documented real communities; (b) the technology works under the tested conditions; (c) the product improves tourism or community income. The first two can be investigated now. The third requires later impact evidence and must not be inferred from clicks or prototype satisfaction alone.

After successful review, a claim should identify the release, critical functions, real services, devices and representative conditions tested, and explicitly name the limits. Do not say the full rail journey, all languages or all passengers have been validated if they have not.

Until that evidence exists, the correct status is **working towards TRL 5**. Preserve any proven lower-level results even if the higher-level gate is not met.

## Source fingerprints

- AGENT_BUILD_BRIEF.md SHA-256: `a14f4a1d5916363e9d7d92719ed4c4be70f5107511d8633603c3f3119399f4c7`
- ShosholozaTrail_TRL5_Implementation_Plan.md SHA-256: `16d0e00d81d1709ee94910e3ee062e4596fb431608e38f437ddb22bb23a37946`
