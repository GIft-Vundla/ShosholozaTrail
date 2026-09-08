import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleBackend, hash, type BackendEnv, type Database, type Statement } from '../src/backend.ts';
import { ai, reserveAiBudget } from '../src/routes/ai.ts';
import worker from '../src/worker.ts';

// Real SQLite executes the migration and production SQL; D1 deployment and
// real-device/service acceptance remain separate, unrun evidence requirements.
function setup() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../migrations/0001.sql', import.meta.url), 'utf8'));
  class Query implements Statement {
    sql: string; values: unknown[] = [];
    constructor(sql: string) { this.sql = sql; }
    bind(...values: unknown[]) { this.values = values; return this; }
    async first<T>() { return (sqlite.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null; }
    async all<T>() { return { results: sqlite.prepare(this.sql).all(...this.values as never[]) as T[] }; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.values as never[]); return { meta: { changes: Number(result.changes) } }; }
  }
  const db: Database = { prepare: sql => new Query(sql), batch: async statements => { sqlite.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } };
  const env: BackendEnv = { DB: db, MODERATOR_TOKEN: 'm'.repeat(48) };
  const request = (path: string, data?: unknown, token?: string, headers: Record<string, string> = {}) => new Request(`https://trail.example${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const call = async (path: string, data?: unknown, token?: string, headers?: Record<string, string>) => { const response = (await handleBackend(request(path, data, token, headers), env))!; return { status: response.status, data: await response.json() as any, headers: response.headers }; };
  const room = async () => (await call('/api/rooms/create', {})).data as { token: string; code: string; expiresAt: number };
  return { sqlite, env, request, call, room };
}

test('tokens and codes are hashed; joining needs the code and all reads need an unexpired token', async () => {
  const { sqlite, room, call } = setup(); const a = await room();
  assert.equal(a.code.length, 24); assert.equal(a.token.length, 64);
  assert.equal(sqlite.prepare('SELECT code_hash FROM rooms').get()!.code_hash, await hash(a.code));
  assert.equal(sqlite.prepare('SELECT token_hash FROM sessions').get()!.token_hash, await hash(a.token));
  assert.equal((await call(`/api/rooms/messages?code=${a.code}`)).status, 401);
  assert.equal((await call('/api/rooms/join', { code: a.code })).status, 201);
  sqlite.exec('UPDATE sessions SET expires_at = 0');
  assert.equal((await call('/api/rooms/messages', undefined, a.token)).status, 401);
});

test('D1 SQL isolates rooms, preserves retry idempotency and reports conflicting edits', async () => {
  const { room, call } = setup(); const a = await room(); const b = await room();
  const message = { text: '<script>alert(1)</script> is plain text', requestId: 'request-0000000001' };
  const saved = await call('/api/rooms/messages', message, a.token); assert.equal(saved.status, 201);
  const retried = await call('/api/rooms/messages', message, a.token); assert.equal(retried.data.message.id, saved.data.message.id);
  assert.equal((await call('/api/rooms/messages', { ...message, text: 'changed' }, a.token)).status, 409);
  assert.equal((await call(`/api/rooms/messages?roomId=${a.code}`, undefined, b.token)).data.messages.length, 0);
  assert.equal((await call('/api/rooms/messages', undefined, a.token)).data.messages.length, 1);
  const joined = await call('/api/rooms/join', { code: a.code });
  assert.equal((await call('/api/rooms/messages', undefined, joined.data.token)).data.messages.length, 1);
  assert.equal((await call('/api/rooms/leave', {}, a.token)).status, 200);
  assert.equal((await call('/api/rooms/messages', undefined, a.token)).status, 401);
  assert.equal((await call('/api/rooms/messages', undefined, joined.data.token)).data.messages.length, 0);
});

test('origin, schemas, invalid sessions and SQL-shaped code fail closed', async () => {
  const { call, room } = setup(); const a = await room();
  assert.equal((await call('/api/rooms/create', {}, undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/api/rooms/create', { roomId: 'override' })).status, 400);
  assert.equal((await call('/api/rooms/join', { code: "' OR 1=1 --" })).status, 400);
  assert.equal((await call('/api/rooms/messages', undefined, 'x'.repeat(64))).status, 401);
  assert.equal((await call('/api/rooms/messages', { text: 'x'.repeat(2001), requestId: 'request-0000000001' }, a.token)).status, 400);
  assert.equal((await call('/api/rooms/create', {}, undefined, { 'Content-Type': 'text/plain' })).status, 415);
});

test('unreviewed submissions stay private; moderator verifies rights and publishes a versioned approved supplement', async () => {
  const { env, room, call } = setup(); const a = await room();
  const submitted = await call('/api/contributions', { title: 'A reviewed story', text: 'A test submission, not historical evidence.', sourceUrl: 'https://example.org/source', credit: 'Test author' }, a.token);
  assert.equal(submitted.status, 201);
  assert.equal((await call('/api/packs/community')).data.chapters.length, 0);
  assert.equal((await call('/api/moderation', undefined, a.token)).status, 403);
  const review = { id: submitted.data.id, decision: 'approve', reviewNote: 'Test reviewer verified the source and permission.' };
  assert.equal((await call('/api/moderation/review', review, env.MODERATOR_TOKEN)).status, 400);
  assert.equal((await call('/api/moderation/review', { ...review, rightsConfirmed: true }, env.MODERATOR_TOKEN)).status, 200);
  assert.equal((await call('/api/packs/community')).data.chapters.length, 0);
  const pack = await call('/api/moderation/publish', {}, env.MODERATOR_TOKEN);
  assert.equal(pack.status, 201); assert.equal(pack.data.version, 2); assert.equal(pack.data.chapters.length, 1); assert.equal(pack.data.sources[0].id, pack.data.chapters[0].sourceIds[0]);
  assert.equal((await call('/api/moderation/publish', {}, env.MODERATOR_TOKEN)).data.version, 3);
  assert.equal((await call('/api/packs/community')).data.chapters.length, 1);
});

test('per-session and global AI budgets are enforced by SQL and persist across reservations', async () => {
  const { env, sqlite } = setup();
  for (let i = 0; i < 10; i++) await reserveAiBudget(env, 'session-a');
  await assert.rejects(() => reserveAiBudget(env, 'session-a'), /limit reached/);
  const bucket = Math.floor(Date.now() / 86400000);
  sqlite.prepare('UPDATE rate_limits SET used = 100 WHERE scope = ? AND bucket = ?').run('ai:global', bucket);
  await assert.rejects(() => reserveAiBudget(env, 'session-b'), /limit reached/);
  assert.equal(sqlite.prepare("SELECT used FROM rate_limits WHERE scope = 'ai:global'").get()!.used, 100);
});

async function aiSetup() {
  const setupResult = setup(); const { env, room, request } = setupResult; const member = await room();
  env.AI_ENABLED = 'true'; env.AI_VALIDATED = 'true'; env.AI_PROVIDER = 'gemini'; env.GEMINI_API_KEY = 'test-placeholder'; env.GEMINI_MODEL = 'test-model';
  const passage = 'This is a synthetic source passage for a software test only.';
  env.ASSETS = { fetch: async () => Response.json({ records: [{ id: 'test-source', passage, reviewStatus: 'human-reviewed' }] }) };
  return { ...setupResult, passage, aiRequest: () => request('/api/ai', { action: 'explain', question: 'What does the source say?' }, member.token) };
}
const providerPayload = (answer: string, sourceIds: string[]) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer, sourceIds }) }] } }] });

test('optional provider returns only exact reviewed excerpts and valid citations', async () => {
  const { aiRequest, env, passage } = await aiSetup();
  const response = await ai(aiRequest(), env, async () => providerPayload(passage, ['test-source']));
  const result = await response.json() as any; assert.equal(result.status, 'source-excerpt'); assert.equal(result.answer, passage);
});

test('fabricated citations and invented factual prose trigger fallback', async () => {
  const { aiRequest, env, passage } = await aiSetup();
  for (const payload of [providerPayload(passage, ['invented-source']), providerPayload('Invented historical statement.', ['test-source'])]) {
    const response = await ai(aiRequest(), env, async () => payload); assert.equal((await response.json() as any).status, 'fallback');
  }
});

test('429, malformed output, provider outage and timeout fail safely; three failures open circuit', async () => {
  for (const kind of ['429', 'malformed', 'outage', 'timeout']) {
    const { aiRequest, env } = await aiSetup();
    const upstream: typeof fetch = async () => { if (kind === '429') return new Response('', { status: 429 }); if (kind === 'malformed') return new Response('bad-json'); if (kind === 'outage') throw new Error('offline'); return await new Promise<Response>(() => {}); };
    const response = await ai(aiRequest(), env, upstream, 5); assert.equal((await response.json() as any).status, 'fallback', kind);
  }
  const { aiRequest, env } = await aiSetup(); let calls = 0;
  const fail: typeof fetch = async () => { calls++; return new Response('', { status: 503 }); };
  for (let i = 0; i < 4; i++) await ai(aiRequest(), env, fail);
  assert.equal(calls, 3);
});

test('AI config alone cannot bypass grounding gate; unreviewed sources never reach provider', async () => {
  const { aiRequest, env } = await aiSetup(); let calls = 0; const upstream: typeof fetch = async () => { calls++; throw new Error('should not call'); };
  env.AI_VALIDATED = 'false'; assert.equal((await (await ai(aiRequest(), env, upstream)).json() as any).enabled, false);
  env.AI_VALIDATED = 'true'; env.ASSETS = { fetch: async () => Response.json({ records: [{ id: 'pending', passage: 'Not reviewed', reviewStatus: 'human-review-pending' }] }) };
  assert.equal((await (await ai(aiRequest(), env, upstream)).json() as any).reason, 'no-eligible-source-passages'); assert.equal(calls, 0);
});

test('experimental Workers AI serves source-locked editorial drafts to a quota-limited guest', async () => {
  const { env, request } = setup();
  const passage = 'Freedom Park is in Salvokop, Pretoria.';
  let calls = 0; let providerInput: Record<string, unknown> | undefined;
  env.AI_ENABLED = 'true'; env.AI_VALIDATED = 'false'; env.AI_EXPERIMENTAL = 'true';
  env.AI_PROVIDER = 'workers-ai'; env.AI_MODEL = '@cf/zai-org/glm-4.7-flash';
  env.AI = { run: async (model, input) => {
    calls++; providerInput = input;
    assert.equal(model, env.AI_MODEL);
    return { choices: [{ message: { content: JSON.stringify({ answer: passage, sourceIds: ['freedom-park'] }) } }] };
  } };
  env.ASSETS = { fetch: async () => Response.json({ records: [{ id: 'freedom-park', passage, reviewStatus: 'automated-source-review; human-review-pending' }] }) };
  const aiRequest = () => request('/api/ai', { action: 'explain', question: 'Where is Freedom Park?' }, undefined, { 'CF-Connecting-IP': '192.0.2.25' });
  const first = await ai(aiRequest(), env); const result = await first.json() as any;
  assert.equal(result.status, 'source-excerpt');
  assert.equal(result.answer, passage);
  assert.equal(result.sourceReview, 'editorial-draft-human-review-pending');
  assert.equal(result.mode, 'experimental-source-locked');
  assert.equal(result.quotaIdentity, 'guest');
  assert.equal((providerInput?.response_format as any).type, 'json_schema');
  assert.equal((providerInput?.response_format as any).json_schema.name, 'source_excerpt');
  assert.equal((providerInput?.response_format as any).json_schema.strict, true);
  for (let i = 1; i < 5; i++) assert.equal((await (await ai(aiRequest(), env)).json() as any).status, 'source-excerpt');
  assert.equal((await (await ai(aiRequest(), env)).json() as any).reason, 'daily-assistance-budget-reached');
  assert.equal(calls, 5);
});

test('Workers AI output still rejects invented prose and citations', async () => {
  const { env, request } = setup();
  const passage = 'A source passage that must be returned exactly.';
  env.AI_ENABLED = 'true'; env.AI_EXPERIMENTAL = 'true'; env.AI_PROVIDER = 'workers-ai';
  env.AI = { run: async () => ({ response: { answer: 'Invented answer.', sourceIds: ['made-up'] } }) };
  env.ASSETS = { fetch: async () => Response.json({ records: [{ id: 'source-1', passage, reviewStatus: 'automated-source-review; human-review-pending' }] }) };
  const response = await ai(request('/api/ai', { action: 'explain', question: 'Invent something' }, undefined, { 'CF-Connecting-IP': '192.0.2.26' }), env);
  assert.equal((await response.json() as any).reason, 'provider-failed-or-output-not-grounded');
});

test('Worker dispatches implemented APIs and adds security headers', async () => {
  const { env } = setup();
  const workerEnv = { ...env, ASSETS: { fetch: async () => new Response('asset') } };
  const response = await worker.fetch(new Request('https://trail.example/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }), workerEnv);
  const result = await response.json() as any;
  assert.equal(response.status, 201);
  assert.equal(result.code.length, 24);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.match(response.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  assert.match(response.headers.get('Content-Security-Policy') || '', /worker-src 'self' blob:/);
});

test('Worker health and route matching report configuration without false provider claims', async () => {
  const { env } = setup();
  const workerEnv = { ...env, AI_ENABLED: 'true', AI_VALIDATED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'configured-secret', GEMINI_MODEL: 'test-model', ASSETS: { fetch: async () => new Response('asset') } };
  const response = await worker.fetch(new Request('https://trail.example/api/health'), workerEnv);
  const result = await response.json() as any;
  assert.equal(result.readiness, 'working-towards-trl5');
  assert.equal(result.ai.enabled, true);
  assert.equal(result.ai.providerStatus, 'configured-not-probed');
  assert.equal(result.database.status, 'available');
  assert.equal(JSON.stringify(result).includes('configured-secret'), false);
  assert.equal((await worker.fetch(new Request('https://trail.example/api/aix'), workerEnv)).status, 404);
  assert.equal((await worker.fetch(new Request('https://trail.example/api/contributions-extra'), workerEnv)).status, 404);
});

test('health identifies configured Workers AI experimental mode without probing it', async () => {
  const { env } = setup(); let calls = 0;
  const workerEnv = {
    ...env,
    AI_ENABLED: 'true', AI_VALIDATED: 'false', AI_EXPERIMENTAL: 'true', AI_PROVIDER: 'workers-ai',
    AI_MODEL: '@cf/zai-org/glm-4.7-flash',
    AI: { run: async () => { calls++; return {}; } },
    ASSETS: { fetch: async () => new Response('asset') }
  };
  const response = await worker.fetch(new Request('https://trail.example/api/health'), workerEnv);
  const result = await response.json() as any;
  assert.equal(result.ai.enabled, true);
  assert.equal(result.ai.provider, 'workers-ai');
  assert.equal(result.ai.mode, 'experimental-source-locked');
  assert.equal(result.ai.providerStatus, 'configured-not-probed');
  assert.equal(calls, 0);
});
