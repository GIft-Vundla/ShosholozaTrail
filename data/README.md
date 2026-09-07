# Data status and rights

`route.geojson` is **UNVERIFIED SCHEMATIC**, with straight connectors between OSM station anchors. It is not rail alignment and must be dashed and labelled. `hubs.json` separates stations, test trigger zones and attractions. Attraction coordinates come from reviewed official waypoints or exact-ID OpenStreetMap records; they never alter the route or trigger zones. Do not plot null attraction coordinates at station positions.

The Fossil Trail and the multi-stop Zwelethemba Heritage Route remain intentionally ungeocoded because the reviewed sources do not justify one precise point. The separately mapped Karoo National Park entrance is not a substitute for the trail. Worcester Museum is a public stop on the published heritage map; private homes listed in that map are excluded from passenger prompts.

De Aar has no attraction marker: its reviewed story source identifies only the town-level origin of an archival letter, not a precise writing location. The current map contains the seven story-hub station anchors only. Intermediate stations and the event-specific Gauteng alignment remain pending an organiser itinerary and verified rail geometry.

Geographic data: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The selected source records are in `provenance/osm-stations-selected.json` and `provenance/attractions-selected.json`. The derivative schematic is offered under the same license. Source and derivative data are downloadable from this repository without charge.

Run `python data/validate-data.py` after rebuilding. `python data/acquire-attractions.py` refreshes the reviewed exact-ID attraction snapshot and should not be part of an ordinary build.

The independently authored editorial draft is in `pack.v1.json`; institutional references and rights notes are in `sources.json`. Only English reading transcripts exist. Source assets and recordings are not licensed or included. Human review remains pending. See `evidence/research-notes.md` for unresolved issues and acquisition methods.
