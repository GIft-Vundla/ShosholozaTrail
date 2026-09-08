import { useEffect, useRef, useState } from 'react';
import maplibregl from '../vendor/maplibre';
import { STOPS } from '../data';
import { coordinateAtDistance, cumulativeDistances, readRideRoute, type Coordinate } from '../ride-model';

type Position = { lon: number; lat: number };
type MapController = {
  addStyleControl(): HTMLElement;
  destroy(): void;
  fitRoute(options?: Record<string, unknown>): void;
  setFollow(value: boolean): boolean;
  setRouteProgress(metres: number, options?: Record<string, unknown>): unknown;
  updatePosition(position: Position & { s: number; source: string }, movement?: Record<string, unknown>): void;
};
type ImmersiveModule = {
  createImmersiveMap(options: Record<string, unknown>): MapController;
  haversineMetres(a: [number, number], b: [number, number]): number;
};

let mapConfigPromise: Promise<Record<string, unknown>> | null = null;
function loadMapConfig(): Promise<Record<string, unknown>> {
  if (!mapConfigPromise) {
    mapConfigPromise = fetch('/api/map-config', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async response => {
        const result = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error(String(result.reason || result.error || 'Map configuration unavailable'));
        return result;
      })
      .catch(() => ({ provider: 'esri' }));
  }
  return mapConfigPromise;
}

export function JourneyMap({ progress, focus, onSelect }: {
  progress: number;
  current: number;
  next: number;
  focus: boolean;
  onSelect: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const distanceRef = useRef(0);
  const coordinatesRef = useRef<Coordinate[]>(STOPS.map(stop => [stop.lon, stop.lat]));
  const cumulativeRef = useRef(cumulativeDistances(coordinatesRef.current));
  const progressRef = useRef(progress);
  const focusRef = useRef(focus);
  const onSelectRef = useRef(onSelect);
  progressRef.current = progress;
  focusRef.current = focus;
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState('Loading geographic map...');
  const [routeSource, setRouteSource] = useState('Loading mapped rail geometry...');

  useEffect(() => {
    let cancelled = false;
    const moduleUrl = '/map/immersive-map.js';
    void Promise.all([
      import(/* @vite-ignore */ moduleUrl) as Promise<ImmersiveModule>,
      loadMapConfig(),
      fetch('/data/route.geojson', { cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } })
        .then(async response => {
          if (!response.ok) throw new Error('overview-route-unavailable');
          return readRideRoute(await response.json());
        })
        .catch(() => null),
    ]).then(([module, mapConfig, verifiedRoute]) => {
      if (cancelled || !canvasRef.current || !controlsRef.current) return;
      const coordinates = verifiedRoute?.geometry.coordinates
        ?? STOPS.map(stop => [stop.lon, stop.lat] as Coordinate);
      const lengthMetres = coordinates.slice(1).reduce(
        (sum, point, index) => sum + module.haversineMetres(coordinates[index], point), 0,
      );
      distanceRef.current = lengthMetres;
      coordinatesRef.current = coordinates;
      cumulativeRef.current = cumulativeDistances(coordinates);
      setRouteSource(verifiedRoute
        ? `Mapped rail geometry / ${String(verifiedRoute.properties.confidence ?? 'verified').replaceAll('-', ' ')}`
        : 'Station-connector fallback / mapped rail overview unavailable');
      const controller = module.createImmersiveMap({
        maplibre: maplibregl,
        container: canvasRef.current,
        controlsContainer: controlsRef.current,
        route: verifiedRoute ?? {
          type: 'Feature',
          properties: { lengthMetres, confidence: 'unresolved', geometryType: 'schematic-station-connectors' },
          geometry: { type: 'LineString', coordinates },
        },
        hubs: STOPS.map((stop, index) => ({ ...stop, hubId: stop.id, index })),
        initialStyle: 'satellite',
        follow: focusRef.current,
        cinematic: true,
        mapConfig,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onHubSelect: (hub: { index: number }) => onSelectRef.current(hub.index),
        onStatus: ({ status: nextStatus }: { status: string }) => {
          if (cancelled) return;
          if (nextStatus === 'ready' || nextStatus === 'style-ready') setStatus('');
          else if (nextStatus === 'provider-fallback') setStatus('Map provider unavailable; keyless fallback loaded.');
        },
      });
      controllerRef.current = controller;
      controller.addStyleControl();
      const distance = progressRef.current * lengthMetres;
      const position = coordinateAtDistance(coordinatesRef.current, cumulativeRef.current, distance);
      controller.setRouteProgress(distance, { animate: false });
      controller.updatePosition({ lon: position[0], lat: position[1], s: distance, source: 'replay' }, { duration: 0 });
    }).catch(() => {
      if (!cancelled) setStatus('The geographic map could not load. Open the journey engine for its offline route.');
    });
    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !distanceRef.current) return;
    const distance = progress * distanceRef.current;
    const position = coordinateAtDistance(coordinatesRef.current, cumulativeRef.current, distance);
    controller.setRouteProgress(distance);
    controller.updatePosition({ lon: position[0], lat: position[1], s: distance, source: 'replay' }, { duration: 850, zoom: 7.2 });
  }, [progress]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setFollow(focus);
    if (!focus) controller.fitRoute({ duration: 900 });
  }, [focus]);

  return <div className="journey-map real-journey-map">
    <div ref={canvasRef} className="journey-map-canvas" aria-label="Interactive Pretoria to Cape Town story map" />
    <div ref={controlsRef} className="react-map-controls" />
    <p className="journey-map-provenance" data-testid="journey-route-source">{routeSource}</p>
    {status && <p className="journey-map-loading" role="status">{status}</p>}
  </div>;
}
