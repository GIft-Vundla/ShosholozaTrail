import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play, X } from 'lucide-react';
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

type RideMapController = {
  setCamera(distanceMetres: number, bearingOffset: number, pitch: number): void;
  destroy(): void;
};
type FreeCameraLike = {
  position: unknown;
  lookAtPoint(point: { lng: number; lat: number }): void;
  setPitchBearing(pitch: number, bearing: number): void;
};
type RideMap = MapType & {
  getFreeCameraOptions?: () => FreeCameraLike;
  setFreeCameraOptions?: (options: FreeCameraLike) => void;
};
type BasemapModule = {
  createBasemapStyles(config?: Record<string, unknown>): Record<string, { style: StyleSpecification }>;
};

const CAMERA_LOOK_AHEAD_METRES = 400;
const CAMERA_HEIGHT_METRES = 110;
const DEFAULT_PITCH = 76;

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
  const cameraModeRef = useRef<'free-camera' | 'maplibre-camera'>('maplibre-camera');
  const frame = useRef<number | null>(null);
  const indexRef = useRef(0);
  const lookRef = useRef({ bearing: 0, pitch: DEFAULT_PITCH });
  const dragRef = useRef<{ id: number; x: number; y: number; bearing: number; pitch: number } | null>(null);
  const holdRef = useRef<{ timer: number | null; activated: boolean }>({ timer: null, activated: false });
  const [route, setRoute] = useState<RideRoute | null>(null);
  const [waypoints, setWaypoints] = useState<RideWaypoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [message, setMessage] = useState('Loading verified rail geometry...');
  const [mapReady, setMapReady] = useState(false);
  const [cameraMode, setCameraMode] = useState<'free-camera' | 'maplibre-camera'>('maplibre-camera');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(false);
  const [moving, setMoving] = useState(false);
  const [arrival, setArrival] = useState<number | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void fetch('/data/route-ride.geojson', { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('route-data-missing');
        return response.json();
      })
      .then(value => {
        const nextRoute = readRideRoute(value);
        const nextWaypoints = buildRideWaypoints(nextRoute, STOPS);
        if (nextWaypoints.length < 2) throw new Error('The ride route does not have enough distance to navigate.');
        const requestedHub = new URLSearchParams(window.location.search).get('hub');
        const requestedIndex = requestedHub ? nextWaypoints.findIndex(waypoint => waypoint.hubId === requestedHub) : -1;
        const startIndex = requestedIndex >= 0 ? requestedIndex : 0;
        indexRef.current = startIndex;
        setRoute(nextRoute);
        setWaypoints(nextWaypoints);
        setCurrent(startIndex);
        setState('ready');
        setMessage('');
        if (nextWaypoints[startIndex].hubIndex !== undefined) setArrival(nextWaypoints[startIndex].hubIndex);
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
    if (!route || !mapElement.current || !online) return;
    let removed = false;
    let map: RideMap | null = null;
    const coordinates = route.geometry.coordinates;
    const cumulative = cumulativeDistances(coordinates);
    const moduleUrl = '/map/immersive-map.js';
    void Promise.all([
      import(/* @vite-ignore */ moduleUrl) as Promise<BasemapModule>,
      fetch('/api/map-config', { cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(response => response.ok ? response.json() as Promise<Record<string, unknown>> : {})
        .catch(() => ({ provider: 'esri' })),
    ]).then(([module, config]) => {
      if (removed || !mapElement.current) return;
      const basemaps = module.createBasemapStyles(config);
      const style = addTerrainToSatelliteStyle(basemaps.satellite.style, basemaps.outdoor?.style) as StyleSpecification;
      // Rural Esri coverage often has no native tile above z17. Let MapLibre
      // overzoom the last real image instead of exposing provider "tile not
      // available" placeholders at the low aerial ride camera.
      const imagerySource = style.sources?.base as { maxzoom?: number } | undefined;
      if (imagerySource) imagerySource.maxzoom = Math.min(imagerySource.maxzoom ?? 17, 17);
      map = new maplibregl.Map({
        container: mapElement.current,
        style,
        center: coordinates[0],
        zoom: 17,
        pitch: reducedMotion ? 72 : 82,
        bearing: 0,
        maxPitch: 88,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      const setCamera = (distanceMetres: number, bearingOffset: number, nextPitch: number) => {
        if (!map || removed || !map.isStyleLoaded()) return;
        const here = coordinateAtDistance(coordinates, cumulative, distanceMetres);
        const ahead = coordinateAtDistance(coordinates, cumulative, distanceMetres + CAMERA_LOOK_AHEAD_METRES);
        const sampledElevation = map.queryTerrainElevation({ lng: here[0], lat: here[1] });
        const routeBearing = Math.atan2(ahead[0] - here[0], ahead[1] - here[1]) * 180 / Math.PI;
        if (map.getFreeCameraOptions && map.setFreeCameraOptions && Number.isFinite(sampledElevation)) {
          if (cameraModeRef.current !== 'free-camera') { cameraModeRef.current = 'free-camera'; setCameraMode('free-camera'); }
          const camera = map.getFreeCameraOptions();
          camera.position = maplibregl.MercatorCoordinate.fromLngLat({ lng: here[0], lat: here[1] }, Number(sampledElevation) + CAMERA_HEIGHT_METRES);
          camera.lookAtPoint({ lng: ahead[0], lat: ahead[1] });
          camera.setPitchBearing(nextPitch, routeBearing + bearingOffset);
          map.setFreeCameraOptions(camera);
        } else {
          if (cameraModeRef.current !== 'maplibre-camera') { cameraModeRef.current = 'maplibre-camera'; setCameraMode('maplibre-camera'); }
          map.jumpTo({ center: here, zoom: 17.5, pitch: nextPitch, bearing: routeBearing + bearingOffset });
        }
      };
      controller.current = { setCamera, destroy: () => map?.remove() };
      map.on('load', () => {
        if (!map || removed) return;
        map.addSource('ride-route', { type: 'geojson', data: route });
        map.addLayer({ id: 'ride-track', type: 'line', source: 'ride-route', paint: { 'line-color': '#f4bd4f', 'line-width': 2.5, 'line-opacity': .82 } });
        if (map.getSource('elevation')) {
          try { map.setTerrain({ source: 'elevation', exaggeration: 1.15 }); } catch { /* Terrain tiles may still be arriving. */ }
        }
        setCamera(waypoints[indexRef.current]?.distanceMetres ?? 0, 0, reducedMotion ? 68 : DEFAULT_PITCH);
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
      setMapReady(false);
      controller.current?.destroy();
      controller.current = null;
    };
  }, [online, reducedMotion, route, waypoints]);

  const travelTo = useCallback((target: number, duration = 1_400) => {
    if (!controller.current || !waypoints[target]) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = waypoints[indexRef.current]?.distanceMetres ?? 0;
    const to = waypoints[target].distanceMetres;
    const finish = () => {
      frame.current = null;
      indexRef.current = target;
      setCurrent(target);
      setMoving(false);
      const hub = waypoints[target].hubIndex;
      if (hub !== undefined) { setArrival(hub); setAuto(false); }
    };
    if (reducedMotion || duration === 0) {
      controller.current.setCamera(to, lookRef.current.bearing, lookRef.current.pitch);
      finish();
      return;
    }
    setMoving(true);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      controller.current?.setCamera(from + (to - from) * easeInOutCubic(progress), lookRef.current.bearing, lookRef.current.pitch);
      if (progress < 1 && !document.hidden) frame.current = requestAnimationFrame(tick);
      else finish();
    };
    frame.current = requestAnimationFrame(tick);
  }, [reducedMotion, waypoints]);

  useEffect(() => {
    if (!auto || arrival !== null || moving || !mapReady) return;
    if (current >= waypoints.length - 1) { setAuto(false); return; }
    travelTo(current + 1, 333);
  }, [arrival, auto, current, mapReady, moving, travelTo, waypoints.length]);

  useEffect(() => {
    const pause = () => {
      if (!document.hidden) return;
      setAuto(false);
      setMoving(false);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

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
    travelTo(Math.max(0, Math.min(waypoints.length - 1, indexRef.current + direction)));
  };

  const nextHubWaypoint = waypoints.findIndex((waypoint, index) => index > current && waypoint.hubIndex !== undefined);
  const nextHub = nextHubWaypoint >= 0 ? waypoints[nextHubWaypoint] : null;
  const activeStop = arrival === null ? null : STOPS[arrival];
  const distanceTravelled = waypoints[current]?.distanceMetres ?? 0;
  const matchedArrivals = new Set(waypoints.flatMap(waypoint => waypoint.hubId ? [waypoint.hubId] : [])).size;

  if (!online) return <RideUnavailable title="The Ride needs a signal" message="Satellite imagery and terrain are online data. Reconnect to enter the ride, or use the packaged journey overview now." />;
  if (state !== 'ready' || !route) return <RideUnavailable loading={state === 'loading'} title={state === 'loading' ? 'Preparing the track' : 'The Ride is waiting for verified track data'} message={message} invalid={state === 'error'} />;

  return <main className="ride" data-route-state={state} data-reduced-motion={String(reducedMotion)} data-camera-mode={cameraMode} data-bearing={bearing} data-pitch={pitch}>
    <div ref={mapElement} className="ride-world" aria-label="First-person simulated camera ride along mapped rail geometry" />
    <div className="ride-atmosphere" aria-hidden="true" />
    <div
      className="ride-look-surface"
      aria-label="Drag to look around"
      onPointerDown={event => {
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, bearing, pitch };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        setLook(drag.bearing + (event.clientX - drag.x) * .25, drag.pitch - (event.clientY - drag.y) * .12);
      }}
      onPointerUp={() => { dragRef.current = null; }}
    />

    <header className="ride-header">
      <Link to="/journey" className="ride-back"><ArrowLeft /> Route overview</Link>
      <p className="ride-source" data-testid="ride-source">{describeRouteSource(route)} / {matchedArrivals} of {STOPS.length} arrivals matched within 10 km</p>
    </header>

    <aside className="ride-readout" aria-live="polite">
      <span>{Math.round(distanceTravelled / 1000).toLocaleString()} km travelled</span>
      <strong>{nextHub ? `${Math.max(0, Math.round((nextHub.distanceMetres - distanceTravelled) / 1000))} km to ${STOPS[nextHub.hubIndex!].name}` : 'Final mapped arrival reached'}</strong>
      <small>Low aerial simulated camera following mapped rail geometry / satellite, not footage</small>
    </aside>

    <nav className="ride-look-controls" aria-label="Look around">
      <button onClick={() => setLook(bearing - 12, pitch)} aria-label="Look left"><ChevronLeft /></button>
      <span><button onClick={() => setLook(bearing, pitch + 4)} aria-label="Look up"><ChevronUp /></button><button onClick={() => setLook(bearing, pitch - 4)} aria-label="Look down"><ChevronDown /></button></span>
      <button onClick={() => setLook(bearing + 12, pitch)} aria-label="Look right"><ChevronRight /></button>
    </nav>

    <nav className="ride-step-controls" aria-label="Ride controls">
      <button onClick={() => step(-1)} disabled={!mapReady || moving || current === 0} aria-label="Step back"><ArrowLeft /></button>
      <button
        className="ride-auto"
        onClick={() => { setArrival(null); setStoryOpen(false); setAuto(value => !value); }}
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
            setArrival(null); setStoryOpen(false); setAuto(true);
          }, 420);
        }}
        onPointerUp={() => {
          if (holdRef.current.timer !== null) clearTimeout(holdRef.current.timer);
          holdRef.current.timer = null;
          if (holdRef.current.activated) setAuto(false); else step(1);
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
