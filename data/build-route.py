"""Build an explicitly unresolved schematic from OSM station anchors, NOT rail alignment."""
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parent
spec = spec_from_file_location('acquisition', ROOT / 'acquire-stations.py')
acquisition = module_from_spec(spec)
spec.loader.exec_module(acquisition)
IDS = [('pretoria', 'Pretoria', '799906122'), ('kimberley', 'Kimberley', '247327890'),
       ('de-aar', 'De Aar', '247327813'), ('beaufort-west', 'Beaufort West', '8148099536'),
       ('matjiesfontein', 'Matjiesfontein', '249333087'), ('worcester', 'Worcester', '9155692732'),
       ('cape-town', 'Cape Town', '288676470')]
stations = []
snapshot = []
for hub, name, osm_id in IDS:
    raw = ROOT / 'provenance' / (hub + '.osm')
    node = ET.parse(raw).getroot().find(f"node[@id='{osm_id}']")
    if node is None:
        raise ValueError(f'Missing source node {osm_id}')
    tags = {t.attrib['k']: t.attrib['v'] for t in node.findall('tag')}
    url = 'https://www.openstreetmap.org/node/' + osm_id
    record = dict(id=hub+'-station', hubId=hub, name=name, lat=float(node.attrib['lat']),
                  lon=float(node.attrib['lon']), recordType='station', sourceId='osm-stations',
                  osmType='node', osmId=int(osm_id), sourceUrl=url, confidence='osm-mapped-not-field-verified',
                  positionType='mapped-stop-position' if hub=='matjiesfontein' else 'mapped-station-point',
                  markerRole='rail-station-anchor')
    stations.append(record)
    snapshot.append(dict(hubId=hub, osmType='node', osmId=int(osm_id),
                         lat=record['lat'], lon=record['lon'], version=int(node.attrib['version']),
                         timestamp=node.attrib['timestamp'], tags={k:v for k,v in tags.items() if k in ('name','railway','public_transport','ref')},
                         retrievalUrl='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str, acquisition.BOXES[hub])),
                         rawSha256=hashlib.sha256(raw.read_bytes()).hexdigest(), sourceUrl=url))

def haversine(a,b):
    lon1,lat1,lon2,lat2 = map(math.radians, [a[0],a[1],b[0],b[1]])
    value=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2*6371008.8*math.asin(math.sqrt(value))

coords=[[s['lon'],s['lat']] for s in stations]
along=[0.0]
for a,b in zip(coords,coords[1:]):
    along.append(along[-1]+haversine(a,b))
total=along[-1]
version='0.1.0-unresolved-schematic'
route=dict(type='Feature', properties=dict(id='pretoria-cape-town-story-corridor',version=version,
    routeVersion=version, name='Pretoria–Cape Town story corridor — UNVERIFIED SCHEMATIC',
    sourceId='osm-stations', source='OpenStreetMap station anchors only; straight connectors authored by ShosholozaTrail',
    sourceUrl='https://www.openstreetmap.org/copyright', attribution='© OpenStreetMap contributors',
    license='ODbL-1.0', licenseUrl='https://opendatacommons.org/licenses/odbl/1-0/',
    confidence='unresolved', geometryType='schematic-station-connectors', railAlignmentVerified=False,
    intendedUse='Synthetic laboratory replay and geographic overview only; not live rail tracking or routing',
    direction='pretoria-to-cape-town', style={'dashArray':'8 8','color':'#f59e0b'},
    lengthMetres=total, generatedAt=datetime.now(timezone.utc).isoformat(),
    unresolvedConnectors=[dict(fromHubId=stations[i]['hubId'],toHubId=stations[i+1]['hubId'],confidence='unresolved',reason='Rail alignment not acquired; direct schematic connector') for i in range(6)]),
    geometry=dict(type='LineString',coordinates=coords))
triggers=[dict(id=s['hubId']+'-trigger',recordType='trigger-zone',hubId=s['hubId'],
               sEnter=max(0,d-800),sExit=min(total,d+800),stationAlongMetres=d,
               routeVersion=version,confidence='synthetic-test-zone-on-unresolved-schematic',
               markerRole='story-unlock-zone',
               designBasis='800 m on either side of mapped anchor, clipped at corridor endpoints; not field calibrated')
          for s,d in zip(stations,along)]
