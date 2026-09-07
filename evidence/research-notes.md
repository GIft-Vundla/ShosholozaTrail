# Route and content research — 8 September 2026

Status: automated review of published sources; no human editorial sign-off, field survey, community consultation, language review or new oral testimony. These notes distinguish acquired data from proposed work. The user authorised local downstream implementation while hosted deployment and phone acceptance remain pending.

## Geographic result and its limit

`data/route.geojson` is an **UNVERIFIED SCHEMATIC**, not a sourced rail alignment. It joins seven real OpenStreetMap station anchors in the brief's story order with six direct, unresolved connectors. Its continuity only means the schematic joins; it does not pass the rail-alignment requirement of T2. GPS-to-line matches against it cannot validate railway tracking. Every connector has `confidence: "unresolved"`; the route has `railAlignmentVerified: false`. The UI must draw it dashed and preserve that label.

The single geographic source actually used is [OpenStreetMap](https://www.openstreetmap.org/copyright), obtained through seven bounded calls to its map API. `data/provenance/osm-stations-selected.json` preserves node IDs, versions, source timestamps, coordinates, exact retrieval URLs and SHA-256 fingerprints of the local raw responses. Usernames and contributor IDs are not republished. The search-area boxes were only acquisition aids; **no coordinate in the shipped station table was invented or inferred from a town name**.

| Hub | Selected OSM node | Interpretation |
| --- | --- | --- |
| Pretoria | [799906122](https://www.openstreetmap.org/node/799906122) | Named Pretoria station; Gautrain's separately mapped station excluded |
| Kimberley | [247327890](https://www.openstreetmap.org/node/247327890) | Named railway station |
| De Aar | [247327813](https://www.openstreetmap.org/node/247327813) | Named railway station |
| Beaufort West | [8148099536](https://www.openstreetmap.org/node/8148099536) | Named railway station |
| Matjiesfontein | [249333087](https://www.openstreetmap.org/node/249333087) | Railway stop position, the stop member of [station stop-area relation 3355272](https://www.openstreetmap.org/relation/3355272) |
| Worcester | [9155692732](https://www.openstreetmap.org/node/9155692732) | Named railway station |
| Cape Town | [288676470](https://www.openstreetmap.org/node/288676470) | Named railway station |

These are community-mapped points, not measurements taken by this team. Attraction coordinates are null and explicitly `not-geocoded`; attraction visibility from a train is not established. Do not substitute station coordinates for attraction coordinates.

Geographic data attribution: **© OpenStreetMap contributors**. The selected extract and derivative schematic are offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Keep attribution visible on the map and retain the license URI with distributed data. The original editorial content has separate source/rights records.

## Practical path to real railway geometry

An Overpass POST for rail ways returned HTTP 406 from `overpass-api.de`; a bounded GET for the same network timed out at `overpass.kumi.systems`. A smaller station-only request to the first endpoint also returned 406. These failures are acquisition failures, not evidence that the railway is missing in OSM.

The [Geofabrik South Africa extract page](https://download.geofabrik.de/africa/south-africa.html) offers a robust alternative using the same OSM source. At review it listed [south-africa-260906.osm.pbf](https://download.geofabrik.de/africa/south-africa-260906.osm.pbf) at 419,581,243 bytes, with an associated MD5 file. The PBF was not downloaded in this bounded task. Download a dated extract once, record its SHA-256 and snapshot timestamp, then retain `railway=rail` ways and their referenced nodes in a local graph. Do not acquire country-scale data through repeated map API calls.

The next route task should select a connected railway path through independently selected station areas, preserve source way IDs, inspect crossings and switches, and resolve the northern connector explicitly. A graph's shortest path is a candidate for review, not proof of a passenger itinerary. [Rovos Rail's Cape Town journey](https://rovos.com/journeys/cape-town/) supports a Pretoria–Cape Town tourism corridor including Kimberley and Matjiesfontein, but cannot establish the current Shosholoza Meyl operating alignment or authorize use of its published map as an open geometry source. No operational timetable, train movement or stop duration is asserted by this pack.

`data/build-route.py` computes cumulative great-circle distance using the haversine formula and Earth mean radius 6,371,008.8 m. The independent trigger records span 800 m either side of each station anchor, clipped at the endpoints. Those are explicit **test-design choices** on the schematic; the intervals are neither sourced geofences nor field calibrated. Their units are metres from Pretoria. Changing an attraction has no effect on station geometry; changing a trigger does not move a station.

## Editorial source register

`data/sources.json` is the machine-readable register: title, direct URL, institution, original-paraphrase passage, known publication date or null, automated review date, rights and review status. Source passages are summaries, not quotations. `data/pack.v1.json` contains seven English chapters: three deep chapters with deterministic answers and three hints, and four short chapters with no mode activities. The `transcript` is the reading text; **no recorded narrator or audio is claimed**.

| Chapter | Primary source | Scope / editorial decision |
| --- | --- | --- |
| Pretoria, short | [Freedom Park](https://www.freedompark.co.za/) | Institutional remembrance framing; no visibility or access promise |
| Kimberley, deep | [Department of Basic Education, crediting Sol Plaatje Educational Trust](https://www.education.gov.za/ContactUs/SolPlaatjeHouse.aspx); [Big Hole museum](https://thebighole.com/the-big-hole/) | Writing and mining presented as distinct institutional perspectives; answer fixed to a named novel |
| De Aar, short | [Olive Schreiner Letters Online, letter record](https://www.oliveschreiner.org/vre?colid=39&letterid=17&view=collections) | A single documented letter; no invented voice or reproduced transcription |
| Beaufort West, deep | [SANParks Fossil Trail](https://www.sanparks.org/parks/karoo/what-to-do/activities/hikes-walks-trails) | Onboard reading about natural-history evidence; no fossil identification or wildlife promise |
| Matjiesfontein, deep | [Village/property history](https://www.matjiesfontein.com/pages/history/) | Institutional account identified as such; deterministic wartime-building-use challenge |
| Worcester / Zwelethemba, short | [Worcester Tourism's heritage route](https://worcestertourism.com/places/zwelethemba-route/) | Published public heritage; private homes are not presented as attractions to enter |
| Cape Town, short | [District Six Museum](https://www.districtsix.co.za/) | Museum's own account; no invented resident testimony |

The Olive Schreiner record was available through the search index, but the direct page-open retry failed in this session. Its indexed archive metadata and letter text supported the narrow paraphrase; direct archive verification and rights review remain pending. Worcester's page also failed on a repeat open, although its indexed text and linked publication were readable. These limitations do not count as human editorial review.

Two source conflicts were deliberately excluded from passenger copy. SANParks' trail webpage states 400 m, whereas its [visitor map PDF](https://www.sanparks.org/wp-content/uploads/2025/02/Karoo-Visitors-Map.pdf) says 300 m: the chapter omits trail length. Matjiesfontein's history page and Rovos' journey description give differing founding-year descriptions; the chapter omits the founding year. The [Zwelethemba route publication](https://worcestertourism.com/wp-content/uploads/2023/10/BVM-Zwelenthema-Map-Final-260623.pdf) itself marks an exact historic house location as unknown: no such pin is fabricated.

No source photograph, logo, illustration, audio or full copyrighted transcription is included. Original summaries and prompts are the only editorial assets. Source institutions have not endorsed this app; "custodian" functionality does not imply an existing partnership. A second language, reviewed narration, deeper corroboration and human content approval remain outstanding.

## Reproduction

Run `python -X utf8 data/acquire-stations.py` only when refreshing the bounded OSM inputs, then `python -X utf8 data/build-route.py`. Raw extracts are locally ignored; selected metadata is committed. `python -X utf8 data/build-content.py` rebuilds the editorial JSON. The station provenance describes this acquisition run; rerunning against live OSM may change versions and fingerprints and requires renewed review.

Synthetic traces and measured performance remain the responsibility of the shared Journey Engine harness. This research file claims no trigger accuracy, offline success rate, user testing, field validation or TRL level.
