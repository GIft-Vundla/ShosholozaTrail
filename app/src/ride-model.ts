import type { Stop } from './data.js';

export type Coordinate = [number, number];
export type RideRouteProperties = Record<string, unknown> & {
  railAlignmentVerified?: boolean;
  confidence?: string;
  geometryType?: string;
  sourceStatus?: string;
  resolvedSegments?: unknown[];
  unresolvedSegments?: unknown[];
};
export type RideRoute = {
  type: 'Feature';
  properties: RideRouteProperties;
  geometry: { type: 'LineString'; coordinates: Coordinate[] };
};
export type RideWaypoint = {
  distanceMetres: number;
  coordinate: Coordinate;
  hubId?: string;
  hubIndex?: number;
  routeOffsetMetres?: number;
};

const EARTH_RADIUS_METRES = 6_371_008.8;
const rad = (value: number) => value * Math.PI / 180;

export function haversineMetres(a: Coordinate, b: Coordinate): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function readRideRoute(value: unknown): RideRoute {
  const candidate = value as { type?: string; features?: unknown[]; geometry?: { type?: string }; properties?: RideRouteProperties };
  const feature = candidate?.type === 'FeatureCollection'
    ? candidate.features?.find(item => (item as RideRoute)?.geometry?.type === 'LineString')
    : candidate;
  const route = feature as RideRoute | undefined;
  if (route?.type !== 'Feature' || route.geometry?.type !== 'LineString' || route.geometry.coordinates.length < 2) {
    throw new Error('The ride route is not a continuous GeoJSON LineString.');
  }
  if (!route.geometry.coordinates.every(point => Array.isArray(point)
    && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
    throw new Error('The ride route contains invalid coordinates.');
  }
  const status = `${route.properties?.confidence ?? ''} ${route.properties?.geometryType ?? ''}`.toLowerCase();
  const unresolvedSegments = route.properties?.unresolvedSegments;
  if (route.properties?.railAlignmentVerified !== true
    || /unresolved|schematic/.test(status)
    || (Array.isArray(unresolvedSegments) && unresolvedSegments.length > 0)) {
    throw new Error('The available route is not verified rail alignment.');
  }
  return route;
}

export function cumulativeDistances(coordinates: Coordinate[]): number[] {
  const values = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    values.push(values[index - 1] + haversineMetres(coordinates[index - 1], coordinates[index]));
  }
  return values;
}

export function coordinateAtDistance(
  coordinates: Coordinate[], cumulative: number[], distanceMetres: number,
): Coordinate {
  const target = Math.max(0, Math.min(cumulative.at(-1) ?? 0, distanceMetres));
  let lowBound = 0;
  let highBound = cumulative.length - 1;
  while (lowBound < highBound) {
    const middle = Math.floor((lowBound + highBound) / 2);
    if (cumulative[middle] < target) lowBound = middle + 1;
    else highBound = middle;
  }
  const high = lowBound;
  if (high <= 0) return [...coordinates[0]];
  const low = high - 1;
  const fraction = (target - cumulative[low]) / Math.max(1, cumulative[high] - cumulative[low]);
  return [
    coordinates[low][0] + (coordinates[high][0] - coordinates[low][0]) * fraction,
    coordinates[low][1] + (coordinates[high][1] - coordinates[low][1]) * fraction,
  ];
}

export function buildRideWaypoints(
  route: RideRoute, stops: Stop[], spacingMetres = 2_000, maxHubDistanceMetres = 10_000,
): RideWaypoint[] {
  const coordinates = route.geometry.coordinates;
  const cumulative = cumulativeDistances(coordinates);
  const total = cumulative.at(-1) ?? 0;
  const distances = new Set<number>([0, total]);
  for (let distance = spacingMetres; distance < total; distance += spacingMetres) distances.add(distance);

  const hubs = stops.map((stop, hubIndex) => {
    let closestIndex = 0;
    let offset = Infinity;
    coordinates.forEach((coordinate, index) => {
      const candidate = haversineMetres(coordinate, [stop.lon, stop.lat]);
      if (candidate < offset) { offset = candidate; closestIndex = index; }
    });
    return { distanceMetres: cumulative[closestIndex], offset, hubIndex, hubId: stop.id };
  }).filter(hub => hub.offset <= maxHubDistanceMetres);
  hubs.forEach(hub => distances.add(hub.distanceMetres));

  return [...distances].sort((a, b) => a - b).map(distanceMetres => {
    const matchingHubs = hubs.filter(item => Math.abs(item.distanceMetres - distanceMetres) < 1);
    const hub = matchingHubs.length === 1 ? matchingHubs[0] : undefined;
    return {
      distanceMetres,
      coordinate: coordinateAtDistance(coordinates, cumulative, distanceMetres),
      ...(hub ? { hubId: hub.hubId, hubIndex: hub.hubIndex, routeOffsetMetres: hub.offset } : {}),
    };
  });
}

export function describeRouteSource(route: RideRoute): string {
  const properties = route.properties ?? {};
  const confidence = String(properties.confidence || properties.sourceStatus || 'verified').replaceAll('-', ' ');
  const unresolved = Array.isArray(properties.unresolvedSegments) ? properties.unresolvedSegments.length : 0;
  const resolved = Array.isArray(properties.resolvedSegments) ? properties.resolvedSegments.length : 0;
  const segments = resolved || unresolved ? ` / ${resolved} resolved${unresolved ? `, ${unresolved} unresolved` : ''}` : '';
  return `Mapped rail geometry / ${confidence}${segments}`;
}

export function addTerrainToSatelliteStyle<T extends { sources?: Record<string, unknown> }>(
  satelliteStyle: T, outdoorStyle?: { sources?: Record<string, unknown> },
): T {
  const style = structuredClone(satelliteStyle);
  const elevation = outdoorStyle?.sources?.elevation;
  if (elevation) style.sources = { ...(style.sources ?? {}), elevation };
  return style;
}
