"""Read bounded OSM extracts; bounding boxes are search areas, never station claims."""
import concurrent.futures
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'provenance'
BOXES = {
    'pretoria': (28.184,-25.765,28.196,-25.755),
    'kimberley': (24.757,-28.751,24.780,-28.729),
    'de-aar': (24.001,-30.66,24.031,-30.638),
    'beaufort-west': (22.571,-32.367,22.603,-32.339),
    'matjiesfontein': (20.571,-33.237,20.592,-33.224),
    'worcester': (19.429,-33.659,19.451,-33.632),
    'cape-town': (18.419,-33.929,18.435,-33.913)
}

def acquire(item):
    name, box = item
    path = ROOT / (name + '.osm')
    url = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, box))
    if not path.exists():
        with urllib.request.urlopen(url, timeout=25) as response:
            path.write_bytes(response.read())
    found = []
    tree = ET.parse(path)
    for el in tree.getroot():
        tags = {t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}
        if tags.get('railway') == 'station' or tags.get('public_transport') == 'station':
            found.append(dict(type=el.tag, attributes=el.attrib, tags=tags))
    return name, url, found

if __name__ == '__main__':
    # Two concurrent bounded requests; no bulk map download.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for task in pool.map(acquire, BOXES.items()):
            print(task)
