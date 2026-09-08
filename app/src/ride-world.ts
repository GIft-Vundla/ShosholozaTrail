import type { GeoJSONSource, Map as MapType } from 'maplibre-gl';
import { coordinateAtDistance, cumulativeDistances, haversineMetres, type Coordinate, type RideRoute } from './ride-model';

export type RideStation = { id: string; hubId: string; name: string; lat: number; lon: number };
export type RideTriggerZone = { id: string; hubId: string; sEnter: number; sExit: number; stationAlongMetres: number };
export type RideAttraction = { id: string; hubId: string; name: string; lat: number | null; lon: number | null };
export type RideHubData = { version: string; stations: RideStation[]; triggerZones: RideTriggerZone[]; attractions: RideAttraction[] };
type WorldFeature = { type: 'Feature'; id: string; properties: Record<string, string | number | boolean>; geometry: { type: 'Point'; coordinates: Coordinate } | { type: 'Polygon'; coordinates: Coordinate[][] } };
type WorldCollection = { type: 'FeatureCollection'; features: WorldFeature[] };
export type RideWorldModel = { route: RideRoute; cumulative: number[]; totalDistance: number; hubs: WorldFeature[]; attractions: WorldFeature[]; approaches: WorldFeature[]; kilometrePosts: WorldFeature[] };

function pointFeature(id: string, coordinates: Coordinate, properties: WorldFeature['properties']): WorldFeature {
  return { type: 'Feature', id, properties, geometry: { type: 'Point', coordinates } };
}

function nearestAlong(route: RideRoute, cumulative: number[], coordinate: Coordinate) {
  let nearest = 0, separation = Infinity;
  route.geometry.coordinates.forEach((candidate, index) => {
    const distance = haversineMetres(candidate, coordinate);
    if (distance < separation) { separation = distance; nearest = cumulative[index]; }
  });
  return nearest;
}

function anchoredAttraction(station: RideStation, index: number): Coordinate {
  const angle = index * 2.4, radius = 0.0035 + (index % 3) * 0.0012;
  return [station.lon + Math.cos(angle) * radius, station.lat + Math.sin(angle) * radius];
}

export function buildRideWorldModel(route: RideRoute, hubs: RideHubData): RideWorldModel {
  const cumulative = cumulativeDistances(route.geometry.coordinates);
  const totalDistance = cumulative.at(-1) ?? 0;
  const zoneByHub = new Map(hubs.triggerZones.map(zone => [zone.hubId, zone]));
  const stationByHub = new Map(hubs.stations.map(station => [station.hubId, station]));
  const alongByHub = new Map(hubs.stations.map(station => [station.hubId, zoneByHub.get(station.hubId)?.stationAlongMetres ?? nearestAlong(route, cumulative, [station.lon, station.lat])]));
  const stationFeatures = hubs.stations.map(station => pointFeature(`hub:${station.hubId}`, [station.lon, station.lat], { hubId: station.hubId, label: station.name, kind: 'station', alongMetres: alongByHub.get(station.hubId) ?? 0, proximity: 999_999, discovered: false }));
  const attractionFeatures = hubs.attractions.map((attraction, index) => {
    const station = stationByHub.get(attraction.hubId);
    const mapped = Number.isFinite(attraction.lon) && Number.isFinite(attraction.lat);
    const coordinates: Coordinate = mapped ? [Number(attraction.lon), Number(attraction.lat)] : station ? anchoredAttraction(station, index) : route.geometry.coordinates[0];
    return pointFeature(`attraction:${attraction.id}`, coordinates, { hubId: attraction.hubId, label: attraction.name, kind: 'attraction', alongMetres: alongByHub.get(attraction.hubId) ?? 0, placement: mapped ? 'mapped-associated-place' : 'hub-story-anchor', proximity: 999_999, discovered: false });
  });
  const approaches = hubs.triggerZones.flatMap(zone => ([5_000, 2_000, 500] as const).map(distance => pointFeature(`approach:${zone.hubId}:${distance}`, coordinateAtDistance(route.geometry.coordinates, cumulative, Math.max(0, zone.stationAlongMetres - distance)), { hubId: zone.hubId, label: `${distance >= 1_000 ? `${distance / 1_000} km` : `${distance} m`} to ${stationByHub.get(zone.hubId)?.name ?? zone.hubId}`, distance })));
  const kilometrePosts: WorldFeature[] = [];
  for (let distance = 10_000; distance < totalDistance; distance += 10_000) kilometrePosts.push(pointFeature(`km:${distance}`, coordinateAtDistance(route.geometry.coordinates, cumulative, distance), { label: `KM ${distance / 1_000}`, alongMetres: distance }));
  return { route, cumulative, totalDistance, hubs: stationFeatures, attractions: attractionFeatures, approaches, kilometrePosts };
}

