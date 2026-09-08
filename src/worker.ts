import { handleBackend, type BackendEnv } from './backend.ts';
import { health } from './routes/health.ts';

export interface Env extends BackendEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  const mapHosts = [
    'https://tile.openstreetmap.org',
    'https://*.tile.openstreetmap.org',
    'https://*.tile.opentopomap.org',
    'https://*.tiles.maps.eox.at',
    'https://services.arcgisonline.com',
    'https://s3.amazonaws.com',
    'https://api.maptiler.com'
  ].join(' ');
  headers.set('X-Content-Type-Options', 'nosniff');
  // MapTiler's origin restrictions validate the cross-origin Referer. Send the
  // origin only, never the path or query containing journey state.
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  // MapLibre positions its canvas, controls and markers with runtime style
  // attributes. Permit those generated styles while keeping scripts self-only.
  headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${mapHosts}; connect-src 'self' ${mapHosts}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return secure(Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } }));
      }
      const response = Response.json(await health(env), { headers: { 'Cache-Control': 'no-store' } });
      return secure(request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response);
    }
    const backend = await handleBackend(request, env);
    if (backend) return secure(backend);
    if (path === '/api' || path.startsWith('/api/')) {
      return secure(Response.json({ error: 'Endpoint not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }));
    }
    // The React front door owns "/". Navigations under /app are served the
    // vanilla journey-engine shell rather than the React single-page shell.
    try {
      if (path === '/app' || path.startsWith('/app/')) {
        const shell = new URL(request.url);
        shell.pathname = '/app.html';
        return secure(await env.ASSETS.fetch(new Request(shell, request)));
      }
      return secure(await env.ASSETS.fetch(request));
    } catch {
      return secure(new Response('The application could not be loaded. Please try again.', { status: 503 }));
    }
  }
};
