import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { Map as MapType, StyleSpecification } from 'maplibre-gl';
import maplibregl from '../vendor/maplibre';
import { STOPS } from '../data';
import {
  buildRideWaypoints,
  addTerrainToSatelliteStyle,
  coordinateAtDistance,
  cumulativeDistances,
  describeRouteSource,
  readRideRoute,
  type RideRoute,
  type RideWaypoint,
} from '../ride-model';
import { LocalizedScene } from './LocalizedScene';
import { AiAssistant } from './AiAssistant';
import { buildRideWorldModel, installRideWorld, updateRideWorld, type RideHubData } from '../ride-world';
import { RideSoundscape } from '../ride-audio';

type RideMapController = {
  setCamera(distanceMetres: number, bearingOffset: number, pitch: number): void;
  destroy(): void;
};
type BasemapModule = {
  createBasemapStyles(config?: Record<string, unknown>): Record<string, { style: StyleSpecification }>;
};
type TriggerModule = {
  crossingZones(previous: number, current: number, zones: { id: string; hubId: string; sEnter: number; sExit: number }[]): { id: string; hubId: string; sEnter: number; sExit: number }[];
};

type SkyPeriod = 'dawn' | 'midday' | 'dusk' | 'night';
type SkyPalette = { sky: string; horizon: string; fog: string };

const CAMERA_LOOK_AHEAD_METRES = 240;
const DEFAULT_PITCH = 87;
const RIDE_ZOOM = 16;
const TERRAIN_EXAGGERATION = 1.8;
const SKY_PALETTES: Record<SkyPeriod, SkyPalette> = {
  dawn: { sky: '#3a5a80', horizon: '#e8956b', fog: '#d8a882' },
  midday: { sky: '#8fb8e0', horizon: '#e8d3b0', fog: '#d9c9ae' },
  dusk: { sky: '#2e4260', horizon: '#d4703c', fog: '#b98a63' },
  night: { sky: '#070d18', horizon: '#16202f', fog: '#0d1420' },
};

function skyPeriodAt(distanceMetres: number, totalMetres: number): SkyPeriod {
  const journeyHour = (8 + 50 / 60 + (distanceMetres / Math.max(1, totalMetres)) * 27) % 24;
  if (journeyHour >= 5 && journeyHour < 8) return 'dawn';
  if (journeyHour >= 8 && journeyHour < 17.5) return 'midday';
  if (journeyHour >= 17.5 && journeyHour < 20) return 'dusk';
  return 'night';
}

