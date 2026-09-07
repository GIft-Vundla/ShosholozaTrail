"""Refresh selected attraction-coordinate provenance.

The script performs an exact OpenStreetMap ID lookup instead of free-text
geocoding. Two records use coordinates published directly by the relevant
institution. Run this script only when intentionally reviewing the mapping
snapshot; normal builds consume the checked-in selected file.
"""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
USER_AGENT = 'ShosholozaTrail-provenance-audit/0.1 (https://github.com/GIft-Vundla/ShosholozaTrail)'

OSM_SELECTIONS = {
    'sol-plaatje-museum': ('W', 632676755, 'Sol Plaatje Museum'),
    'big-hole': ('W', 467535571, 'Big Hole'),
    'lord-milner-hotel': ('R', 7878336, 'Lord Milner Hotel'),
    'worcester-museum': ('N', 3760601751, 'Worcester Museum'),
    'district-six-museum': ('W', 250299433, 'District Six Museum'),
}

OFFICIAL_SELECTIONS = {
    'freedom-park': {
        'lat': -25.7641,
        'lon': 28.1873,
        'publishedCoordinate': 'Latitude S 25 45.846; Longitude E 28 11.238',
        'sourceId': 'freedom-park-location',
        'sourceUrl': 'https://www.freedompark.co.za/wp-content/uploads/2024/04/stakeholder_magazine_2ND_term_2021-22Final_1.pdf',
    },
    'karoo-national-park-entrance': {
        'lat': -32.3633889,
        'lon': 22.5412222,
        'publishedCoordinate': 'Latitude 32°21\'48.2”S; Longitude 22°32\'28.4”E',
        'sourceId': 'sanparks-karoo-waypoint',
        'sourceUrl': 'https://www.sanparks.org/parks/karoo/travel/gps-waypoints',
    },
}


def osm_url(prefix, osm_id):
    kind = {'N': 'node', 'W': 'way', 'R': 'relation'}[prefix]
    return f'https://www.openstreetmap.org/{kind}/{osm_id}'


def main():
    osm_ids = ','.join(f'{prefix}{osm_id}' for prefix, osm_id, _ in OSM_SELECTIONS.values())
    lookup_url = 'https://nominatim.openstreetmap.org/lookup?' + urllib.parse.urlencode({
        'format': 'jsonv2',
        'osm_ids': osm_ids,
        'addressdetails': 1,
        'extratags': 1,
    })
    request = urllib.request.Request(lookup_url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        results = json.load(response)
    by_key = {(record['osm_type'][0].upper(), int(record['osm_id'])): record for record in results}

    selected = []
    for attraction_id, (prefix, osm_id, expected_name) in OSM_SELECTIONS.items():
        record = by_key.get((prefix, osm_id))
        if not record:
            raise ValueError(f'Missing exact OSM result {prefix}{osm_id} for {attraction_id}')
        if expected_name.casefold() not in record.get('name', '').casefold():
            raise ValueError(f'Unexpected OSM name for {attraction_id}: {record.get("name")!r}')
        selected.append({
            'attractionId': attraction_id,
            'lat': float(record['lat']),
            'lon': float(record['lon']),
            'coordinateMethod': 'OpenStreetMap feature representative point returned by Nominatim exact-ID lookup',
            'sourceId': 'osm-attraction-coordinates',
            'sourceUrl': osm_url(prefix, osm_id),
            'osmType': {'N': 'node', 'W': 'way', 'R': 'relation'}[prefix],
            'osmId': osm_id,
            'mappedName': record['name'],
            'displayName': record['display_name'],
            'confidence': 'osm-mapped-not-field-verified',
        })

    for attraction_id, record in OFFICIAL_SELECTIONS.items():
        selected.append({
            'attractionId': attraction_id,
            **record,
            'coordinateMethod': 'official-published-gps converted from degrees and decimal minutes/seconds to decimal degrees',
            'confidence': 'official-published-coordinate-not-field-verified',
        })

    output = {
        'source': 'OpenStreetMap exact-ID lookup plus named institutional GPS pages',
        'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'osmLookupUrl': lookup_url,
        'osmAttribution': '© OpenStreetMap contributors',
        'osmLicense': 'ODbL-1.0',
        'osmLicenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'records': sorted(selected, key=lambda record: record['attractionId']),
    }
    path = ROOT / 'provenance' / 'attractions-selected.json'
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(selected)} selected attraction coordinate records to {path.relative_to(ROOT)}.')


if __name__ == '__main__':
    main()
