import { handleBackend, type BackendEnv } from './backend.ts';
import { health } from './routes/health.ts';

export interface Env extends BackendEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
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
    try {
      return secure(await env.ASSETS.fetch(request));
    } catch {
      return secure(new Response('The application could not be loaded. Please try again.', { status: 503 }));
    }
  }
};
