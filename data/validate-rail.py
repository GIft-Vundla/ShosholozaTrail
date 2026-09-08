"""Validate the generated OSM rail candidate and write review evidence."""
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT.parent / "evidence" / "rail-alignment-validation.json"
RADIUS = 6_371_008.8


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2 * RADIUS * math.asin(math.sqrt(value))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


route_path = ROOT / "route-ride.geojson"
route = json.loads(route_path.read_text(encoding="utf-8"))
points = route["geometry"]["coordinates"]
properties = route["properties"]
gaps = [distance(a, b) for a, b in zip(points, points[1:])]
measured = sum(gaps)
anchors = properties["stationAnchors"]
endpoint_checks = {
    "startToPretoriaMetres": distance(points[0], anchors[0]["coordinates"]),
    "endToCapeTownMetres": distance(points[-1], anchors[-1]["coordinates"]),
}
hex_points = [p for p in points if 19.35 <= p[0] <= 19.85 and -33.75 <= p[1] <= -33.35]
hex_along = sum(distance(a, b) for a, b in zip(hex_points, hex_points[1:]))
hex_direct = distance(hex_points[0], hex_points[-1]) if len(hex_points) >= 2 else 0
result = {
    "testedAt": datetime.now(timezone.utc).isoformat(),
    "routeSha256": sha(route_path),
    "publicCopySha256": sha(ROOT.parent / "public" / "data" / "route-ride.geojson"),
    "pointCount": len(points),
    "overviewPointCount": len(json.loads((ROOT / "route.geojson").read_text(encoding="utf-8"))["geometry"]["coordinates"]),
    "measuredLengthKm": round(measured / 1000, 3),
    "declaredLengthKm": round(properties["lengthMetres"] / 1000, 3),
    "maximumAdjacentSpacingMetres": round(max(gaps), 3),
    "railAlignmentVerified": properties["railAlignmentVerified"],
    "resolvedSegments": properties["resolvedSegments"],
    "unresolvedSegments": properties["unresolvedSegments"],
    "endpointChecks": {key: round(value, 3) for key, value in endpoint_checks.items()},
    "segments": [{
        "id": segment["id"], "confidence": segment["confidence"],
        "lengthKm": round(segment["lengthMetres"] / 1000, 3),
        "startSnapMetres": segment["startSnap"]["distanceMetres"],
        "endSnapMetres": segment["endSnap"]["distanceMetres"],
        "osmWayCount": len(segment["osmWayIds"]),
        "precedingJunctionConnector": segment["precedingJunctionConnector"],
    } for segment in properties["segments"]],
    "hexRiver": {
        "bounds": [19.35, -33.75, 19.85, -33.35],
        "pointCount": len(hex_points),
        "alongLengthKm": round(hex_along / 1000, 3),
        "endpointDistanceKm": round(hex_direct / 1000, 3),
        "sinuosity": round(hex_along / hex_direct, 4) if hex_direct else None,
    },
    "checks": {},
}
checks = result["checks"]
checks["eightStationAnchors"] = len(anchors) == 8
checks["sevenResolvedSegments"] = len(properties["resolvedSegments"]) == 7 and not properties["unresolvedSegments"]
checks["lengthSanity1200To1900Km"] = 1200 <= measured / 1000 <= 1900
checks["maximumSpacingAtMost25Metres"] = max(gaps) <= 25
checks["endpointsWithin50Metres"] = max(endpoint_checks.values()) <= 50
checks["hexRiverCurved"] = len(hex_points) > 1000 and hex_along / hex_direct > 1.08
checks["publicCopyExact"] = result["routeSha256"] == result["publicCopySha256"]
result["passed"] = all(checks.values())
EVIDENCE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
raise SystemExit(0 if result["passed"] else 1)
