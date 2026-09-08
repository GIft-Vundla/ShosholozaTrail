"""Acquire a reviewable Pretoria–Cape Town rail alignment from OpenStreetMap.

The normal online mode queries Overpass once per consecutive hub pair.  A dated
Geofabrik South Africa PBF can be supplied with ``--pbf`` when an Overpass
mirror cannot answer the large corridor queries.  Both modes use OSM node IDs
as graph vertices and OSM ways as weighted, undirected edges.

An unresolved pair is retained as an explicitly labelled straight connector;
it is never presented as mapped rail geometry.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import math
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROVENANCE = ROOT / "provenance"
PUBLIC_DATA = ROOT.parent / "public" / "data"
EARTH_RADIUS_M = 6_371_008.8
EXCLUDED_SERVICE = re.compile(r"^(siding|spur|yard|crossover)$", re.I)
OVERPASS_ENDPOINTS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
DEFAULT_PBF_URL = "https://download.geofabrik.de/africa/south-africa-260907.osm.pbf"

# The seven earlier anchors are exact records already retained in provenance.
# Johannesburg Park Station is an exact OSM node added because the React route
# contains this hub between Pretoria and Kimberley.
STATIONS = (
    ("pretoria", "Pretoria", 799906122, 28.1892212, -25.7594894),
    ("johannesburg", "Johannesburg Park Station", 326084268, 28.0423048, -26.1976708),
    ("kimberley", "Kimberley", 247327890, 24.7698702, -28.7353474),
    ("de-aar", "De Aar", 247327813, 24.0138567, -30.6503939),
    ("beaufort-west", "Beaufort West", 8148099536, 22.5769196, -32.3518393),
    ("matjiesfontein", "Matjiesfontein", 249333087, 20.5808832, -33.2314538),
    ("worcester", "Worcester", 9155692732, 19.4411747, -33.6394993),
    ("cape-town", "Cape Town Station", 288676470, 18.4263523, -33.9224221),
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_file(url: str, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "ShosholozaTrail/0.1 rail-research"})
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as target:
        while chunk := response.read(1024 * 1024):
            target.write(chunk)
    temporary.replace(path)


def haversine(a: tuple[float, float] | list[float], b: tuple[float, float] | list[float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    value = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(value))


def corridor_bbox(a: tuple, b: tuple, buffer_km: float) -> tuple[float, float, float, float]:
    mid_lat = (a[4] + b[4]) / 2
    lat_pad = buffer_km / 111.1
    lon_pad = buffer_km / max(10.0, 111.1 * math.cos(math.radians(mid_lat)))
    return (
        min(a[4], b[4]) - lat_pad,
        min(a[3], b[3]) - lon_pad,
        max(a[4], b[4]) + lat_pad,
        max(a[3], b[3]) + lon_pad,
    )


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    return (
        "[out:json][timeout:300];\n"
        f'way["railway"="rail"]["service"!~"siding|spur|yard|crossover"]'
        f"({south:.7f},{west:.7f},{north:.7f},{east:.7f});\n"
        "out geom;"
    )


@dataclass
class WayRecord:
    osm_id: int
    nodes: list[tuple[int, float, float]]


def query_overpass(query: str, cache: Path) -> tuple[bytes, str]:
    if cache.exists():
        return cache.read_bytes(), "cache"
    encoded = urllib.parse.urlencode({"data": query}).encode()
    errors = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            request = urllib.request.Request(endpoint, data=encoded, headers={"User-Agent": "ShosholozaTrail/0.1 rail-research"})
            with urllib.request.urlopen(request, timeout=330) as response:
                raw = response.read()
            json.loads(raw)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(raw)
            return raw, endpoint
        except Exception as error:  # retain all failures in the thrown message
            errors.append(f"{endpoint}: {type(error).__name__}: {error}")
            time.sleep(1)
    raise RuntimeError("; ".join(errors))


def parse_overpass(raw: bytes) -> list[WayRecord]:
    payload = json.loads(raw)
    result = []
    for element in payload.get("elements", []):
        if element.get("type") != "way":
            continue
        tags = element.get("tags", {})
        if tags.get("railway") != "rail" or EXCLUDED_SERVICE.match(tags.get("service", "")):
            continue
        geometry = element.get("geometry", [])
        node_ids = element.get("nodes", [])
        if len(geometry) != len(node_ids):
            continue
        nodes = [(int(node_id), float(point["lon"]), float(point["lat"])) for node_id, point in zip(node_ids, geometry)]
        if len(nodes) >= 2:
            result.append(WayRecord(int(element["id"]), nodes))
    return result


def acquire_overpass(corridors: list[dict]) -> tuple[list[list[WayRecord]], list[dict]]:
    all_ways, raw_records = [], []
    cache_dir = PROVENANCE / "rail-overpass"
    for corridor in corridors:
        cache = cache_dir / f"{corridor['id']}.json"
        query = corridor["query"]
        try:
            raw, endpoint = query_overpass(query, cache)
            ways = parse_overpass(raw)
            status, error = "ok", None
        except Exception as exc:
            raw, endpoint, ways = b"", None, []
            status, error = "failed", str(exc)
        all_ways.append(ways)
        raw_records.append({
            "segmentId": corridor["id"], "query": query, "endpoint": endpoint,
            "cacheFile": str(cache.relative_to(ROOT)) if cache.exists() else None,
            "rawSha256": hashlib.sha256(raw).hexdigest() if raw else None,
            "retrievedAt": utc_now(), "status": status, "error": error,
            "wayCount": len(ways),
        })
    return all_ways, raw_records


def acquire_pbf(pbf: Path, corridors: list[dict]) -> tuple[list[list[WayRecord]], list[dict]]:
    try:
        import osmium
    except ImportError as exc:
        raise SystemExit("PBF mode requires pyosmium: python -m pip install osmium") from exc

    boxes = [c["bbox"] for c in corridors]
    per_corridor: list[list[WayRecord]] = [[] for _ in corridors]

    class RailHandler(osmium.SimpleHandler):
        def way(self, way):
            if way.tags.get("railway") != "rail" or EXCLUDED_SERVICE.match(way.tags.get("service", "") or ""):
                return
            try:
                nodes = [(int(node.ref), float(node.lon), float(node.lat)) for node in way.nodes]
            except osmium.InvalidLocationError:
                return
            if len(nodes) < 2:
                return
            west = min(n[1] for n in nodes); east = max(n[1] for n in nodes)
            south = min(n[2] for n in nodes); north = max(n[2] for n in nodes)
            record = WayRecord(int(way.id), nodes)
            for index, (box_s, box_w, box_n, box_e) in enumerate(boxes):
                if not (east < box_w or west > box_e or north < box_s or south > box_n):
                    per_corridor[index].append(record)

    RailHandler().apply_file(str(pbf), locations=True)
    raw_sha = sha256_file(pbf)
    source_url = DEFAULT_PBF_URL
    records = [{
        "segmentId": corridor["id"], "query": corridor["query"],
        "acquisitionMode": "dated-geofabrik-pbf-with-equivalent-local-filter",
        "sourceUrl": source_url, "sourceFile": pbf.name, "rawSha256": raw_sha,
        "retrievedAt": utc_now(), "status": "ok", "error": None,
        "wayCount": len(ways),
    } for corridor, ways in zip(corridors, per_corridor)]
    return per_corridor, records


def build_graph(ways: list[WayRecord]):
    graph: dict[int, list[tuple[int, float, int]]] = defaultdict(list)
    coords: dict[int, tuple[float, float]] = {}
    for way in ways:
        for node_id, lon, lat in way.nodes:
            coords[node_id] = (lon, lat)
        for a, b in zip(way.nodes, way.nodes[1:]):
            weight = haversine((a[1], a[2]), (b[1], b[2]))
            graph[a[0]].append((b[0], weight, way.osm_id))
            graph[b[0]].append((a[0], weight, way.osm_id))
    return graph, coords


def nearest_node(point: tuple[float, float], coords: dict[int, tuple[float, float]]):
    if not coords:
        return None, math.inf
    node_id = min(coords, key=lambda value: haversine(point, coords[value]))
    return node_id, haversine(point, coords[node_id])


def dijkstra(graph, start: int, goal: int):
    queue = [(0.0, start)]
    distance = {start: 0.0}
    previous: dict[int, tuple[int, int]] = {}
    while queue:
        current_distance, node = heapq.heappop(queue)
        if current_distance != distance.get(node):
            continue
        if node == goal:
            break
        for neighbour, weight, way_id in graph.get(node, ()):
            candidate = current_distance + weight
            if candidate < distance.get(neighbour, math.inf):
                distance[neighbour] = candidate
                previous[neighbour] = (node, way_id)
                heapq.heappush(queue, (candidate, neighbour))
    if goal not in distance:
        return None, [], math.inf
    nodes, ways, cursor = [goal], [], goal
    while cursor != start:
        cursor, way_id = previous[cursor]
        nodes.append(cursor); ways.append(way_id)
    nodes.reverse(); ways.reverse()
    return nodes, ways, distance[goal]


def densify(coords: list[tuple[float, float]], max_spacing_m: float) -> list[list[float]]:
    result = [[round(coords[0][0], 5), round(coords[0][1], 5)]]
    for a, b in zip(coords, coords[1:]):
        length = haversine(a, b)
        steps = max(1, math.ceil(length / max_spacing_m))
        for step in range(1, steps + 1):
            ratio = step / steps
            result.append([round(a[0] + (b[0] - a[0]) * ratio, 5), round(a[1] + (b[1] - a[1]) * ratio, 5)])
    # Rounding can create adjacent duplicates.
    return [point for index, point in enumerate(result) if index == 0 or point != result[index - 1]]


def perpendicular_distance(point, start, end):
    # Equirectangular projection is adequate for metre-scale simplification.
    mean_lat = math.radians((start[1] + end[1]) / 2)
    x, y = (point[0] - start[0]) * math.cos(mean_lat), point[1] - start[1]
    ex, ey = (end[0] - start[0]) * math.cos(mean_lat), end[1] - start[1]
    denom = ex * ex + ey * ey
    ratio = 0 if denom == 0 else max(0, min(1, (x * ex + y * ey) / denom))
    return math.hypot(x - ratio * ex, y - ratio * ey) * 111_195


def simplify(points: list[list[float]], tolerance_m: float) -> list[list[float]]:
    if len(points) < 3:
        return points
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        best_distance, best_index = 0.0, None
        for index in range(first + 1, last):
            value = perpendicular_distance(points[index], points[first], points[last])
            if value > best_distance:
                best_distance, best_index = value, index
        if best_index is not None and best_distance > tolerance_m:
            keep[best_index] = True
            stack.append((first, best_index)); stack.append((best_index, last))
    return [point for point, retained in zip(points, keep) if retained]


def overview_points(points: list[list[float]], target: int = 2000) -> tuple[list[list[float]], float]:
    low, high = 0.1, 2000.0
    best, tolerance = points, low
    for _ in range(18):
        mid = (low + high) / 2
        candidate = simplify(points, mid)
        if len(candidate) > target:
            low = mid
        else:
            best, tolerance, high = candidate, mid, mid
    return best, tolerance


def line_length(points: list[list[float]]) -> float:
    return sum(haversine(a, b) for a, b in zip(points, points[1:]))


def build_outputs(per_corridor, acquisitions, corridors, spacing_m):
    ride: list[list[float]] = []
    segment_records = []
    all_way_ids = set()
    for index, (corridor, ways) in enumerate(zip(corridors, per_corridor)):
        start_station, end_station = STATIONS[index], STATIONS[index + 1]
        graph, node_coords = build_graph(ways)
        start_node, start_snap = nearest_node((start_station[3], start_station[4]), node_coords)
        end_node, end_snap = nearest_node((end_station[3], end_station[4]), node_coords)
        path_nodes, path_way_ids, path_length = (None, [], math.inf)
        if start_node is not None and end_node is not None:
            path_nodes, path_way_ids, path_length = dijkstra(graph, start_node, end_node)
        if path_nodes:
            raw_coords = [node_coords[node_id] for node_id in path_nodes]
            confidence = "osm-mapped-connected-candidate"
            unresolved_reason = None
            unique_way_ids = sorted(set(path_way_ids))
            all_way_ids.update(unique_way_ids)
        else:
            raw_coords = [(start_station[3], start_station[4]), (end_station[3], end_station[4])]
            confidence = "unresolved-schematic-connector"
            unresolved_reason = acquisitions[index].get("error") or "No connected path between snapped rail nodes"
            unique_way_ids = []
            path_length = line_length(raw_coords)
        # Coordinate rounding to 5 decimals can add roughly 1.4 m at this
        # latitude, so generate at a smaller interval to keep the saved path
        # at or below the advertised 25 m ceiling.
        generation_spacing = max(1.0, spacing_m - 2.0)
        detailed = densify(raw_coords, generation_spacing)
        start_index = len(ride)
        junction_connector = None
        if ride and detailed[0] == ride[-1]:
            detailed = detailed[1:]
            start_index -= 1
        elif ride:
            junction_gap = haversine(ride[-1], detailed[0])
            # Keep a usable LineString, while recording this non-OSM connector
            # explicitly. It must never be mistaken for mapped rail geometry.
            junction_connector = {
                "confidence": "unresolved-schematic-connector",
                "reason": "Adjacent corridor graphs snapped the shared hub to different eligible OSM rail nodes",
                "lengthMetres": round(junction_gap, 3),
                "fromCoordinate": ride[-1], "toCoordinate": detailed[0],
            }
            bridge = densify((tuple(ride[-1]), tuple(detailed[0])), generation_spacing)[1:-1]
            ride.extend(bridge)
        ride.extend(detailed)
        end_index = len(ride) - 1
        segment_records.append({
            "id": corridor["id"], "fromHubId": start_station[0], "toHubId": end_station[0],
            "confidence": confidence, "unresolvedReason": unresolved_reason,
            "startIndex": start_index, "endIndex": end_index,
            "lengthMetres": round(path_length, 3),
            "directDistanceMetres": round(haversine((start_station[3], start_station[4]), (end_station[3], end_station[4])), 3),
            "startSnap": {"osmNodeId": start_node, "distanceMetres": round(start_snap, 3) if math.isfinite(start_snap) else None},
            "endSnap": {"osmNodeId": end_node, "distanceMetres": round(end_snap, 3) if math.isfinite(end_snap) else None},
            "osmWayIds": unique_way_ids,
            "precedingJunctionConnector": junction_connector,
        })
    overview, tolerance = overview_points(ride)
    total_length = line_length(ride)
    resolved = sum(s["confidence"] == "osm-mapped-connected-candidate" for s in segment_records)
    version = "1.0.0-osm-rail-candidate"
    unresolved_segments = [s["id"] for s in segment_records if s["confidence"] != "osm-mapped-connected-candidate" or s["precedingJunctionConnector"]]
    resolved_segments = [s["id"] for s in segment_records if s["id"] not in unresolved_segments]
    station_anchors = [{"hubId": s[0], "osmType": "node", "osmId": s[2], "coordinates": [s[3], s[4]]} for s in STATIONS]
    common = {
        "id": "pretoria-cape-town-rail-candidate", "version": version, "routeVersion": version,
        "name": "Pretoria–Cape Town OSM-mapped rail candidate",
        "source": "OpenStreetMap railway=rail ways, excluding siding/spur/yard/crossover service ways",
        "sourceUrl": "https://www.openstreetmap.org/copyright", "attribution": "© OpenStreetMap contributors",
        "license": "ODbL-1.0", "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "geometryType": "osm-rail-graph-shortest-path-candidate",
        "railAlignmentVerified": resolved == len(segment_records),
        "confidence": "osm-mapped-connected-candidate" if resolved == len(segment_records) else "mixed-with-explicit-unresolved-gaps",
        "reviewStatus": "automated-candidate-human-operational-route-review-pending",
        "intendedUse": "Geographic ride simulation; does not assert a current passenger service or operating itinerary",
        "direction": "pretoria-to-cape-town", "lengthMetres": round(total_length, 3),
        "generatedAt": utc_now(), "hubOrder": [s[0] for s in STATIONS],
        "stationAnchors": station_anchors, "resolvedSegments": resolved_segments,
        "unresolvedSegments": unresolved_segments,
        "provenanceFile": "provenance/rail-alignment.json", "segments": segment_records,
    }
    ride_feature = {"type": "Feature", "properties": {**common, "detail": "ride", "maximumTargetSpacingMetres": spacing_m},
                    "geometry": {"type": "LineString", "coordinates": ride}}
    overview_segments = [{key: value for key, value in segment.items() if key not in ("startIndex", "endIndex")} for segment in segment_records]
    overview_feature = {"type": "Feature", "properties": {**common, "segments": overview_segments, "detail": "overview", "simplificationToleranceMetres": round(tolerance, 3)},
                        "geometry": {"type": "LineString", "coordinates": overview}}
    provenance = {
        "source": "OpenStreetMap", "attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0",
        "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/", "generatedAt": utc_now(),
        "method": "Rail ways filtered by tag; graph vertices are OSM node IDs; Dijkstra weighted by haversine edge length; hubs snapped to nearest eligible node per corridor.",
        "excludedServiceValues": ["siding", "spur", "yard", "crossover"],
        "stationAnchors": [{
            "hubId": s[0], "name": s[1], "osmType": "node", "osmId": s[2], "lon": s[3], "lat": s[4],
            "sourceUrl": f"https://www.openstreetmap.org/node/{s[2]}",
            "sourceSnapshot": f"provenance/{s[0]}.osm",
            "sourceSnapshotSha256": sha256_file(PROVENANCE / f"{s[0]}.osm") if (PROVENANCE / f"{s[0]}.osm").exists() else None,
        } for s in STATIONS],
        "acquisitions": acquisitions, "segments": segment_records,
        "usedOsmWayIds": sorted(all_way_ids),
    }
    return overview_feature, ride_feature, provenance


def write_json(path: Path, payload, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    formatting = {"separators": (",", ":")} if compact else {"indent": 2}
    path.write_text(json.dumps(payload, ensure_ascii=False, **formatting) + "\n", encoding="utf-8")


def sync_eight_hub_data(ride):
    """Make the legacy engine's hubs and trigger distances match the route."""
    hubs_path = ROOT / "hubs.json"
    hubs = json.loads(hubs_path.read_text(encoding="utf-8"))
    existing = {station["hubId"]: station for station in hubs["stations"]}
    if "johannesburg" not in existing:
        existing["johannesburg"] = {
            "id": "johannesburg-station", "hubId": "johannesburg", "name": "Johannesburg",
            "lat": -26.1976708, "lon": 28.0423048, "recordType": "station", "sourceId": "osm-stations",
            "osmType": "node", "osmId": 326084268,
            "sourceUrl": "https://www.openstreetmap.org/node/326084268",
            "confidence": "osm-mapped-not-field-verified", "positionType": "mapped-station-point",
            "markerRole": "rail-station-anchor",
        }
    pack = json.loads((ROOT / "pack.v1.json").read_text(encoding="utf-8"))
    story_hubs = {chapter["hubId"] for chapter in pack["chapters"]}
    station_records = [existing[station[0]] for station in STATIONS]
    for station in station_records:
        station["storyTriggerStatus"] = "available" if station["hubId"] in story_hubs else "not-created-no-sourced-chapter"
    points = ride["geometry"]["coordinates"]
    cumulative = [0.0]
    for a, b in zip(points, points[1:]):
        cumulative.append(cumulative[-1] + haversine(a, b))
    hub_indices = [0] + [segment["endIndex"] for segment in ride["properties"]["segments"]]
    total = cumulative[-1]
    version = ride["properties"]["routeVersion"]
    triggers = [{
        "id": f"{station[0]}-trigger", "recordType": "trigger-zone", "hubId": station[0],
        "sEnter": max(0, cumulative[index] - 800), "sExit": min(total, cumulative[index] + 800),
        "stationAlongMetres": cumulative[index], "routeVersion": version,
        "confidence": "synthetic-test-zone-on-osm-rail-candidate", "markerRole": "story-unlock-zone",
        "designBasis": "800 m on either side of the nearest mapped rail node, clipped at route endpoints; not field calibrated",
    } for station, index in zip(STATIONS, hub_indices) if station[0] in story_hubs]
    hubs.update({
        "version": version, "hubOrder": [station[0] for station in STATIONS], "stations": station_records,
        "triggerZones": triggers,
        "mapNotice": "Eight mapped stations and seven sourced story trigger zones are independent records. Johannesburg is a mapped ride arrival without a sourced chapter trigger. The route is an automated OSM graph candidate pending human operational review.",
        "measurementMethod": "Cumulative haversine distance on OSM rail candidate LineString, Earth mean radius 6371008.8 m; metres from Pretoria",
    })
    hubs["recordTypeDefinitions"]["station"] = "Mapped station anchor snapped to the OSM rail candidate."
    write_json(hubs_path, hubs)
    write_json(PUBLIC_DATA / "hubs.json", hubs)

    selected_path = PROVENANCE / "osm-stations-selected.json"
    selected = json.loads(selected_path.read_text(encoding="utf-8"))
    if not any(record["hubId"] == "johannesburg" for record in selected["records"]):
        raw_path = PROVENANCE / "johannesburg.osm"
        if not raw_path.exists():
            download_file("https://api.openstreetmap.org/api/0.6/node/326084268", raw_path)
        raw_hash = sha256_file(raw_path)
        selected["records"].insert(1, {
            "hubId": "johannesburg", "osmType": "node", "osmId": 326084268,
            "lat": -26.1976708, "lon": 28.0423048, "version": 14,
            "timestamp": "2025-09-17T07:23:31Z",
            "tags": {"name": "Johannesburg Park Station", "public_transport": "station", "railway": "station", "ref": "JHB"},
            "retrievalUrl": "https://api.openstreetmap.org/api/0.6/node/326084268",
            "rawSha256": raw_hash,
            "sourceUrl": "https://www.openstreetmap.org/node/326084268",
        })
        selected["retrievedAt"] = utc_now()
        write_json(selected_path, selected)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pbf", type=Path, help="Use a dated Geofabrik PBF instead of live Overpass queries")
    parser.add_argument("--download-pbf", action="store_true", help="Download the dated PBF if --pbf is absent locally")
    parser.add_argument("--buffer-km", type=float, default=30.0)
    parser.add_argument("--spacing-m", type=float, default=25.0)
    args = parser.parse_args()
    corridors = []
    for start, end in zip(STATIONS, STATIONS[1:]):
        bbox = corridor_bbox(start, end, args.buffer_km)
        corridors.append({"id": f"{start[0]}--{end[0]}", "bbox": bbox, "query": overpass_query(bbox)})
    if args.pbf:
        if not args.pbf.exists():
            if args.download_pbf:
                download_file(DEFAULT_PBF_URL, args.pbf)
            else:
                raise SystemExit(f"PBF not found: {args.pbf}; add --download-pbf to fetch {DEFAULT_PBF_URL}")
        per_corridor, acquisitions = acquire_pbf(args.pbf, corridors)
    else:
        per_corridor, acquisitions = acquire_overpass(corridors)
    overview, ride, provenance = build_outputs(per_corridor, acquisitions, corridors, args.spacing_m)
    for path, payload in ((ROOT / "route.geojson", overview), (ROOT / "route-ride.geojson", ride),
                          (PUBLIC_DATA / "route.geojson", overview), (PUBLIC_DATA / "route-ride.geojson", ride),
                          (PROVENANCE / "rail-alignment.json", provenance)):
        write_json(path, payload, compact=path.name == "route-ride.geojson")
    sync_eight_hub_data(ride)
    print(json.dumps({
        "overviewPoints": len(overview["geometry"]["coordinates"]),
        "ridePoints": len(ride["geometry"]["coordinates"]),
        "lengthKm": round(ride["properties"]["lengthMetres"] / 1000, 3),
        "segments": [{"id": s["id"], "confidence": s["confidence"], "lengthKm": round(s["lengthMetres"] / 1000, 3)} for s in ride["properties"]["segments"]],
    }, indent=2))


if __name__ == "__main__":
    main()
