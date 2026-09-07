# ShosholozaTrail — rewritten implementation and validation plan for TRL 5

Prepared: 7 September 2026. Status: proposed work, not completed validation.

This replaces the TRL 4 plan as the proposed forward plan. The earlier file is preserved as history. The application, repository and presentation have not been changed by preparing this document.

## 1. Objective and the readiness claim

Deliver an end-to-end, hosted passenger application for the Pretoria–Cape Town story corridor, with Adventure, Networking and Creative modes, a source-backed cloud AI companion, and a genuinely useful offline core. Validate its critical functions under documented conditions representative of its intended use.

NASA's software TRL 5 description calls for end-to-end software interfaced with existing systems or simulations that conform to the target environment, measured performance against predictions, and documented scaling requirements. We use that reference, not an invented requirement to acquire a certain number of users or API keys. [NASA ESTO](https://esto.nasa.gov/trl/)

**TRL 5 is not achieved by changing the document's title, connecting Gemini, or showing a successful scripted demo.** The tested release must satisfy its agreed requirements in a defensibly relevant environment. A realistic simulation can contribute; its representativeness must be explained and reviewed. The exact rail corridor's operating conditions remain unvalidated unless the evidence covers them.

### Constraints carried forward

- No computer capable of hosting a language model is assumed. AI runs through a hosted API.
- No community interviews, contacts in the route towns, or travel to the Karoo/Cape are assumed.
- Use published evidence, archives and institutional sources; do not claim new testimony, local endorsement or partnerships.
- A local device test or nearby passenger journey is useful if feasible, but not a substitute for evidence about the entire corridor.
- Hosted services may be proprietary. This follows the revised preference for accessible cloud APIs rather than an entirely open-source, self-hosted system.
- The current deliverable is an interactive concept prototype. TRL 4 prerequisites must be built and demonstrated, not presumed complete.

## 2. What existing projects teach us

These are comparable products and published workflows, not evidence that those companies claimed a particular TRL. Product descriptions also do not establish independent impact estimates.

