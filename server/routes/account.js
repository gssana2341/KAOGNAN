const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const {
  createSession, destroySession, destroyUserSessions, requireAuth, loginBlocked, loginFailed, loginSucceeded,
} = require('../auth');
const { listBackgrounds } = require('../assets');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name, nickname: u.nickname, emp_code: u.emp_code,
    position: u.position, role: u.role, track: !!u.track, bg: u.bg, must_change_password: !!u.must_change_password,
  };
}

const hasCustomBg = async (userId) => !!(await db.get('SELECT 1 AS x FROM user_files WHERE user_id = ?', [userId]));

router.post('/auth/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const ipKey = `ip:${req.ip}`;
  const userKey = `u:${username.toLowerCase()}`;
  if (await loginBlocked({ [ipKey]: 40, [userKey]: 8 })) {
    return res.status(429).json({ error: 'ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที' });
  }

  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  const ok = verifyPassword(password, user?.password_hash);
  if (!user || !ok || !user.active) {
    await loginFailed([ipKey, userKey]);
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  await loginSucceeded(userKey);
  res.json({ token: await createSession(user.id), user: publicUser(user) });
});

router.post('/auth/logout', requireAuth, async (req, res) => {
  await destroySession(req.token);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user), has_custom_bg: await hasCustomBg(req.user.id) });
});

router.post('/me/password', requireAuth, async (req, res) => {
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (!verifyPassword(current, req.user.password_hash)) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  if (next.length < 6) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (next === current) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสเดิม' });
  await db.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hashPassword(next), req.user.id]);
  await destroyUserSessions(req.user.id, req.token);
  res.json({ ok: true });
});

router.put('/me/bg', requireAuth, async (req, res) => {
  const bg = String(req.body?.bg ?? '');
  if (bg !== 'custom' && !listBackgrounds().some((b) => b.id === bg)) return res.status(400).json({ error: 'ไม่พบพื้นหลังนี้' });
  if (bg === 'custom' && !(await hasCustomBg(req.user.id))) return res.status(400).json({ error: 'ยังไม่ได้อัปโหลดรูป' });
  await db.run('UPDATE users SET bg = ? WHERE id = ?', [bg, req.user.id]);
  res.json({ ok: true, bg });
});

// The browser re-encodes the picked photo to JPEG (max ~1280px) before sending it as a data URL.
router.post('/me/bg-image', requireAuth, express.json({ limit: '3mb' }), async (req, res) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image ?? ''));
  if (!m) return res.status(400).json({ error: 'ไฟล์รูปไม่ถูกต้อง' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'รูปใหญ่เกินไป (สูงสุด 2MB)' });
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: 'ไฟล์รูปไม่ถูกต้อง' });
  await db.batch([
    [`INSERT INTO user_files (user_id, data) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, [req.user.id, buf]],
    ["UPDATE users SET bg = 'custom' WHERE id = ?", [req.user.id]],
  ]);
  res.json({ ok: true, bg: 'custom' });
});

router.get('/me/bg-image', requireAuth, async (req, res) => {
  const row = await db.get('SELECT data FROM user_files WHERE user_id = ?', [req.user.id]);
  if (!row) return res.status(404).json({ error: 'ไม่พบรูป' });
  res.set('Cache-Control', 'private, max-age=60').type('image/jpeg').send(Buffer.from(row.data));
});

module.exports = { router, publicUser };
