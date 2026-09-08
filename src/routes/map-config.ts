import { ApiError, json, method, type BackendEnv } from '../backend.ts';

export async function mapConfig(request: Request, env: BackendEnv): Promise<Response> {
  method(request, 'GET');
  const key = env.MAPTILER_KEY?.trim();
  if (!key) return json({ provider: 'esri' });

  if (key.length > 512 || /[\u0000-\u001f\u007f]/u.test(key)) {
    throw new ApiError(503, 'Map imagery configuration is invalid. Esri imagery remains available.');
  }

  const encoded = encodeURIComponent(key);
  return json({
    provider: 'maptiler',
    streetsTiles: [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encoded}`],
    outdoorTiles: [`https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${encoded}`],
    darkTiles: [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${encoded}`],
    satelliteTiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encoded}`],
    hybridLabelTiles: [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encoded}`],
    satelliteMaxZoom: 20,
    hybridLabelOpacity: 0.35,
  });
}
