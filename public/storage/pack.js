const META = 'trail-pack-metadata';
const POINTER = '/__active_pack__';
export async function packStatus() {
  const response = await (await caches.open(META)).match(POINTER);
  return response ? response.json() : null;
}
async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function install({ failAfter = Infinity, onProgress = () => {} } = {}) {
  const response = await fetch('/pack-manifest.json', { cache: 'no-store', headers: { 'X-Pack-Install': '1' } });
  if (!response.ok) throw new Error('Pack manifest unavailable. Your previous pack is safe.');
  const manifest = await response.json();
  if (!Array.isArray(manifest.assets) || await sha256(new TextEncoder().encode(JSON.stringify(manifest.assets))) !== manifest.hash) throw new Error('Pack manifest integrity check failed.');
  const name = `trail-pack-${manifest.hash}-${crypto.randomUUID()}`;
  const cache = await caches.open(name);
  let installed = 0;
  try {
    for (const asset of manifest.assets) {
      if (!asset.url.startsWith('/') || asset.url.startsWith('//') || asset.url.startsWith('/api/')) throw new Error('Invalid pack asset');
      if (installed >= failAfter) throw new DOMException('Simulated storage failure. Last complete pack and drafts preserved.', 'QuotaExceededError');
      const file = await fetch(asset.url, { cache: 'no-store', headers: { 'X-Pack-Install': '1' } });
      if (!file.ok) throw new Error(`Download failed: ${asset.url}. Retry when connected.`);
      const bytes = await file.clone().arrayBuffer();
      if (bytes.byteLength !== asset.bytes || await sha256(bytes) !== asset.sha256) throw new Error(`Integrity check failed: ${asset.url}`);
      await cache.put(asset.url, file);
      installed += bytes.byteLength;
      onProgress(installed, manifest.bytes);
    }
    if (installed !== manifest.bytes) throw new Error('Pack size mismatch');
    const status = { hash: manifest.hash, cacheName: name, installedBytes: installed, expectedBytes: manifest.bytes, installedAt: new Date().toISOString(), files: manifest.assets.length };
    // Only this final atomic cache.put changes what readers consider ready.
    await (await caches.open(META)).put(POINTER, Response.json(status));
    return status;
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
}
export function installPack(options) {
  return navigator.locks ? navigator.locks.request('trail-pack-install', () => install(options)) : install(options);
}
