self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/') || request.headers.has('X-Pack-Install') || url.pathname === '/pack-manifest.json') return;
  event.respondWith((async () => {
    const pointer = await (await caches.open('trail-pack-metadata')).match('/__active_pack__');
    if (pointer) {
      const { cacheName } = await pointer.json();
      const cache = await caches.open(cacheName);
      // Navigations resolve to whichever shell owns the path: the React
      // front door, or the journey engine mounted under /app.
      const engineShell = url.pathname === '/app' || url.pathname.startsWith('/app/');
      const path = request.mode === 'navigate' ? (engineShell ? '/app.html' : '/index.html') : url.pathname;
      const cached = await cache.match(path);
      if (cached) return cached;
    }
    return fetch(request);
  })());
});