function markerImage(kind: 'pin' | 'landmark', lit: boolean) {
  const runtime = globalThis as unknown as { document: { createElement(tag: string): any } };
  const canvas = runtime.document.createElement('canvas'); canvas.width = 72; canvas.height = 72;
  const context = canvas.getContext('2d')!;
  context.shadowColor = lit ? '#f4bd4f' : 'rgba(0,0,0,.5)'; context.shadowBlur = lit ? 13 : 5;
  context.fillStyle = lit ? '#f4bd4f' : '#34404d'; context.strokeStyle = lit ? '#fff4ca' : '#aeb5bc'; context.lineWidth = 4; context.beginPath();
  if (kind === 'pin') {
    context.arc(36, 28, 19, Math.PI, 0); context.lineTo(36, 67); context.lineTo(17, 28); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.arc(36, 28, 7, 0, Math.PI * 2); context.fillStyle = '#14202c'; context.fill();
  } else {
    context.moveTo(8, 57); context.lineTo(14, 32); context.lineTo(25, 23); context.lineTo(34, 34); context.lineTo(44, 13); context.lineTo(53, 31); context.lineTo(64, 39); context.lineTo(66, 57); context.closePath(); context.fill(); context.stroke();
  }
  return context.getImageData(0, 0, 72, 72);
}

const collection = (features: WorldFeature[]): WorldCollection => ({ type: 'FeatureCollection', features });