function mixHex(from: string, to: string, progress: number) {
  const source = Number.parseInt(from.slice(1), 16);
  const target = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((source >> shift) & 255) + (((target >> shift) & 255) - ((source >> shift) & 255)) * progress);
  return `#${[16, 8, 0].map(channel).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function setRideSky(map: MapType, palette: SkyPalette) {
  map.setSky({
    'sky-color': palette.sky,
    'sky-horizon-blend': 0.6,
    'horizon-color': palette.horizon,
    'horizon-fog-blend': 0.55,
    'fog-color': palette.fog,
    'fog-ground-blend': 0.08,
  });
}

function easeInOutCubic(value: number) {
  return value < .5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function sourceErrorMessage(reason: unknown) {
  const detail = reason instanceof Error ? reason.message : '';
  if (/verified rail alignment|continuous GeoJSON|invalid coordinates/i.test(detail)) {
    return detail;
  }
  return 'The verified rail alignment has not been added yet. The ride will unlock when route-ride.geojson is available.';
}

export function Ride() {
  const mapElement = useRef<HTMLDivElement>(null);
  const controller = useRef<RideMapController | null>(null);
  const frame = useRef<number | null>(null);
  const travelTimer = useRef<number | null>(null);
  const indexRef = useRef(0);
  const lookRef = useRef({ bearing: 0, pitch: DEFAULT_PITCH });
  const dragRef = useRef<{ id: number; x: number; y: number; bearing: number; pitch: number } | null>(null);
  const holdRef = useRef<{ timer: number | null; activated: boolean }>({ timer: null, activated: false });
  const discoveredRef = useRef(new Set<string>());
  const autoRef = useRef(false);
  const speedRef = useRef<1 | 4 | 16>(1);
  const triggerModuleRef = useRef<TriggerModule | null>(null);
  const openHubRef = useRef<(hubId: string) => void>(() => undefined);
  const lookStatusRef = useRef<'available' | 'earned' | 'missed'>('available');
  const soundRef = useRef<RideSoundscape | null>(null);
  const soundedDiscoveries = useRef(0);
  const [route, setRoute] = useState<RideRoute | null>(null);
  const [hubData, setHubData] = useState<RideHubData | null>(null);
  const [waypoints, setWaypoints] = useState<RideWaypoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [message, setMessage] = useState('Loading verified rail geometry...');
  const [mapReady, setMapReady] = useState(false);
  const [skyPeriod, setSkyPeriod] = useState<SkyPeriod>('midday');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeedState] = useState<1 | 4 | 16>(1);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [lookStatus, setLookStatus] = useState<'available' | 'earned' | 'missed'>('available');
  const [moving, setMoving] = useState(false);
  const [arrival, setArrival] = useState<number | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  openHubRef.current = hubId => {
    const hubIndex = STOPS.findIndex(stop => stop.id === hubId);
    if (hubIndex >= 0) { setArrival(hubIndex); setStoryOpen(false); setAuto(false); autoRef.current = false; }
  };

  const setSpeed = (value: 1 | 4 | 16) => {
    speedRef.current = value;
    setSpeedState(value);
  };

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);

  useEffect(() => { autoRef.current = auto; }, [auto]);

  useEffect(() => {
    const abort = new AbortController();
    const triggerModuleUrl = '/engine/triggers.js';
    void Promise.all([
      fetch('/data/route-ride.geojson', { cache: 'no-store', signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error('route-data-missing');
        return response.json();
      }),
      fetch('/data/hubs.json', { cache: 'no-store', signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error('hub-data-missing');
        return response.json() as Promise<RideHubData>;
      }),
      import(/* @vite-ignore */ triggerModuleUrl) as Promise<TriggerModule>,
    ]).then(([value, nextHubData, triggerModule]) => {
        const nextRoute = readRideRoute(value);
        if (nextHubData.version !== nextRoute.properties.routeVersion) throw new Error('The ride story zones do not match the verified route version.');
        const nextWaypoints = buildRideWaypoints(nextRoute, STOPS);
        if (nextWaypoints.length < 2) throw new Error('The ride route does not have enough distance to navigate.');
        const params = new URLSearchParams(window.location.search);
        const requestedHub = params.get('hub');
        const requestedDistance = Number(params.get('s'));
        const requestedIndex = requestedHub ? nextWaypoints.findIndex(waypoint => waypoint.hubId === requestedHub) : -1;
        const distanceIndex = Number.isFinite(requestedDistance) && requestedDistance >= 0
          ? nextWaypoints.reduce((best, waypoint, index) => Math.abs(waypoint.distanceMetres - requestedDistance) < Math.abs(nextWaypoints[best].distanceMetres - requestedDistance) ? index : best, 0)
          : -1;
        const startIndex = requestedIndex >= 0 ? requestedIndex : distanceIndex >= 0 ? distanceIndex : 0;
        indexRef.current = startIndex;
        setRoute(nextRoute);
        setHubData(nextHubData);
        triggerModuleRef.current = triggerModule;
        setWaypoints(nextWaypoints);
        setCurrent(startIndex);
        const startingDiscoveries = triggerModule.crossingZones(-1, nextWaypoints[startIndex].distanceMetres, nextHubData.triggerZones).map(zone => zone.hubId);
        discoveredRef.current = new Set(startingDiscoveries);
        setDiscovered(startingDiscoveries);
        setState('ready');
        setMessage('');
        if (requestedHub && nextWaypoints[startIndex].hubIndex !== undefined) setArrival(nextWaypoints[startIndex].hubIndex);
      })
      .catch(error => {
        if (abort.signal.aborted) return;
        const invalid = error instanceof Error && /verified rail alignment|continuous GeoJSON|invalid coordinates/i.test(error.message);
        setState(invalid ? 'error' : 'unavailable');
        setMessage(sourceErrorMessage(error));
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!route || !hubData || !mapElement.current) return;
    let removed = false;
    let map: MapType | null = null;
    let skyFrame: number | null = null;
    let activeSkyPeriod: SkyPeriod | null = null;
    let activeSkyPalette = SKY_PALETTES.midday;
    const coordinates = route.geometry.coordinates;
    const cumulative = cumulativeDistances(coordinates);
    const totalDistance = cumulative.at(-1) ?? 1;
    const world = buildRideWorldModel(route, hubData);
    let lastWorldUpdate = 0;
    const forcedSky = new URLSearchParams(window.location.search).get('time') as SkyPeriod | null;
    const moduleUrl = '/map/immersive-map.js';
    void Promise.all([
      import(/* @vite-ignore */ moduleUrl) as Promise<BasemapModule>,
      fetch('/api/map-config', { cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(response => response.ok ? response.json() as Promise<Record<string, unknown>> : {})
        .catch(() => ({ provider: 'esri' })),
    ]).then(([module, config]) => {
      if (removed || !mapElement.current) return;
      const runtimeConfig = config as Record<string, unknown>;
      const basemaps = module.createBasemapStyles(runtimeConfig);
      const style = (online
        ? addTerrainToSatelliteStyle(basemaps.satellite.style, basemaps.outdoor?.style)
        : structuredClone(basemaps.offline.style)) as StyleSpecification;
      if (online) style.glyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
      // Rural Esri coverage often has no native tile above z17. Let MapLibre
      // overzoom the last real image instead of exposing provider "tile not
      // available" placeholders at the low aerial ride camera.
      const imagerySource = style.sources?.base as { maxzoom?: number } | undefined;
      if (imagerySource) imagerySource.maxzoom = Number(runtimeConfig.satelliteMaxZoom ?? imagerySource.maxzoom ?? 19);
      map = new maplibregl.Map({
        container: mapElement.current,
        style,
        center: coordinates[0],
        zoom: RIDE_ZOOM,
        pitch: reducedMotion ? 78 : DEFAULT_PITCH,
        bearing: 0,
        maxPitch: 88,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      const updateSky = (distanceMetres: number) => {
        if (!map) return;
        const nextPeriod = forcedSky && forcedSky in SKY_PALETTES ? forcedSky : skyPeriodAt(distanceMetres, totalDistance);
        if (nextPeriod === activeSkyPeriod) return;
        activeSkyPeriod = nextPeriod;
        setSkyPeriod(nextPeriod);
        const from = activeSkyPalette;
        const to = SKY_PALETTES[nextPeriod];
        const started = performance.now();
        if (skyFrame !== null) cancelAnimationFrame(skyFrame);
        const animate = (now: number) => {
          if (!map || removed) return;
          const progress = easeInOutCubic(Math.min(1, (now - started) / 800));
          activeSkyPalette = {
            sky: mixHex(from.sky, to.sky, progress),
            horizon: mixHex(from.horizon, to.horizon, progress),
            fog: mixHex(from.fog, to.fog, progress),
          };
          setRideSky(map, activeSkyPalette);
          if (progress < 1) skyFrame = requestAnimationFrame(animate);
          else skyFrame = null;
        };
        skyFrame = requestAnimationFrame(animate);
      };
      const setCamera = (distanceMetres: number, bearingOffset: number, nextPitch: number) => {
        if (!map || removed) return;
        const here = coordinateAtDistance(coordinates, cumulative, distanceMetres);
        const ahead = coordinateAtDistance(coordinates, cumulative, distanceMetres + CAMERA_LOOK_AHEAD_METRES);
        const routeBearing = Math.atan2(ahead[0] - here[0], ahead[1] - here[1]) * 180 / Math.PI;
        updateSky(distanceMetres);
        map.jumpTo({ center: here, zoom: RIDE_ZOOM, pitch: nextPitch, bearing: routeBearing + bearingOffset });
        const now = performance.now();
        if (now - lastWorldUpdate > 80 || distanceMetres === 0) {
          updateRideWorld(map, world, distanceMetres, discoveredRef.current);
          lastWorldUpdate = now;
        }
      };
      controller.current = { setCamera, destroy: () => map?.remove() };
      map.on('load', () => {
        if (!map || removed) return;
        installRideWorld(map, world, hubId => openHubRef.current(hubId), !online);
        map.addSource('ride-route', { type: 'geojson', data: route });
        map.addLayer({ id: 'ride-track', type: 'line', source: 'ride-route', paint: { 'line-color': '#f4bd4f', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 14, 3.2, 18, 8], 'line-opacity': .92 } });
        if (online && map.getSource('elevation')) {
          try { map.setTerrain({ source: 'elevation', exaggeration: TERRAIN_EXAGGERATION }); } catch { /* Terrain tiles may still be arriving. */ }
        }
        setCamera(waypoints[indexRef.current]?.distanceMetres ?? 0, 0, reducedMotion ? 78 : DEFAULT_PITCH);
        setMapReady(true);
      });
    }).catch(() => {
      if (!removed) {
        setState('error');
        setMessage('Satellite context could not start. The verified route remains available in the journey overview.');
      }
    });
    return () => {
      removed = true;
      if (skyFrame !== null) cancelAnimationFrame(skyFrame);
      setMapReady(false);
      controller.current?.destroy();
      controller.current = null;
    };
  }, [hubData, online, reducedMotion, route, waypoints]);

  const processJourney = useCallback((from: number, to: number) => {
    if (!hubData || !triggerModuleRef.current) return [];
    const crossed = triggerModuleRef.current.crossingZones(from, to, hubData.triggerZones);
    if (crossed.length) {
      const next = new Set(discoveredRef.current);
      crossed.forEach(zone => next.add(zone.hubId));
      discoveredRef.current = next;
      setDiscovered([...next]);
    }
    const worcester = hubData.triggerZones.find(zone => zone.hubId === 'worcester');
    if (worcester && lookStatusRef.current === 'available') {
      const challenge = { id: 'hex-look-left', hubId: 'worcester', sEnter: Math.max(0, worcester.stationAlongMetres - 15_000), sExit: Math.max(0, worcester.stationAlongMetres - 5_000) };
      const crossedChallenge = triggerModuleRef.current.crossingZones(from, to, [challenge]).length > 0;
      if (crossedChallenge && lookRef.current.bearing >= -150 && lookRef.current.bearing <= -30) {
        lookStatusRef.current = 'earned'; setLookStatus('earned');
      } else if (from <= challenge.sExit && to >= challenge.sExit) {
        lookStatusRef.current = 'missed'; setLookStatus('missed');
      }
    }
    controller.current?.setCamera(to, lookRef.current.bearing, lookRef.current.pitch);
    return crossed.map(zone => zone.hubId);
  }, [hubData]);

  const travelTo = useCallback((target: number, duration = 1_400) => {
    if (!controller.current || !waypoints[target]) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (travelTimer.current !== null) clearTimeout(travelTimer.current);
    const from = waypoints[indexRef.current]?.distanceMetres ?? 0;
    const to = waypoints[target].distanceMetres;
    const finish = () => {
      frame.current = null;
      const crossedHubs = processJourney(from, to);
      indexRef.current = target;
      setCurrent(target);
      setMoving(false);
      const waypointHub = waypoints[target].hubIndex;
      const crossedHub = crossedHubs.at(-1);
      const hub = waypointHub ?? (crossedHub ? STOPS.findIndex(stop => stop.id === crossedHub) : -1);
      if (hub !== undefined && hub >= 0) {
        autoRef.current = false; setAuto(false); setArrival(hub); setStoryOpen(false);
      }
    };
    if (reducedMotion || duration === 0) {
      controller.current.setCamera(to, lookRef.current.bearing, lookRef.current.pitch);
      finish();
      return;
    }
    setMoving(true);
    if (Math.abs(to - from) > 20_000) {
      controller.current.setCamera(to, lookRef.current.bearing, lookRef.current.pitch);
      travelTimer.current = window.setTimeout(() => { travelTimer.current = null; finish(); }, duration);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      controller.current?.setCamera(from + (to - from) * easeInOutCubic(progress), lookRef.current.bearing, lookRef.current.pitch);
      if (progress < 1 && !document.hidden) frame.current = requestAnimationFrame(tick);
      else finish();
    };
    frame.current = requestAnimationFrame(tick);
  }, [processJourney, reducedMotion, waypoints]);

  useEffect(() => {
    if (!auto || arrival !== null || moving || !mapReady) return;
    if (current >= waypoints.length - 1) { autoRef.current = false; setAuto(false); return; }
    const stride = speed === 16 ? 100 : speed === 4 ? 8 : 1;
    travelTo(Math.min(waypoints.length - 1, current + stride), 700);
  }, [arrival, auto, current, mapReady, moving, speed, travelTo, waypoints.length]);

  useEffect(() => {
    const pause = () => {
      if (!document.hidden) return;
      autoRef.current = false;
      setAuto(false);
      setMoving(false);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (travelTimer.current !== null) clearTimeout(travelTimer.current);
      travelTimer.current = null;
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (travelTimer.current !== null) clearTimeout(travelTimer.current);
    if (holdRef.current.timer !== null) clearTimeout(holdRef.current.timer);
    soundRef.current?.destroy();
  }, []);

  useEffect(() => {
    soundRef.current?.setMotion(moving || auto, speed);
  }, [auto, moving, speed]);

  useEffect(() => {
    if (!soundEnabled) { soundedDiscoveries.current = discovered.length; return; }
    if (discovered.length > soundedDiscoveries.current) soundRef.current?.chime();
    soundedDiscoveries.current = discovered.length;
  }, [discovered.length, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled || arrival === null) return;
    const stop = STOPS[arrival];
    soundRef.current?.chime();
    const timer = window.setTimeout(() => soundRef.current?.announce(stop.name, stop.teaser), 520);
    return () => window.clearTimeout(timer);
  }, [arrival, soundEnabled]);

  const toggleSound = async () => {
    if (soundEnabled) {
      soundRef.current?.mute(); setSoundEnabled(false); return;
    }
    soundRef.current ??= new RideSoundscape();
    await soundRef.current.enable();
    soundRef.current.setMotion(moving || auto, speed);
    setSoundEnabled(true);
  };

  const setLook = (nextBearing: number, nextPitch: number) => {
    const normalizedBearing = ((nextBearing + 180) % 360 + 360) % 360 - 180;
    const limitedPitch = Math.max(60, Math.min(88, nextPitch));
    lookRef.current = { bearing: normalizedBearing, pitch: limitedPitch };
    setBearing(normalizedBearing);
    setPitch(limitedPitch);
    controller.current?.setCamera(waypoints[indexRef.current]?.distanceMetres ?? 0, normalizedBearing, limitedPitch);
  };

  const step = (direction: -1 | 1) => {
    setArrival(null);
    setStoryOpen(false);
    setAuto(false);
    autoRef.current = false;
    travelTo(Math.max(0, Math.min(waypoints.length - 1, indexRef.current + direction)));
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setArrival(null); setStoryOpen(false); setAuto(value => { autoRef.current = !value; return !value; });
      } else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') { event.preventDefault(); step(1); }
      else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') { event.preventDefault(); step(-1); }
      else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); setLook(lookRef.current.bearing - 12, lookRef.current.pitch); }
      else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); setLook(lookRef.current.bearing + 12, lookRef.current.pitch); }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  });

  const nextHubWaypoint = waypoints.findIndex((waypoint, index) => index > current && waypoint.hubIndex !== undefined);
  const nextHub = nextHubWaypoint >= 0 ? waypoints[nextHubWaypoint] : null;
  const activeStop = arrival === null ? null : STOPS[arrival];
  const distanceTravelled = waypoints[current]?.distanceMetres ?? 0;
  const matchedArrivals = new Set(waypoints.flatMap(waypoint => waypoint.hubId ? [waypoint.hubId] : [])).size;
  const collection = STOPS.map((stop, hubIndex) => {
    const waypoint = waypoints.find(item => item.hubId === stop.id);
    const found = discovered.includes(stop.id);
    const passed = !found && waypoint !== undefined && distanceTravelled > waypoint.distanceMetres + 1;
    return { stop, hubIndex, status: found ? 'discovered' : passed ? 'passed' : 'ahead' } as const;
  });
  const discoveredBillboards = (hubData?.stations.filter(item => discovered.includes(item.hubId)).length ?? 0)
    + (hubData?.attractions.filter(item => discovered.includes(item.hubId)).length ?? 0);
  const worcesterZone = hubData?.triggerZones.find(zone => zone.hubId === 'worcester');
  const challengeStart = worcesterZone ? Math.max(0, worcesterZone.stationAlongMetres - 40_000) : Infinity;
  const challengeEnd = worcesterZone ? worcesterZone.stationAlongMetres + 8_000 : -Infinity;
  const challengeVisible = distanceTravelled >= challengeStart && distanceTravelled <= challengeEnd;

  if (state !== 'ready' || !route) return <RideUnavailable loading={state === 'loading'} title={state === 'loading' ? 'Preparing the track' : 'The Ride is waiting for verified track data'} message={message} invalid={state === 'error'} />;

  return <main className="ride" data-route-state={state} data-world-ready={String(mapReady)} data-reduced-motion={String(reducedMotion)} data-camera-mode="maplibre-camera" data-sky-period={skyPeriod} data-bearing={bearing} data-pitch={pitch} data-discovered-billboards={discoveredBillboards} data-look-award={lookStatus}>
    <div
      ref={mapElement}
      className="ride-world"
      aria-label="First-person simulated camera ride along mapped rail geometry; drag to look and swipe forward to move"
      onPointerDown={event => { dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, bearing, pitch }; }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        setLook(drag.bearing + (event.clientX - drag.x) * .25, drag.pitch - (event.clientY - drag.y) * .12);
      }}
      onPointerUp={event => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag && event.pointerType === 'touch') {
          const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
          if (dy < -55 && Math.abs(dy) > Math.abs(dx)) step(1);
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
    />
    <div className="ride-atmosphere" aria-hidden="true" />

    <header className="ride-header">
      <Link to="/journey" className="ride-back"><ArrowLeft /> Route overview</Link>
      <div className="ride-header-tools">
        {!online && <span className="ride-offline-badge">Offline rail world</span>}
        <button className="ride-sound-toggle" onClick={() => void toggleSound()} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute ride sound' : 'Turn on ride sound'}>{soundEnabled ? <Volume2 /> : <VolumeX />}<span>{soundEnabled ? 'Sound on' : 'Sound off'}</span></button>
        <p className="ride-source" data-testid="ride-source">{describeRouteSource(route)} / {matchedArrivals} arrivals / {discoveredBillboards} billboards lit</p>
      </div>
    </header>

    <aside className="ride-readout" aria-live="polite">
      <span>{Math.round(distanceTravelled / 1000).toLocaleString()} km travelled</span>
      <strong>{nextHub ? `${Math.max(0, Math.round((nextHub.distanceMetres - distanceTravelled) / 1000))} km to ${STOPS[nextHub.hubIndex!].name}` : 'Final mapped arrival reached'}</strong>
      <small>Interactive rail-world simulation on mapped geometry / imagery and vector context, not footage</small>
    </aside>

    {challengeVisible && <aside className={`ride-look-challenge ${lookStatus}`} aria-live="polite">
      <span>Hex River challenge</span>
      <strong>{lookStatus === 'earned' ? 'Look-left view collected' : lookStatus === 'missed' ? 'Passed — open Worcester anyway' : 'Look left through the Hex'}</strong>
    </aside>}

    <nav className="ride-look-controls" aria-label="Look around">
      <button onClick={() => setLook(bearing - 12, pitch)} aria-label="Look left"><ChevronLeft /></button>
      <span><button onClick={() => setLook(bearing, pitch + 4)} aria-label="Look up"><ChevronUp /></button><button onClick={() => setLook(bearing, pitch - 4)} aria-label="Look down"><ChevronDown /></button></span>
      <button onClick={() => setLook(bearing + 12, pitch)} aria-label="Look right"><ChevronRight /></button>
    </nav>

    <nav className="ride-step-controls" aria-label="Ride controls">
      <button onClick={() => step(-1)} disabled={!mapReady || moving || current === 0} aria-label="Step back"><ArrowLeft /></button>
      <button
        className="ride-auto"
        onClick={() => { setArrival(null); setStoryOpen(false); setAuto(value => { autoRef.current = !value; return !value; }); }}
        disabled={!mapReady || reducedMotion || current >= waypoints.length - 1}
        aria-label={auto ? 'Pause auto ride' : 'Start auto ride'}
        title={reducedMotion ? 'Continuous motion is off because reduced motion is enabled.' : undefined}
      >{auto ? <Pause /> : <Play />}{auto ? 'Pause' : 'Auto ride'}</button>
      <button
        onPointerDown={event => {
          if (event.button !== 0 || moving || current >= waypoints.length - 1) return;
          holdRef.current.activated = false;
          holdRef.current.timer = window.setTimeout(() => {
            holdRef.current.activated = true;
            setArrival(null); setStoryOpen(false); autoRef.current = true; setAuto(true);
          }, 420);
        }}
        onPointerUp={() => {
          if (holdRef.current.timer !== null) clearTimeout(holdRef.current.timer);
          holdRef.current.timer = null;
          if (holdRef.current.activated) { autoRef.current = false; setAuto(false); } else step(1);
        }}
        onPointerCancel={() => {
          if (holdRef.current.timer !== null) clearTimeout(holdRef.current.timer);
          holdRef.current.timer = null; setAuto(false);
        }}
        onClick={event => { if (event.detail === 0) step(1); }}
        disabled={!mapReady || moving || current >= waypoints.length - 1}
        aria-label="Step forward; hold for continuous ride"
      ><ArrowRight /></button>
    </nav>

    <nav className="ride-speed" aria-label="Ride speed">
      {([1, 4, 16] as const).map(value => <button key={value} className={speed === value ? 'active' : ''} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
    </nav>

    <nav className="ride-collection" aria-label="Discovered places">
      {collection.map(({ stop, hubIndex, status }) => <button key={stop.id} className={status} onClick={() => { setArrival(hubIndex); setStoryOpen(false); autoRef.current = false; setAuto(false); }} title={status === 'discovered' ? `${stop.name} collected` : status === 'passed' ? `${stop.name}: passed — open anyway` : `${stop.name}: ahead`}>
        <span>{status === 'discovered' ? '◆' : status === 'passed' ? '◇' : '·'}</span><small>{stop.name}</small>
      </button>)}
    </nav>

    {activeStop && <div className="ride-arrival-wash" aria-hidden="true" />}
    {activeStop && <section className="ride-arrival" aria-label={`${activeStop.name} arrival`}>
      <button className="ride-arrival-close" onClick={() => setArrival(null)} aria-label="Return to the track"><X /></button>
      <div className="ride-arrival-photo"><img src={activeStop.image} alt={`${activeStop.name} place photograph`} /><span>Arrived / {Math.round(distanceTravelled / 1000)} km</span></div>
      <div className="ride-arrival-copy">
        <p className="eyebrow gold-dark">Now at</p><h1>{activeStop.name}</h1><strong>{activeStop.tagline}</strong>
        <p>{activeStop.teaser}</p>
        <button className="ride-story-toggle" onClick={() => setStoryOpen(value => !value)}><BookOpen /> {storyOpen ? 'Hide journey overview' : 'Read the journey overview'}</button>
        {storyOpen && <p className="ride-story">{activeStop.story}</p>}
      </div>
      <LocalizedScene hubId={activeStop.id} />
      <div className="ride-arrival-ai"><AiAssistant place={activeStop.name} /></div>
      <button className="ride-continue" onClick={() => step(1)}>Continue down the line <ArrowRight /></button>
    </section>}
  </main>;
}

function RideUnavailable({ title, message, loading = false, invalid = false }: { title: string; message: string; loading?: boolean; invalid?: boolean }) {
  return <main className="ride-unavailable" data-route-state={loading ? 'loading' : invalid ? 'invalid' : 'unavailable'}>
    <div>
      <Link to="/" className="brand"><span className="brand-mark">ST</span><span>Shosholoza Trail</span></Link>
      <p className="eyebrow gold">First-person route</p>
      <h1>{title}</h1><p>{message}</p>
      <p className="ride-honesty">The ride only starts when a continuous, verified rail candidate is available.</p>
      <Link className="primary-btn" to="/journey">Open the packaged route overview <ArrowRight /></Link>
    </div>
  </main>;
}
