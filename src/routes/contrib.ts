import { ApiError, bearer, body, database, field, hash, json, method, quota, type BackendEnv } from '../backend.ts';
import type { Session } from './rooms.ts';

async function moderator(request: Request, env: BackendEnv): Promise<void> {
  if (!env.MODERATOR_TOKEN || env.MODERATOR_TOKEN.length < 32) throw new ApiError(503, 'Moderation is not configured');
  // Compare fixed-length digests without early-exit character comparison.
  const expected = await hash(env.MODERATOR_TOKEN); const actual = await hash(bearer(request)); let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  if (difference !== 0) throw new ApiError(403, 'Moderator role required');
}
export async function contributions(request: Request, env: BackendEnv, authenticate: (request: Request, env: BackendEnv) => Promise<Session>): Promise<Response> {
  const db = database(env); const path = new URL(request.url).pathname;
  if (path === '/api/contributions') {
    method(request, 'POST'); const session = await authenticate(request, env); await quota(db, `contribution:${session.token_hash}`, 5, 3600);
    const data = await body(request, ['title', 'text', 'sourceUrl', 'credit']);
    const title = field(data.title, 'title', 160); const text = field(data.text, 'text', 8000); const credit = field(data.credit, 'credit', 160); const sourceUrl = field(data.sourceUrl, 'sourceUrl', 2000);
    let source: URL; try { source = new URL(sourceUrl); } catch { throw new ApiError(400, 'Valid HTTPS source URL required'); }
    if (source.protocol !== 'https:' || source.username || source.password) throw new ApiError(400, 'Public HTTPS source URL required');
    // Source URLs are stored for a human reviewer; the server never fetches them.
    const id = crypto.randomUUID(); const sourceId = `community-${id}`;
    await db.prepare('INSERT INTO contributions (id, title, text, source_url, credit, submitted_at, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, title, text, source.href, credit, Date.now(), sourceId).run();
    return json({ id, status: 'pending', passengerVisible: false }, 201);
  }
  if (path === '/api/packs/community') {
    method(request, 'GET'); const pack = await db.prepare('SELECT manifest FROM published_packs ORDER BY version DESC LIMIT 1').first<{ manifest: string }>();
    return json(pack ? JSON.parse(pack.manifest) : { version: null, status: 'no-published-pack', chapters: [], sources: [] });
  }
  if (path.startsWith('/api/moderation')) {
    await moderator(request, env);
    if (path === '/api/moderation') {
      method(request, 'GET'); const rows = await db.prepare('SELECT * FROM contributions ORDER BY submitted_at DESC LIMIT 100').all(); return json({ contributions: rows.results });
    }
    if (path === '/api/moderation/review') {
      method(request, 'POST'); const data = await body(request, ['id', 'decision', 'reviewNote', 'rightsConfirmed']);
      const id = field(data.id, 'id', 36, 36); const reviewNote = field(data.reviewNote, 'reviewNote', 2000, 10);
      if (!['approve', 'reject'].includes(String(data.decision))) throw new ApiError(400, 'Invalid review decision');
      if (data.decision === 'approve' && data.rightsConfirmed !== true) throw new ApiError(400, 'Confirm source verification and permission/rights before approval');
      const result = await db.prepare('UPDATE contributions SET status = ?, reviewed_at = ?, review_note = ? WHERE id = ? RETURNING id, status').bind(data.decision === 'approve' ? 'approved' : 'rejected', Date.now(), reviewNote, id).first();
      if (!result) throw new ApiError(404, 'Contribution not found'); return json(result);
    }
    if (path === '/api/moderation/publish') {
      method(request, 'POST'); await body(request, []);
      // Snapshot is constructed inside one SQL statement, so approvals and the
      // monotonically increasing version cannot race a concurrent publisher.
      const publishedAt = Date.now();
      const row = await db.prepare(`INSERT INTO published_packs (version, manifest, published_at)
        SELECT COALESCE((SELECT MAX(version) + 1 FROM published_packs), 2),
          json_object('version', COALESCE((SELECT MAX(version) + 1 FROM published_packs), 2), 'kind', 'community-supplement', 'publishedAt', ?,
            'chapters', json((SELECT COALESCE(json_group_array(json_object('id', id, 'title', title, 'body', text, 'credit', credit, 'sourceIds', json_array(source_id), 'reviewedAt', reviewed_at)), '[]') FROM contributions WHERE status = 'approved')),
            'sources', json((SELECT COALESCE(json_group_array(json_object('id', source_id, 'url', source_url, 'credit', credit, 'reviewDate', reviewed_at, 'reviewNote', review_note, 'reviewStatus', 'human-reviewed')), '[]') FROM contributions WHERE status = 'approved'))), ?
        RETURNING manifest`).bind(publishedAt, publishedAt).first<{ manifest: string }>();
      return json(JSON.parse(row!.manifest), 201);
    }
  }
  throw new ApiError(404, 'Endpoint not found');
}