| Example and evidence | What it demonstrates | Our adaptation |
| --- | --- | --- |
| [Bernina Express digital companion, RhB's 2018 rollout report](https://www.rhb.ch/de/medien/medienmitteilungen/digitaler-reisebegleiter-im-bernina-express/) | The operator describes a year-long first-class pilot before wider rollout, with maps and multilingual text/image/audio delivered through onboard Wi-Fi | Start with a bounded pilot; design around passengers' devices and available connectivity. Do not copy its live train data or onboard-network promises without those integrations |
| [Current Bernina Express information](https://www.rhb.ch/en/panoramic-journeys/bernina-express/) | The operator continues to list the digital travel companion among its journey features | A rail companion is an established product category, so our distinctiveness must be demonstrated through useful mode interactions and local evidence |
| [VoiceMap's Historic Tour of Matjiesfontein](https://voicemap.me/tour/karoo/historic-tour-of-matjiesfontein) | A real South African walking tour offers 21 offline locations and credits Dean Allen and the Lord Milner Hotel | This is both a local competitor and a precedent for a sourced Matjiesfontein experience. Differentiate the onboard corridor experience; do not copy its recording or assume a partnership |
| [VoiceMap's publisher testing workflow](https://docs.voicemap.me/tour-publishers/testing/) | Publishers test temporary audio, trigger placement, timing and real-world descriptions, then correct and retest; it notes that most tours need at least two rounds | Test chapter timing before polishing narration; log failures and run two improvement cycles |
| [VoiceMap's train-tour guidance](https://docs.voicemap.me/tour-publishers/tour-and-transport-types/) | Train tours must handle variable speed, skipped stations and station waiting time | Use route position, travel state and a content queue; avoid fixed-clock story playback |
| [Questo's creator workflow](https://questoapp.com/blog/make-money-by-becoming-a-questo-creator) | Location-based fictional narratives are edited and tested before publication | Use a clearly fictional quest layer over separately sourced historical content, with player feedback and discoverable hints |

**Our proposed differentiation:** one passenger journey combining evidence-linked stories, onboard challenges, optional collaboration and a saved creative collection, with cloud AI enriching rather than replacing the verified content. This is a hypothesis to test, not a claim that no competitor offers any similar feature.

## 3. Product scope to freeze

### Places and content depth

| Hub | Proposed evidence-led chapter | Depth |
| --- | --- | --- |
| Pretoria | Departure, remembrance and Freedom Park | Onboarding and a short chapter |
| Kimberley | Sol Plaatje, writing and the city's social history | Deep chapter and all three mode activities |
| De Aar | Published Olive Schreiner correspondence | Short archival chapter and creative prompt |
| Beaufort West | Karoo natural history and conservation | Deep chapter and all three mode activities |
| Matjiesfontein | Railway settlement and travel writing | First fully integrated chapter; all three modes |
| Worcester / Zwelethemba | Public heritage, artists and community history | Deep chapter and all three mode activities |
| Cape Town / District Six | Memory, a published personal account and arrival reflection | Short chapter and final collection/export |

Use the [existing evidence pack](ShosholozaTrail_Evidence_Pack.md), extending the Worcester record from [Worcester Tourism's Zwelethemba route](https://worcestertourism.com/places/zwelethemba-route/). Review all final scripts against original sources.

Stations, story-trigger points and attraction locations are different records. An attraction associated with a town need not be visible from the train or within walking distance. Do not label a town passed in replay as physically visited.

### Included functions

1. Guest onboarding, language selection, mode selection and a route preview.
2. A real downloadable pack: seven chapters, four deeper narrated chapters with transcripts, four light 2D animations, route overview, approved activity content and attribution.
3. A position-aware map, clearly separated replay mode, manual chapter access and recoverable progress.
4. Adventure clues with deterministic answers, saved completion and progressively helpful hints.
5. Networking using a private join code, opt-in pseudonym/interests, a transparent matching rule and request/accept/leave actions between real devices.
6. Creative postcards or three-panel storyboards: edit, save, reopen and export.
7. Gemini-backed place questions and contextual hints; creative assistance and icebreaker generation use the same controlled service once the first two actions pass evaluation.
8. A stopped/waiting experience with cached short activities. No claim to know the departure time or reason for a stop without an actual source.
9. An explicit offline/online/last-synced state, download recovery, synchronization and a settings/reset/export flow.
10. A hosted release, real-device evidence, realistic failure tests, a small user trial and a reviewable readiness assessment.

### Deliberately excluded

Bookings, payments, public social feeds, vendor transactions, live operator integration, automatic alighting advice, unlimited cloud AI, background GPS guarantees, full 3D reconstruction and live generation of historical facts. No new paid narration/image/video service is required. Use reviewed team narration and original lightweight graphics initially.

English is the initial full coverage. Add a second language only within a reviewed, declared scope. A selector alone is not multilingual support.

## 4. Hosted architecture and exact dependency choices

| Layer | Choice | Purpose and boundary |
| --- | --- | --- |
| Passenger app | Browser/PWA with Leaflet, Turf and local storage | Ordinary phone rendering, location processing, download management and local activities; no local language model |
| Online base map | MapTiler Cloud | Online map tiles beneath our reviewed rail line and pins; not a source of an approved train itinerary |
| Offline map | Packaged geographic route overview built from permitted open data | Rail line, towns, chapter pins and enough surrounding context to remain understandable without the online tiles |
| Hosted application/API | Cloudflare Workers and Static Assets | Serve the application and approved media; validate requests, protect provider secrets and contact Gemini |
| Shared database | Cloudflare D1 | Private test-room membership, requests, minimal progress/events and published content metadata |
| AI | A stable Gemini Flash model available to the project's account | Hosted factual assistance from selected source passages; no reliance on unrestricted model memory |
| Retrieval | Small server-side source index, using simple text search first | With seven hubs, begin without a separate paid search or vector-database service |
| Backup AI | Groq, optional and initially disabled | Add only if needed and separately evaluated; switching models can change factual and safety behaviour |

Cloudflare supports hosting assets alongside Worker code. D1 is a hosted database with a free allowance; neither requires running a database server on the team's laptop. [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

The phone asks our backend for AI assistance. The backend retrieves approved passages, calls Gemini, checks the response structure/source identifiers and returns an answer with source cards. The browser does not receive the Gemini secret.

### Online versus offline contract

| Capability | Connected | Completely disconnected |
| --- | --- | --- |
| Read/listen to downloaded stories | Yes | Yes |
| Route overview and chapter navigation | Yes | Yes, from installed pack |
| Detailed MapTiler base map | Yes, subject to service availability | Not promised; switch to packaged overview |
| Device position | Permission/device dependent | May remain available; never equate internet loss with certain GPS loss |
| Adventure and Creative local work | Yes | Yes |
| New AI response | Yes, subject to provider availability | No; offer reviewed prepared hints and source search |
| Live Networking updates | Yes | No; label stale data and retain discussion prompts |
| Shared progress synchronization | Yes | Queue suitable changes, then retry explicitly or on foreground reconnect |

Keep a complete old pack usable until a new pack is validated. The service worker must not cache AI/chat/private-session responses indiscriminately. Public content caching and personal data handling need different rules.

MapTiler's free plan covers non-commercial use and R&D for commercial applications; production commercial use needs a plan review. Its temporary-cache allowance must not be interpreted as permission to redistribute an offline map archive. [MapTiler terms](https://www.maptiler.com/terms/cloud/)

Service workers and device geolocation require appropriate secure contexts, and geolocation requires permission. Start with an HTTPS deployment and a foreground-use scope. [MDN service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [MDN geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

## 5. Build the evidence and route before polishing the experience

For every story, store the source, author/institution, supporting passage, publication date if known, review date, editorial summary, permitted assets and attribution. Keep a factual version separate from game fiction and passenger-created material. Do not package full copyrighted texts just because an AI retrieved them.

For the map:

1. Select and name one intended rail alignment. Record unresolved northern-route or Pretoria-connector questions.
2. Obtain permitted railway geometry; compare it with published route information and inspect continuity.
3. Store railway line, station point, attraction point and trigger zone independently.
4. Record route direction, source/date/version and confidence. Do not use a road-routing API as a train-routing authority.
5. Create separate source-labelled traces: measured GPS where available, documented external traces if suitable, and deliberately synthetic test trajectories.
6. Treat any schematic connector as unresolved. It cannot count as validated rail geometry merely because the animation crosses it.
7. Give every story a manual entry point. A passenger who misses a trigger should not lose access to the content.

A map library draws data; it does not verify the data. The team's review remains part of the deliverable.

## 6. Work breakdown, owners and deliverables

Planning allowance: **6–8 working weeks**, assuming four members each contributing approximately 15–20 hours per week: roughly **360–640 team-hours**. This includes completing the current prototype's underlying functions. It is not a universal TRL duration. Confirm availability and re-estimate after the first integrated chapter and first test round.

Assign four responsibilities: **P** product/evidence, **M** map/frontend, **B** backend/data/AI, **V** validation/UX. Members can share work, but each work package needs a named owner. Where possible, someone other than the implementer should run its acceptance tests.

### WP1 — Define the relevant environment and success criteria

**Week 1; P + V.**

- Freeze the feature scope and intended users: domestic-tourism passengers and hackathon participants, with an explicit initial foreground-phone-use scope.
- Inventory available devices, browsers, networks, test participants and access constraints.
- Agree the representativeness matrix in section 7 with the reviewer/mentor if available. Explain what each simulation reproduces and what it misses.
- Set expected performance and measurable pass criteria before final testing.
- Create a requirements-to-test register, risk register and definition of critical defects.
- Confirm who owns the service accounts and the test-data retention policy.

**Output/gate:** reviewed requirements and test-environment rationale. If the intended claim requires locked-screen location or confirmed live train tracking, those must be added as real development/test dependencies rather than hidden assumptions.

### WP2 — Source content and verify the geographic dataset

**Weeks 1–2; P + M.**

- Produce the seven source records and four deeper scripts.
- Resolve the chosen rail alignment as far as evidence allows; inspect all story zones.
- Define the first Matjiesfontein challenge, source-linked answer, hint ladder and creative template.
- Prepare temporary narration for timing tests; defer final audio polishing until the chapter flow passes.
- Record all quotation, illustration, narration and map-use permissions.
- Select reviewed language coverage; keep unreviewed drafts out of the published pack.

**Output/gate:** a versioned route and content pack with traceable claims. Missing evidence blocks the affected claim, not unrelated development.

### WP3 — Deploy the foundation and protect credentials

**Weeks 1–2; B + M.**

- Create development and test deployments, separate from any public release.
- Serve the PWA over HTTPS; configure the manifest, local asset dependencies and storage.
- Connect MapTiler, D1 and Gemini with one small, real request each. Record tested model identifier, provider tier and current account quotas.
- Put Gemini and application signing secrets in backend secret storage. Restrict the browser-visible map key to approved origins.
- Implement private test rooms, server-validated session tokens, expiry, opt-out and room isolation. A room identifier in the URL alone is not authorization.
- Add minimal logs: request identifier, latency, failure code, content/model version and anonymous test-session identifier. Avoid storing precise location histories or full private prompts by default.

**Output/gate:** a real deployed app and secured service connections, with a working rollback path. No secret in the browser bundle, source repository or test screenshots.

### WP4 — Complete one end-to-end chapter and establish the integration baseline

**Weeks 2–3; M + B + V.**

Build the Matjiesfontein path: onboarding → actual pack download → position/replay → sourced story and audio → Adventure challenge → save → disconnect → restart → recover → reconnect.

- Keep manual, simulated and live device-position states visibly distinct.
- Prevent duplicate unlocks from GPS jitter. Handle out-of-order fixes, large jumps, re-entry and wrong-direction travel with explicit rules.
- Queue newly unlocked chapters instead of overlapping audio or interrupting a passenger's work.
- Allow user-initiated playback and resume; do not assume browsers will autoplay audio.
- Save locally first and make synchronization retry-safe.

**Output/gate:** repeatable component and integration tests pass. This is the TRL 4-style prerequisite checkpoint; continue towards TRL 5 only after the critical components actually interoperate.

### WP5 — Implement all three modes and the source-backed AI companion

**Weeks 3–4; M + B + P.**

- **Adventure:** reuse a common challenge component across the four deep hubs. Scoring comes from reviewed rules/answers. AI may explain or hint but must not invent or silently change the correct answer.
- **Networking:** actual participants opt in with a pseudonym and selected interests/skills. Use a simple matching rule, request/accept/leave actions, and a shared prompt. Start with active-screen polling instead of a separate real-time vendor; mark old data clearly.
- **Creative:** save editable postcards/storyboards, reopen them and export to a usable file. AI changes require the passenger to accept them; preserve the original draft.
- **AI:** expose four scoped actions: ask about this place, request a hint, suggest an icebreaker and assist a draft. Retrieve approved passages by hub and question. Keep responses short and source-linked.
- Validate returned source IDs against the supplied records; render links from stored metadata. A valid ID does not prove the associated statement, so evaluate factual support separately.
- Treat source passages and user text as untrusted content, not instructions to change system behaviour. Disable arbitrary tool execution and open-ended browsing for the milestone.
- If evidence is missing, offer an explicit insufficient-evidence response. Route safety and live operational questions should use fixed, truthful messaging rather than model guesses.
- Send only public evidence and non-sensitive test input to the free AI tier. Redact or avoid participant identities, contact details and precise live coordinates. Explain third-party processing before a participant submits text.

**Output/gate:** all modes perform useful actions, and the same AI evaluation is passed by every enabled model/provider. Groq stays disabled unless tested separately.

### WP6 — Extend the hubs, offline behaviour and accessibility

**Weeks 3–5; M + P + V.**

- Extend the functioning templates to the remaining hubs and finish narration after timing corrections.
- Show actual pack size and verified installation state. Keep a small offline route overview separate from online base-map tiles.
- Handle interrupted installs, failed updates, insufficient storage and app restarts without destroying an existing complete pack or drafts.
- Implement an explicit waiting state that suggests short activities. A stationary GPS position is not enough to assert an operator delay or its duration.
- Provide transcripts, keyboard/focus support, reduced motion, narrow-screen layouts and the declared reviewed language coverage.
- Resume gracefully after screen lock or background suspension. The initial release must state that automatic background story triggering is not guaranteed.

**Output/gate:** a feature-complete release candidate with honest online/offline boundaries. No essential public content depends on an uncached third-party script or font.

### WP7 — Run relevant-condition trial round one

**Week 5; V with all owners.**

- Run the actual HTTPS application and actual hosted integrations on the declared phone set.
- Use the combined relevant-environment test approach in section 7, not just developer desktop emulation.
- Recruit approximately 6–10 available adults for formative testing if feasible, including people unfamiliar with the prototype. Seek actual potential users where accessible; identify convenience-sample limitations.
- Observe onboarding, story discovery, one action per mode, offline restart and reconnect. Test participants are not being asked to provide local historical testimony.
- Record task completion, time, errors, assistance required, confusing labels and perceived usefulness. Get permission for any recording.
- Test in a seated/noisy context using headphones and interrupted attention. Perform a safe local movement test where feasible, as a passenger or on foot, never by asking a driver to operate the app.

**Output/gate:** genuine observations, performance measurements and a prioritized defect list. No fabricated ratings, passengers or successful test counts.

### WP8 — Correct failures and run round two

**Week 6; all owners, V accountable.**

- Fix failures in trigger timing, download recovery, AI support, session isolation, wording and task flow.
- Repeat the same traces and scenarios, then test additional participants or different devices where possible.
- Separate first-round and second-round results. Do not hide the initial failures or lower thresholds after testing merely to achieve a pass.
- Repeat the full passenger journey after each critical fix.

**Output/gate:** critical criteria pass on a frozen candidate, and improved behaviour is demonstrated rather than asserted.

### WP9 — Check endurance, operating costs and scale boundaries

**Weeks 6–7; B + V.**

- Run a multi-hour session with a declared brightness/network/audio pattern. Record battery change, restarts and storage behaviour without extrapolating mechanically to a full train journey.
- Measure a small concurrent session: initial target ten active users. Exercise real services within their quotas; use a stub of the upstream AI for larger application load tests and label it as such.
- Record AI input/output usage, requests per task, data transferred, D1 reads/writes and map usage.
- Add per-session limits, an application-wide AI budget, timeouts, cancellation and a circuit breaker. Show a helpful fallback on quota or provider failure.
- Stop polling when hidden or disconnected. Ten users polling once every ten seconds generate about 3,600 requests/hour before other traffic; use that calculation to predict a bigger pilot's requirements.
- Document what would change for 100 active users. Do not claim that forecast is a measured 100-user test.
- Rehearse backup/restore, deployment rollback and removal of test-session data.

**Output/gate:** measured small-pilot capacity, a stated scaling forecast and a quota/cost plan. No unlimited-free or production-SLA claim.

### WP10 — Review the evidence and make a scoped readiness decision

**Weeks 7–8; P + V, with an independent reviewer where available.**

- Link every critical requirement to code/data versions, its test and actual result.
- Compare predictions with measured performance and explain discrepancies.
- Review whether the environment actually represents the claim. Record the reviewer's reasoning, unresolved gaps and any scope reduction.
- Produce a reproducible demo, test report and limitations statement. Keep a clearly labelled backup recording.
- Preserve a release tag/version, deployment details, model ID, content/route versions and test scripts.
- Report the outcome as passed, not yet passed, or passed for an explicitly narrower subsystem/scope. A single unavailable critical feature cannot be hidden behind good results elsewhere.

**Output/gate:** an evidence-based assessment. Self-assessment is not external certification, and a deadline is not a reason to upgrade the readiness claim.

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

## 9. API accounts, keys and cost preparation

TRL 5 changes the integration and validation work, not the number of services we need. Start with the existing three-account stack.

| Required? | Service and signup/key site | What to prepare | Handling |
| --- | --- | --- | --- |
| Yes | [Gemini: Google AI Studio API keys](https://aistudio.google.com/apikey) | Project and new supported API key; choose a stable Flash model and inspect actual account limits | `GEMINI_API_KEY` in Worker secrets; model identifier in configuration; never in the HTML |
| Yes for online base maps | [MapTiler Cloud](https://cloud.maptiler.com/) | Account → API keys; one app-specific key | Restrict approved origins and retain attribution; do not put a map-tile proxy behind the backend without permission |
| Yes | [Cloudflare signup](https://dash.cloudflare.com/sign-up) | Account for Worker, static assets and D1; create test deployment and database | Team owner retains account control; normal deployment can use interactive login |
| Only for automated deployment | [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) | Scoped deployment token with only needed resources/permissions | CI secret, not browser configuration; not the account-wide Global API Key |
| Optional | [Groq API keys](https://console.groq.com/keys) | Backup-model key only if that provider is enabled and tested | `GROQ_API_KEY` in Worker secrets; disclose and review the second provider's data handling |

No extra account is required for the initial route animation, geofences, browser GPS, local drafts or packaged stories. D1 is connected to the Worker through its database binding; end users do not need a D1 API key. Application session-signing secrets are generated during implementation, not obtained from another provider.

Google's current key documentation says newly created AI Studio keys use its supported authorization-key flow; use the current creation process rather than relying on an old unrestricted key. Keep all provider secrets server-side. [Gemini keys](https://ai.google.dev/gemini-api/docs/api-key)

For Cloudflare, ordinary local deployment supports an interactive login, while automated deployment uses a scoped token. [Deployment authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [token creation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), [secret storage](https://developers.cloudflare.com/workers/configuration/secrets/)

### Free-tier controls

- Inspect current account limits at setup and before each trial. Free access is quota-limited, not a stability guarantee. [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- Google's pricing distinguishes free-tier data use from paid-tier handling. Use public source material and non-sensitive evaluation prompts initially. Do not send personal drafts or contacts without an appropriate data-handling decision. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Record cost per trial and forecast a larger one. Keep Cloudflare request, CPU and D1 allowances in the budget, as well as AI calls and map requests. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- Stop/reduce cloud features gracefully when a budget is reached. Do not enable paid plans, automatic top-ups or extra providers without the account owner's approval.
- A quota-limited free deployment can support a bounded trial. It cannot honestly be advertised as unlimited or guaranteed production hosting.

## 10. What the humans do, and what AI can help with

| Work | AI assistance | Human responsibility |
| --- | --- | --- |
| Research | Find candidate sources, draft summaries and flag conflicts | Inspect source passages, approve facts and exclusions |
| Mapping | Process geographic data and generate test trajectories | Check rail alignment and distinguish real/synthetic data |
| Coding | Implement components, tests and failure handling | Review changes, protect accounts, execute device checks |
| Content | Draft prompts, captions and temporary narration scripts | Review attribution, language, historical context and rights |
| Validation | Generate test cases and summarize logs | Recruit/observe testers, run real conditions and verify results |
| Assessment | Assemble traceability and draft the report | Decide whether the evidence supports the stated claim |

No new local interview is required to use published evidence honestly. But AI cannot manufacture the user observations, device measurements or environmental evidence that the readiness assessment depends on. If actual testers are unavailable, report that limitation instead of simulating people and treating them as participants.

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

## 12. Immediate next steps

1. Create the Gemini, MapTiler and Cloudflare accounts; do not post secret keys in chat.
2. Assign the four responsibility areas and confirm weekly availability and test devices.
3. Freeze the foreground PWA scope, seven hubs, four deep chapters and hosted-AI boundary.
4. Approve the first Matjiesfontein script, geographic trigger and challenge.
5. Agree how the representative journey environment will be reproduced and what cannot be claimed.
6. Deploy the first complete chapter and pass its download/restart/reconnect tests.
7. Expand the modes, perform the two trial rounds, then review the readiness evidence.

The practical progression is: **verified content and geography → integrated hosted app → realistic trials → corrections and retests → scoped TRL 5 assessment**.
