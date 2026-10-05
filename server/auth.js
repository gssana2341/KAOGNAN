const crypto = require('crypto');
const { db } = require('./db');

const SESSION_DAYS = 30;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, expires);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

function destroyUserSessions(userId, exceptToken) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, exceptToken ? sha(exceptToken) : '');
}

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sha(token), new Date().toISOString());
  if (!row) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  req.user = row;
  req.token = token;
  next();
}

// Users who still have a temporary password may only change it.
function requirePasswordChanged(req, res, next) {
  if (req.user.must_change_password) return res.status(403).json({ error: 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', code: 'MUST_CHANGE_PASSWORD' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  next();
}

// Tiny in-memory limiter for login attempts: max `limit` failures per key per window.
const WINDOW_MS = 15 * 60000;
const fails = new Map();
function loginLimiter(key, limit = 8, windowMs = WINDOW_MS) {
  const now = Date.now();
  const rec = (fails.get(key) || []).filter((t) => now - t < windowMs);
  return {
    blocked: rec.length >= limit,
    fail: () => { rec.push(Date.now()); fails.set(key, rec); },
    reset: () => fails.delete(key),
  };
}
// Drop stale entries so spraying random usernames can't grow the map forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of fails) if (!rec.length || now - rec[rec.length - 1] > WINDOW_MS) fails.delete(k);
}, 10 * 60000).unref();

module.exports = { createSession, destroySession, destroyUserSessions, requireAuth, requirePasswordChanged, requireAdmin, loginLimiter, bearer };
