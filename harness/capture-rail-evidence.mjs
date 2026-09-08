import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const route = JSON.parse(await readFile(path.join(root, 'data/route.geojson'), 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
html,body,#map{height:100%;margin:0}body{background:#111a29;font-family:Arial,sans-serif}
.proof{position:fixed;z-index:5;left:24px;top:24px;max-width:430px;color:#111a29;background:rgba(248,242,232,.94);padding:18px 22px;border-left:6px solid #f4bd4f;box-shadow:0 12px 38px #0008}
.proof strong{font-size:22px}.proof p{margin:7px 0 0;line-height:1.4}.maplibregl-ctrl-attrib{font-size:12px}
</style></head><body><div id="map"></div><div class="proof"><strong>Hex River rail geometry</strong><p>OSM-mapped railway candidate in gold over Esri World Imagery. Curves are source geometry, not an interpolated line.</p></div></body></html>`);
await page.addStyleTag({ path: path.join(root, 'public/vendor/maplibre-gl/maplibre-gl.css') });
await page.addScriptTag({ path: path.join(root, 'public/vendor/maplibre-gl/maplibre-gl.js') });
await page.evaluate(routeData => new Promise((resolve, reject) => {
  const map = new maplibregl.Map({
    container: 'map', center: [19.66, -33.55], zoom: 10.8, bearing: -22, pitch: 42,
    attributionControl: true,
    style: { version: 8, sources: {
      imagery: { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19,
        attribution: 'Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
      route: { type: 'geojson', data: routeData }
    }, layers: [
      { id: 'imagery', type: 'raster', source: 'imagery' },
      { id: 'route-shadow', type: 'line', source: 'route', paint: { 'line-color': '#111a29', 'line-width': 8, 'line-opacity': .8 } },
      { id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#f4bd4f', 'line-width': 4 } }
    ] }
  });
  map.on('load', () => { window.__map = map; setTimeout(resolve, 5000); });
  map.on('error', event => { if (!String(event?.error || '').includes('AbortError')) reject(event.error); });
}), route);
await page.screenshot({ path: path.join(root, 'evidence/rail-alignment-hexriver.png') });
await browser.close();
if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
console.log('Wrote evidence/rail-alignment-hexriver.png');
