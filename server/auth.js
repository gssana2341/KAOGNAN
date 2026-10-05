const crypto = require('crypto');
const { db } = require('./db');

const SESSION_DAYS = 30;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.batch([
    ['INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [sha(token), userId, expires]],
    ['DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]],
  ]);
  return token;
}

const destroySession = (token) => db.run('DELETE FROM sessions WHERE token_hash = ?', [sha(token)]);

const destroyUserSessions = (userId, exceptToken) =>
  db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', [userId, exceptToken ? sha(exceptToken) : '']);

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return m ? m[1] : null;
}

async function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  const row = await db.get(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`, [sha(token), new Date().toISOString()]);
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

// Login rate limit, stored in the database so every serverless instance sees the same counters.
// `limits` maps a key (e.g. "ip:1.2.3.4") to the number of failures allowed per window.
const WINDOW_MS = 15 * 60000;

async function loginBlocked(limits) {
  const keys = Object.keys(limits);
  const rows = await db.all(
    `SELECT key, COUNT(*) AS n FROM login_fails WHERE key IN (${keys.map(() => '?').join(',')}) AND at > ? GROUP BY key`,
    [...keys, Date.now() - WINDOW_MS],
  );
  return rows.some((r) => r.n >= limits[r.key]);
}

function loginFailed(keys) {
  const now = Date.now();
  return db.batch([
    ...keys.map((k) => ['INSERT INTO login_fails (key, at) VALUES (?, ?)', [k, now]]),
    ['DELETE FROM login_fails WHERE at < ?', [now - WINDOW_MS]],
  ]);
}

const loginSucceeded = (key) => db.run('DELETE FROM login_fails WHERE key = ?', [key]);

module.exports = {
  createSession, destroySession, destroyUserSessions, requireAuth, requirePasswordChanged, requireAdmin,
  loginBlocked, loginFailed, loginSucceeded, bearer,
};
