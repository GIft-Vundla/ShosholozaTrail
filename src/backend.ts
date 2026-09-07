import { rooms, authenticate } from './routes/rooms.ts';
import { contributions } from './routes/contrib.ts';
import { ai } from './routes/ai.ts';

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes?: number } }>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
export interface BackendEnv {
  DB?: Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  MODERATOR_TOKEN?: string;
  AI_ENABLED?: string;
  AI_VALIDATED?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function database(env: BackendEnv): Database {
  if (!env.DB) throw new ApiError(503, 'Database is not configured. Cached journey features remain available.');
  return env.DB;
}
export function method(request: Request, allowed: string): void {
  if (request.method !== allowed) throw new ApiError(405, 'Method not allowed');
}
export async function body(request: Request, keys: string[]): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new ApiError(415, 'Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'JSON body required');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 16384) { await reader.cancel(); throw new ApiError(413, 'Request is too large'); } chunks.push(chunk.value); }
  let parsed: unknown;
  try { const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(400, 'Invalid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some(key => !keys.includes(key))) throw new ApiError(400, 'Unexpected request fields');
  return parsed as Record<string, unknown>;
}
export function field(value: unknown, name: string, max: number, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw new ApiError(400, `Invalid ${name}`);
  return value.trim();
}
export async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function randomToken(bytes = 32): string { return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join(''); }
export function bearer(request: Request): string {
  const value = request.headers.get('Authorization');
  if (!value || !/^Bearer [a-zA-Z0-9_-]{32,256}$/.test(value)) throw new ApiError(401, 'A valid session is required');
  return value.slice(7);
}
// One atomic SQLite statement increments only while below the limit. Global and
// session reservations may be conservative on denial, but cannot overspend.
export async function quota(db: Database, scope: string, limit: number, windowSeconds = 60): Promise<void> {
  const now = Math.floor(Date.now() / 1000); const bucket = Math.floor(now / windowSeconds);
  const result = await db.prepare('INSERT INTO rate_limits (scope, bucket, used) VALUES (?, ?, 1) ON CONFLICT(scope, bucket) DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used').bind(scope, bucket, limit).first();
  if (!result) throw new ApiError(429, 'Request limit reached. Please try again later.');
}
export async function handleBackend(request: Request, env: BackendEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const isBackendRoute = path.startsWith('/api/rooms/')
    || path === '/api/contributions'
    || path === '/api/moderation'
    || path.startsWith('/api/moderation/')
    || path === '/api/packs/community'
    || path === '/api/ai';
  if (!isBackendRoute) return null;
  try {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'Origin is not allowed');
    if (path === '/api/ai') return await ai(request, env);
    const db = database(env);
    if (request.method !== 'GET') {
      // CF-Connecting-IP is supplied by Cloudflare, never a client body field.
      const ip = request.headers.get('CF-Connecting-IP') || 'local-unidentified';
      await quota(db, `ip:${await hash(ip)}`, 60);
    }
    if (path.startsWith('/api/rooms/')) return await rooms(request, env);
    return await contributions(request, env, authenticate);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: 'Service unavailable. Your cached journey and saved drafts remain available.' }, 503);
  }
}
