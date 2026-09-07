import { mkdir, cp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
await mkdir('public/vendor', { recursive: true });
await rm('public/vendor/leaflet', { recursive: true, force: true });
await mkdir('public/vendor/leaflet', { recursive: true });
for (const file of ['leaflet.js', 'leaflet.css']) await cp(`node_modules/leaflet/dist/${file}`, `public/vendor/leaflet/${file}`);
await cp('node_modules/leaflet/dist/images', 'public/vendor/leaflet/images', { recursive: true });
await cp('node_modules/leaflet/LICENSE', 'public/vendor/leaflet/LICENSE');
await build({ stdin: { contents: "export {nearestPointOnLine,point,distance,along,length} from '@turf/turf';", resolveDir: process.cwd() }, bundle: true, format: 'esm', minify: true, outfile: 'public/vendor/turf.js' });
await cp('node_modules/@turf/turf/LICENSE', 'public/vendor/TURF-LICENSE');
// These directories are generated copies. Clear stale harness traces/results so
// the passenger pack never absorbs the full laboratory corpus by accident.
await rm('public/data', { recursive: true, force: true });
await rm('public/results', { recursive: true, force: true });
await mkdir('public/data/traces', { recursive: true });
for (const file of ['route.geojson', 'hubs.json', 'pack.v1.json', 'sources.json']) {
  await cp(`data/${file}`, `public/data/${file}`);
}
await cp('data/traces/demo-corridor.json', 'public/data/traces/demo-corridor.json');
await mkdir('public/results', { recursive: true });
for (const file of ['r3.json', 'r10.json']) await cp(`results/${file}`, `public/results/${file}`);
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}
const assets = [];
for (const file of (await walk('public')).sort()) {
  if (file.endsWith('/pack-manifest.json') || file.endsWith('/sw.js') || file.includes('/data/traces/') && !file.includes('/demo')) continue;
  const bytes = await readFile(file);
  assets.push({ url: file.slice(6), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const hash = createHash('sha256').update(JSON.stringify(assets)).digest('hex');
await writeFile('public/pack-manifest.json', JSON.stringify({ version: 1, hash, bytes: assets.reduce((n, a) => n + a.bytes, 0), assets }, null, 2));
console.log(`Pack manifest: ${assets.length} files, ${assets.reduce((n, a) => n + a.bytes, 0)} bytes, SHA-256 ${hash}`);
