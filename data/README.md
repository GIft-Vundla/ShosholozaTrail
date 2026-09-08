# Data status and rights

`route.geojson` is a simplified overview of an automated OpenStreetMap rail-graph candidate; `route-ride.geojson` is its 25 m ride detail and is loaded only on demand. All seven consecutive pairs across eight mapped station anchors resolve on eligible `railway=rail` ways in the dated source extract. This establishes mapped graph continuity, while human review of the historic or current passenger itinerary remains pending. It does not assert that a service is operating.

`hubs.json` separates eight mapped stations, seven sourced story trigger zones and attractions. Johannesburg Park Station is part of the route and ride arrivals, but it has no vanilla-engine trigger because the sourced pack has no Johannesburg chapter. Attraction coordinates come from reviewed official waypoints or exact-ID OpenStreetMap records; they never alter the route or trigger zones. Do not plot null attraction coordinates at station positions.

The Fossil Trail and the multi-stop Zwelethemba Heritage Route remain intentionally ungeocoded because the reviewed sources do not justify one precise point. The separately mapped Karoo National Park entrance is not a substitute for the trail. Worcester Museum is a public stop on the published heritage map; private homes listed in that map are excluded from passenger prompts.

De Aar has no attraction marker: its reviewed story source identifies only the town-level origin of an archival letter, not a precise writing location. The mapped candidate contains eight station anchors from Pretoria through Johannesburg to Cape Town. Intermediate stations and the exact operating itinerary remain pending human or organiser review.

Geographic data: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The selected source records are in `provenance/osm-stations-selected.json` and `provenance/attractions-selected.json`. The derived rail candidate is offered under the same license, with source snapshot hash, queries and used OSM way IDs in provenance/rail-alignment.json. Source and derivative data are downloadable from this repository without charge.

Run `python data/validate-data.py` and `python data/validate-rail.py` after rebuilding. Regenerate from live Overpass with `python data/acquire-rail.py`, or use the reproducible dated extract fallback with `python data/acquire-rail.py --pbf data/provenance/south-africa-260907.osm.pbf --download-pbf --buffer-km 60`. The large PBF is a gitignored local cache. `python data/acquire-attractions.py` refreshes the reviewed exact-ID attraction snapshot and should not be part of an ordinary build.

The independently authored editorial draft is in `pack.v1.json`; institutional references and rights notes are in `sources.json`. Only English reading transcripts exist. Source assets and recordings are not licensed or included. Human review remains pending. See `evidence/research-notes.md` for unresolved issues and acquisition methods.