export function installRideWorld(map: MapType, world: RideWorldModel, openHub: (hubId: string) => void, offline = false) {
  if (!offline) {
  map.addSource('ofm', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  map.addLayer({ id: 'ride-landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse', paint: { 'fill-color': ['match', ['get', 'class'], ['farmland', 'farm', 'orchard', 'vineyard'], '#b6a66f', ['grass', 'meadow'], '#809b63', ['wood', 'forest'], '#4f7553', ['residential', 'commercial', 'industrial'], '#b9aa9a', '#9b956f'], 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'ride-landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover', paint: { 'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], '#3f7049', ['grass', 'scrub'], '#748a55', ['sand'], '#c8ad78', '#9d976d'], 'fill-opacity': 0.13 } });
  map.addLayer({ id: 'ride-water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#4f98b7', 'fill-opacity': 0.72 } });
  map.addLayer({ id: 'ride-waterways', type: 'line', source: 'ofm', 'source-layer': 'waterway', paint: { 'line-color': '#6db2cf', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 3.5], 'line-opacity': 0.82 } });
  map.addLayer({ id: 'ride-parallel-rail', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#ddd0b1', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 3.2], 'line-dasharray': [1.4, 1], 'line-opacity': 0.88 } });
  map.addLayer({ id: '3d-buildings', source: 'ofm', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 14, paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, '#c9b79c', 12, '#b09a7d', 40, '#8c7a63'], 'fill-extrusion-height': ['case', ['has', 'render_height'], ['get', 'render_height'], 6], 'fill-extrusion-base': ['case', ['has', 'render_min_height'], ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.92 } });
  }
  map.addImage('ride-pin-lit', markerImage('pin', true), { pixelRatio: 2 }); map.addImage('ride-pin-dim', markerImage('pin', false), { pixelRatio: 2 });
  map.addImage('ride-landmark-lit', markerImage('landmark', true), { pixelRatio: 2 }); map.addImage('ride-landmark-dim', markerImage('landmark', false), { pixelRatio: 2 });
  map.addSource('ride-hubs', { type: 'geojson', data: collection(world.hubs) as never });
  map.addSource('ride-attractions', { type: 'geojson', data: collection(world.attractions) as never });
  map.addSource('ride-approaches', { type: 'geojson', data: collection(world.approaches) as never });
  map.addSource('ride-km-posts', { type: 'geojson', data: collection(world.kilometrePosts) as never });
  map.addSource('ride-train', { type: 'geojson', data: collection([]) as never });
  const proximitySize = ['interpolate', ['linear'], ['get', 'proximity'], 0, 1.35, 5_000, 1.05, 25_000, 0.72, 100_000, 0.45] as never;
  map.addLayer({ id: 'ride-hub-billboards', type: 'symbol', source: 'ride-hubs', layout: { 'icon-image': ['case', ['get', 'discovered'], 'ride-pin-lit', 'ride-pin-dim'], 'icon-size': proximitySize, 'icon-allow-overlap': true, ...(offline ? {} : { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1.5, 'text-allow-overlap': true }) }, paint: offline ? {} : { 'text-color': ['case', ['get', 'discovered'], '#fff4ca', '#c6ccd2'], 'text-halo-color': '#101820', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['get', 'proximity'], 0, 1, 35_000, 0.85, 120_000, 0] } });
  map.addLayer({ id: 'ride-attraction-silhouettes', type: 'symbol', source: 'ride-attractions', layout: { 'icon-image': ['case', ['get', 'discovered'], 'ride-landmark-lit', 'ride-landmark-dim'], 'icon-size': proximitySize, 'icon-allow-overlap': true, ...(offline ? {} : { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 1.4 }) }, paint: offline ? {} : { 'text-color': ['case', ['get', 'discovered'], '#fff0b6', '#bac1c8'], 'text-halo-color': '#101820', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['get', 'proximity'], 0, 1, 20_000, 0.72, 80_000, 0] } });
  if (!offline) {
    map.addLayer({ id: 'ride-approach-markers', type: 'symbol', source: 'ride-approaches', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#f4bd4f', 'text-halo-color': '#14202c', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 13, 0.55, 16, 1] } });
    map.addLayer({ id: 'ride-kilometre-posts', type: 'symbol', source: 'ride-km-posts', minzoom: 11, layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 10 }, paint: { 'text-color': '#17212d', 'text-halo-color': '#f4e6bb', 'text-halo-width': 2 } });
  }
  map.addLayer({ id: 'ride-train-body', type: 'fill-extrusion', source: 'ride-train', paint: { 'fill-extrusion-color': '#9f302c', 'fill-extrusion-height': 5.2, 'fill-extrusion-base': 0.4, 'fill-extrusion-opacity': 0.98 } });
  for (const layer of ['ride-hub-billboards', 'ride-attraction-silhouettes']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    map.on('click', layer, event => { const hubId = event.features?.[0]?.properties?.hubId; if (typeof hubId === 'string') openHub(hubId); });
  }
}

function trainPolygon(world: RideWorldModel, distanceMetres: number): WorldFeature {
  const rear = coordinateAtDistance(world.route.geometry.coordinates, world.cumulative, Math.max(0, distanceMetres - 65));
  const front = coordinateAtDistance(world.route.geometry.coordinates, world.cumulative, Math.max(0, distanceMetres - 25));
  const latitude = (rear[1] + front[1]) / 2, metresPerLon = 111_320 * Math.cos(latitude * Math.PI / 180);
  const dx = (front[0] - rear[0]) * metresPerLon, dy = (front[1] - rear[1]) * 110_540, length = Math.max(1, Math.hypot(dx, dy)), halfWidth = 2.1;
  const offsetLon = (-dy / length * halfWidth) / metresPerLon, offsetLat = (dx / length * halfWidth) / 110_540;
  return { type: 'Feature', id: 'train', properties: { kind: 'train' }, geometry: { type: 'Polygon', coordinates: [[[rear[0] + offsetLon, rear[1] + offsetLat], [front[0] + offsetLon, front[1] + offsetLat], [front[0] - offsetLon, front[1] - offsetLat], [rear[0] - offsetLon, rear[1] - offsetLat], [rear[0] + offsetLon, rear[1] + offsetLat]]] } };
}

export function updateRideWorld(map: MapType, world: RideWorldModel, distanceMetres: number, discoveredHubs: Set<string>) {
  const withState = (feature: WorldFeature): WorldFeature => ({ ...feature, properties: { ...feature.properties, proximity: Math.abs(Number(feature.properties.alongMetres ?? distanceMetres) - distanceMetres), discovered: discoveredHubs.has(String(feature.properties.hubId)) } });
  (map.getSource('ride-hubs') as GeoJSONSource | undefined)?.setData(collection(world.hubs.map(withState)) as never);
  (map.getSource('ride-attractions') as GeoJSONSource | undefined)?.setData(collection(world.attractions.map(withState)) as never);
  (map.getSource('ride-train') as GeoJSONSource | undefined)?.setData(collection([trainPolygon(world, distanceMetres)]) as never);
}
