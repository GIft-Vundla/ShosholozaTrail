"""Validate the route/story data contract without making network requests."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
route = json.loads((ROOT / 'route.geojson').read_text(encoding='utf-8'))
hubs = json.loads((ROOT / 'hubs.json').read_text(encoding='utf-8'))
pack = json.loads((ROOT / 'pack.v1.json').read_text(encoding='utf-8'))
sources = json.loads((ROOT / 'sources.json').read_text(encoding='utf-8'))

expected_stations = ['pretoria', 'johannesburg', 'kimberley', 'de-aar', 'beaufort-west', 'matjiesfontein', 'worcester', 'cape-town']
expected_story_hubs = ['pretoria', 'kimberley', 'de-aar', 'beaufort-west', 'matjiesfontein', 'worcester', 'cape-town']
assert hubs['hubOrder'] == expected_stations
assert [record['hubId'] for record in hubs['stations']] == expected_stations
assert [record['hubId'] for record in hubs['triggerZones']] == expected_story_hubs
assert [record['hubId'] for record in pack['chapters']] == expected_story_hubs
assert {record['recordType'] for record in hubs['stations']} == {'station'}
assert {record['recordType'] for record in hubs['triggerZones']} == {'trigger-zone'}
assert {record['recordType'] for record in hubs['attractions']} == {'attraction'}
assert {record['markerRole'] for record in hubs['stations']} == {'rail-station-anchor'}
assert {record['markerRole'] for record in hubs['triggerZones']} == {'story-unlock-zone'}
assert {record['markerRole'] for record in hubs['attractions']} == {'nearby-attraction'}
assert route['properties']['railAlignmentVerified'] is True
assert route['properties']['confidence'] == 'osm-mapped-connected-candidate'
assert route['properties']['geometryType'] == 'osm-rail-graph-shortest-path-candidate'
assert route['properties']['unresolvedSegments'] == []
assert route['properties']['reviewStatus'] == 'automated-candidate-human-operational-route-review-pending'

source_ids = {record['id'] for record in sources['records']}
station_positions = {(record['lat'], record['lon']) for record in hubs['stations']}
for attraction in hubs['attractions']:
    assert attraction['hubId'] in expected_stations
    assert set(attraction['sourceIds']) <= source_ids
    assert attraction['relationshipToRail'].startswith('Associated with the story hub;')
    assert attraction['visibilityFromTrain'] == 'not-established'
    has_lat = attraction['lat'] is not None
    has_lon = attraction['lon'] is not None
    assert has_lat == has_lon
    if has_lat:
        assert attraction['coordinateStatus'] != 'not-geocoded'
        assert attraction['coordinateSourceId'] in source_ids
        assert attraction['coordinateSourceUrl'].startswith('https://')
        assert (attraction['lat'], attraction['lon']) not in station_positions
    else:
        assert attraction['coordinateStatus'] == 'not-geocoded'
        assert attraction['coordinateSourceId'] is None
        assert attraction['coordinateNote']

assert sum(chapter['depth'] == 'deep' for chapter in pack['chapters']) == 3
assert sum(chapter['depth'] == 'short' for chapter in pack['chapters']) == 4
assert next(record for record in hubs['stations'] if record['hubId'] == 'johannesburg')['storyTriggerStatus'] == 'not-created-no-sourced-chapter'
print(f"Validated eight mapped stations, seven sourced story zones, {len(hubs['attractions'])} attractions, source linkage, and OSM rail-candidate labelling.")
