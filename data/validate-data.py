"""Validate the route/story data contract without making network requests."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
route = json.loads((ROOT / 'route.geojson').read_text(encoding='utf-8'))
hubs = json.loads((ROOT / 'hubs.json').read_text(encoding='utf-8'))
pack = json.loads((ROOT / 'pack.v1.json').read_text(encoding='utf-8'))
sources = json.loads((ROOT / 'sources.json').read_text(encoding='utf-8'))

expected_hubs = ['pretoria', 'kimberley', 'de-aar', 'beaufort-west', 'matjiesfontein', 'worcester', 'cape-town']
assert hubs['hubOrder'] == expected_hubs
assert [record['hubId'] for record in hubs['stations']] == expected_hubs
assert [record['hubId'] for record in hubs['triggerZones']] == expected_hubs
assert [record['hubId'] for record in pack['chapters']] == expected_hubs
assert {record['recordType'] for record in hubs['stations']} == {'station'}
assert {record['recordType'] for record in hubs['triggerZones']} == {'trigger-zone'}
assert {record['recordType'] for record in hubs['attractions']} == {'attraction'}
assert {record['markerRole'] for record in hubs['stations']} == {'rail-station-anchor'}
assert {record['markerRole'] for record in hubs['triggerZones']} == {'story-unlock-zone'}
assert {record['markerRole'] for record in hubs['attractions']} == {'nearby-attraction'}
assert route['properties']['railAlignmentVerified'] is False
assert route['properties']['confidence'] == 'unresolved'
assert route['properties']['geometryType'] == 'schematic-station-connectors'
assert route['properties']['style']['dashArray']

source_ids = {record['id'] for record in sources['records']}
station_positions = {(record['lat'], record['lon']) for record in hubs['stations']}
for attraction in hubs['attractions']:
    assert attraction['hubId'] in expected_hubs
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
print(f"Validated seven hubs, {len(hubs['attractions'])} attractions, separate record types, source linkage, and unresolved route labelling.")
