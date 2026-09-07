import { ApiError, bearer, body, database, field, hash, json, method, quota, randomToken, type BackendEnv } from '../backend.ts';

export interface Session { token_hash: string; room_id: string; expires_at: number }
export async function authenticate(request: Request, env: BackendEnv): Promise<Session> {
  const tokenHash = await hash(bearer(request));
  const session = await database(env).prepare('SELECT s.token_hash, s.room_id, s.expires_at FROM sessions s JOIN rooms r ON r.id = s.room_id WHERE s.token_hash = ? AND s.expires_at > ? AND r.expires_at > ?').bind(tokenHash, Date.now(), Date.now()).first<Session>();
  if (!session) throw new ApiError(401, 'Session expired or invalid. Join the carriage again.');
  return session;
}
export async function rooms(request: Request, env: BackendEnv): Promise<Response> {
  const db = database(env); const path = new URL(request.url).pathname;
  if (path === '/api/rooms/create' || path === '/api/rooms/join') {
    method(request, 'POST'); const data = await body(request, path.endsWith('/join') ? ['code'] : []);
    const token = randomToken(); const tokenHash = await hash(token); const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    let roomId: string; let code: string;
    if (path.endsWith('/create')) {
      code = randomToken(12).toUpperCase(); roomId = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO rooms (id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(roomId, await hash(code), Date.now(), expiresAt),
        db.prepare('INSERT INTO sessions (token_hash, room_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, roomId, expiresAt)
      ]);
    } else {
      code = field(data.code, 'code', 24, 24).toUpperCase();
      if (!/^[A-F0-9]{24}$/.test(code)) throw new ApiError(400, 'Invalid carriage code');
      const room = await db.prepare('SELECT id, expires_at FROM rooms WHERE code_hash = ? AND expires_at > ?').bind(await hash(code), Date.now()).first<{ id: string; expires_at: number }>();
      if (!room) throw new ApiError(404, 'Carriage code not found or expired');
      roomId = room.id;
      await db.prepare('INSERT INTO sessions (token_hash, room_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, roomId, Math.min(expiresAt, room.expires_at)).run();
      return json({ code, token, expiresAt: Math.min(expiresAt, room.expires_at) }, 201);
    }
    return json({ code, token, expiresAt }, 201);
  }
  if (path === '/api/rooms/messages') {
    if (!['GET', 'POST'].includes(request.method)) throw new ApiError(405, 'Method not allowed');
    const session = await authenticate(request, env);
    await quota(db, `room:${session.token_hash}`, request.method === 'GET' ? 120 : 20);
    if (request.method === 'POST') {
      const data = await body(request, ['text', 'requestId']); const text = field(data.text, 'message', 2000);
      const requestId = field(data.requestId, 'requestId', 80, 16);
      if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new ApiError(400, 'Invalid requestId');
      const id = crypto.randomUUID(); const now = Date.now();
      await db.prepare('INSERT INTO messages (id, room_id, author_hash, request_id, text, created_at) SELECT ?, room_id, token_hash, ?, ?, ? FROM sessions WHERE token_hash = ? AND expires_at > ? ON CONFLICT(author_hash, request_id) DO NOTHING').bind(id, requestId, text, now, session.token_hash, now).run();
      const saved = await db.prepare('SELECT id, text, created_at FROM messages WHERE author_hash = ? AND request_id = ? AND room_id = ?').bind(session.token_hash, requestId, session.room_id).first<{ id: string; text: string; created_at: number }>();
      if (!saved) throw new ApiError(401, 'Session expired');
      if (saved.text !== text) throw new ApiError(409, 'This requestId already saved different content. Reopen the saved message or use a new requestId.');
      return json({ message: saved }, 201);
    }
    // The room is derived from a validated token, never a caller-supplied code/id.
    const messages = await db.prepare('SELECT m.id, m.text, m.created_at FROM messages m JOIN sessions s ON s.room_id = m.room_id WHERE s.token_hash = ? AND s.expires_at > ? ORDER BY m.created_at DESC, m.id DESC LIMIT 100').bind(session.token_hash, Date.now()).all();
    return json({ messages: messages.results.reverse() });
  }
  if (path === '/api/rooms/leave') {
    method(request, 'POST'); await body(request, []); const session = await authenticate(request, env);
    // Opt-out removes this participant's board messages and revokes their token.
    await db.batch([db.prepare('DELETE FROM messages WHERE author_hash = ?').bind(session.token_hash), db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.token_hash)]);
    return json({ left: true, messagesRemoved: true });
  }
  throw new ApiError(404, 'Endpoint not found');
}