coordinate_snapshot = json.loads((ROOT / 'provenance' / 'attractions-selected.json').read_text(encoding='utf-8'))
coordinates = {record['attractionId']: record for record in coordinate_snapshot['records']}
ATTRACTIONS = [
    ('freedom-park', 'pretoria', 'Freedom Park', ['freedom-park', 'freedom-park-location']),
    ('sol-plaatje-museum', 'kimberley', 'Sol Plaatje Educational Trust and Museum', ['sol-plaatje', 'osm-attraction-coordinates']),
    ('big-hole', 'kimberley', 'The Big Hole', ['big-hole', 'osm-attraction-coordinates']),
    ('karoo-fossil-trail', 'beaufort-west', 'Karoo National Park Fossil Trail', ['sanparks-karoo']),
    ('karoo-national-park-entrance', 'beaufort-west', 'Karoo National Park entrance', ['sanparks-karoo', 'sanparks-karoo-waypoint']),
    ('lord-milner-hotel', 'matjiesfontein', 'Lord Milner Hotel', ['matjiesfontein-history', 'osm-attraction-coordinates']),
    ('zwelethemba-heritage-route', 'worcester', 'Zwelethemba Heritage Route', ['worcester-heritage', 'worcester-heritage-map']),
    ('worcester-museum', 'worcester', 'Worcester Museum (Kleinplasie)', ['worcester-heritage-map', 'osm-attraction-coordinates']),
    ('district-six-museum', 'cape-town', 'District Six Museum', ['district-six', 'osm-attraction-coordinates']),
]

attractions = []
for attraction_id, hub, name, source_ids in ATTRACTIONS:
    coordinate = coordinates.get(attraction_id)
    record = dict(id=attraction_id, hubId=hub, name=name, recordType='attraction',
                  lat=coordinate['lat'] if coordinate else None,
                  lon=coordinate['lon'] if coordinate else None,
                  coordinateStatus=coordinate['confidence'] if coordinate else 'not-geocoded',
                  coordinateMethod=coordinate['coordinateMethod'] if coordinate else None,
                  coordinateSourceId=coordinate['sourceId'] if coordinate else None,
                  coordinateSourceUrl=coordinate['sourceUrl'] if coordinate else None,
                  sourceIds=source_ids, markerRole='nearby-attraction',
                  relationshipToRail='Associated with the story hub; not asserted to lie on the rail line or be accessible from the train.',
                  visibilityFromTrain='not-established')
    if coordinate and coordinate.get('osmType'):
        record.update(osmType=coordinate['osmType'], osmId=coordinate['osmId'])
    if not coordinate:
        record['coordinateNote'] = {
            'karoo-fossil-trail': 'SANParks identifies the trail inside Karoo National Park but the reviewed official page does not publish a trail coordinate. The park entrance coordinate is a separate record and is not substituted for the trail.',
            'zwelethemba-heritage-route': 'This is a multi-stop heritage route, not a single attraction point. Public stops should be mapped individually only after their coordinates are reviewed; private homes must not become passenger prompts.',
        }[attraction_id]
    attractions.append(record)

def write(path,obj):
    (ROOT/path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
write(Path('route.geojson'),route)
write(Path('hubs.json'),dict(version=version,
                           hubOrder=[station['hubId'] for station in stations],
                           recordTypeDefinitions={
                               'station': 'Mapped rail anchor used to define the current schematic corridor.',
                               'trigger-zone': 'Independent along-route interval used to unlock a hub story.',
                               'attraction': 'Place associated with a hub story. It is not a rail stop, route waypoint, promised view, or permission to disembark.'
                           },
                           stations=stations,triggerZones=triggers,attractions=attractions,
                           mapNotice='Stations, trigger zones and attractions are independent records. Attraction coordinates never alter route geometry or trigger intervals.',
                           measurementMethod='Cumulative haversine distance on LineString, Earth mean radius 6371008.8 m; metres from Pretoria'))
write(Path('provenance/osm-stations-selected.json'),dict(source='OpenStreetMap',attribution='© OpenStreetMap contributors',
       license='ODbL-1.0',licenseUrl='https://opendatacommons.org/licenses/odbl/1-0/',
       retrievedAt=datetime.now(timezone.utc).isoformat(),records=snapshot))
print(f'Wrote {len(stations)} mapped station anchors, {len(triggers)} independent test zones, and unresolved schematic ({total:.1f} m).')
