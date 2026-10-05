const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const { createSession, destroySession, destroyUserSessions, requireAuth, loginLimiter } = require('../auth');
const { listBackgrounds, mascotImages } = require('../assets');

const router = express.Router();
const customBgPath = (id) => path.join(DATA_DIR, 'uploads', `bg-${id}.jpg`);

function publicUser(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name, nickname: u.nickname, emp_code: u.emp_code,
    position: u.position, role: u.role, track: !!u.track, bg: u.bg, must_change_password: !!u.must_change_password,
  };
}

// public: the login screen needs the mascot + the last background before anyone is signed in
router.get('/assets', (req, res) => {
  res.set('Cache-Control', 'no-cache').json({ backgrounds: listBackgrounds(), mascot: mascotImages() });
});

router.post('/auth/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const byIp = loginLimiter(`ip:${req.ip}`, 40);
  const byUser = loginLimiter(`u:${username.toLowerCase()}`, 8);
  if (byIp.blocked || byUser.blocked) return res.status(429).json({ error: 'ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const ok = verifyPassword(password, user?.password_hash);
  if (!user || !ok || !user.active) {
    byIp.fail(); byUser.fail();
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  byUser.reset();
  res.json({ token: createSession(user.id), user: publicUser(user) });
});

router.post('/auth/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), has_custom_bg: fs.existsSync(customBgPath(req.user.id)) });
});

router.post('/me/password', requireAuth, (req, res) => {
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (!verifyPassword(current, req.user.password_hash)) return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  if (next.length < 6) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (next === current) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสเดิม' });
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(next), req.user.id);
  destroyUserSessions(req.user.id, req.token);
  res.json({ ok: true });
});

router.put('/me/bg', requireAuth, (req, res) => {
  const bg = String(req.body?.bg ?? '');
  if (bg !== 'custom' && !listBackgrounds().some((b) => b.id === bg)) return res.status(400).json({ error: 'ไม่พบพื้นหลังนี้' });
  if (bg === 'custom' && !fs.existsSync(customBgPath(req.user.id))) return res.status(400).json({ error: 'ยังไม่ได้อัปโหลดรูป' });
  db.prepare('UPDATE users SET bg = ? WHERE id = ?').run(bg, req.user.id);
  res.json({ ok: true, bg });
});

// The browser re-encodes the picked photo to JPEG (max ~1280px) before sending it as a data URL.
router.post('/me/bg-image', requireAuth, express.json({ limit: '3mb' }), (req, res) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image ?? ''));
  if (!m) return res.status(400).json({ error: 'ไฟล์รูปไม่ถูกต้อง' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'รูปใหญ่เกินไป (สูงสุด 2MB)' });
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: 'ไฟล์รูปไม่ถูกต้อง' });
  fs.writeFileSync(customBgPath(req.user.id), buf);
  db.prepare("UPDATE users SET bg = 'custom' WHERE id = ?").run(req.user.id);
  res.json({ ok: true, bg: 'custom' });
});

router.get('/me/bg-image', requireAuth, (req, res) => {
  const p = customBgPath(req.user.id);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'ไม่พบรูป' });
  res.set('Cache-Control', 'private, max-age=60').type('image/jpeg').send(fs.readFileSync(p));
});

module.exports = { router, publicUser };
