const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { db } = require('../db');
const { hashPassword } = require('../password');
const { destroyUserSessions } = require('../auth');
const { getSettings, publicSettings, updateSettings, setSetting } = require('../settings');
const { makePayload } = require('../qr');
const { buildReport, lateMinutes, MAX_RANGE_DAYS } = require('../report');
const { localParts, localToIso, isDate, isTime, daysBetween } = require('../time');
const { publicUser } = require('./account');
const { sendExcel } = require('../excel');

const router = express.Router();

/* ---------- employees ---------- */

function validateUser(b, { creating }) {
  const out = {};
  if (creating || b.username !== undefined) {
    const u = String(b.username ?? '').trim();
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(u)) return { error: 'ชื่อผู้ใช้ต้องเป็นอังกฤษ/ตัวเลข 3-30 ตัวอักษร' };
    out.username = u;
  }
  if (creating || b.full_name !== undefined) {
    const v = String(b.full_name ?? '').trim();
    if (!v || v.length > 80) return { error: 'กรุณากรอกชื่อ-นามสกุล' };
    out.full_name = v;
  }
  for (const k of ['nickname', 'emp_code', 'position']) {
    if (b[k] !== undefined) {
      const v = String(b[k]).trim();
      if (v.length > 50) return { error: 'ข้อความยาวเกินไป' };
      out[k] = v;
    }
  }
  if (b.role !== undefined) {
    if (!['employee', 'admin'].includes(b.role)) return { error: 'สิทธิ์ไม่ถูกต้อง' };
    out.role = b.role;
  }
  for (const k of ['active', 'track']) if (b[k] !== undefined) out[k] = b[k] ? 1 : 0;
  if (b.password !== undefined && b.password !== '') {
    if (String(b.password).length < 6) return { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
    out.password_hash = hashPassword(String(b.password));
    out.must_change_password = 1;
  } else if (creating) {
    return { error: 'กรุณาตั้งรหัสผ่านเริ่มต้น' };
  }
  return { out };
}

router.get('/admin/users', async (req, res) => {
  const users = (await db.all('SELECT * FROM users ORDER BY active DESC, emp_code, full_name')).map((u) => ({ ...publicUser(u), active: !!u.active }));
  res.json({ users });
});

router.post('/admin/users', async (req, res) => {
  const { out, error } = validateUser(req.body ?? {}, { creating: true });
  if (error) return res.status(400).json({ error });
  if (await db.get('SELECT 1 AS x FROM users WHERE username = ?', [out.username])) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  const cols = Object.keys(out);
  const info = await db.run(`INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(out));
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/admin/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const target = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  const { out, error } = validateUser(req.body ?? {}, { creating: false });
  if (error) return res.status(400).json({ error });
  if (out.username && await db.get('SELECT 1 AS x FROM users WHERE username = ? AND id != ?', [out.username, id])) {
    return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  }
  const losesAdmin = target.role === 'admin' && target.active && (out.role === 'employee' || out.active === 0);
  if (losesAdmin && (await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")).n <= 1) {
    return res.status(400).json({ error: 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน' });
  }
  const cols = Object.keys(out);
  if (cols.length) await db.run(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(out), id]);
  if (out.password_hash || out.active === 0) await destroyUserSessions(id);
  res.json({ ok: true });
});

/* ---------- settings + QR ---------- */

router.get('/admin/settings', async (req, res) => res.json({ settings: publicSettings(await getSettings()) }));

router.put('/admin/settings', async (req, res) => {
  const error = await updateSettings(req.body ?? {});
  if (error) return res.status(400).json({ error });
  res.json({ settings: publicSettings(await getSettings()) });
});

router.get('/admin/qr', async (req, res) => {
  const s = await getSettings();
  const { payload, expires_in } = makePayload(s);
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#3b2a3f', light: '#ffffff' } });
  res.set('Cache-Control', 'no-store').json({ svg, payload, expires_in, mode: s.qr_mode, rotate_sec: s.qr_rotate_sec, company_name: s.company_name });
});

// Invalidates every printed/old QR code.
router.post('/admin/qr/regenerate', async (req, res) => {
  await setSetting('qr_secret', crypto.randomBytes(32).toString('hex'));
  res.json({ ok: true });
});

/* ---------- dashboard / attendance ---------- */

router.get('/admin/dashboard', async (req, res) => {
  const date = localParts().date;
  const [{ rows }, pending] = await Promise.all([
    buildReport({ from: date, to: date }),
    db.get("SELECT COUNT(*) AS n FROM leaves WHERE status = 'pending'"),
  ]);
  const count = (st) => rows.filter((r) => r.status === st).length;
  res.json({
    date, pending_leaves: pending.n, rows,
    counts: { total: rows.length, present: count('present'), late: count('late'), leave: count('leave'), waiting: count('pending') },
  });
});

function parseRange(q) {
  const { from, to } = q;
  if (!isDate(from) || !isDate(to)) return { error: 'กรุณาเลือกช่วงวันที่' };
  if (to < from) return { error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' };
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) return { error: 'เลือกช่วงวันที่ได้ไม่เกิน 1 ปี' };
  const userId = q.user_id ? Number(q.user_id) : null;
  if (q.user_id && !Number.isInteger(userId)) return { error: 'พนักงานไม่ถูกต้อง' };
  return { from, to, userId };
}

router.get('/admin/attendance', async (req, res) => {
  const r = parseRange(req.query);
  if (r.error) return res.status(400).json({ error: r.error });
  const { rows, summary } = await buildReport(r);
  res.json({ rows: rows.reverse(), summary });
});

// Manual fix when someone forgot to scan: upsert one day for one employee. An empty check-in deletes the day.
router.put('/admin/attendance', async (req, res) => {
  const { user_id, work_date, check_in, check_out } = req.body ?? {};
  const note = String(req.body?.note ?? '').trim().slice(0, 200);
  if (!(await db.get('SELECT 1 AS x FROM users WHERE id = ?', [user_id]))) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  if (!isDate(work_date)) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
  for (const t of [check_in, check_out]) if (t && !isTime(t)) return res.status(400).json({ error: 'เวลาไม่ถูกต้อง' });
  if (!check_in && check_out) return res.status(400).json({ error: 'ต้องมีเวลาเข้างานก่อนจึงจะใส่เวลาออกงานได้' });
  if (check_in && check_out && check_out <= check_in) return res.status(400).json({ error: 'เวลาออกต้องหลังเวลาเข้า' });

  const inIso = check_in ? localToIso(work_date, check_in) : null;
  const outIso = check_out ? localToIso(work_date, check_out) : null;
  if (!inIso) {
    await db.run('DELETE FROM attendance WHERE user_id = ? AND work_date = ?', [user_id, work_date]);
    return res.json({ ok: true, deleted: true });
  }
  await db.run(`INSERT INTO attendance (user_id, work_date, check_in, check_out, late_minutes, note, edited_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, work_date) DO UPDATE SET check_in = excluded.check_in, check_out = excluded.check_out,
                  late_minutes = excluded.late_minutes, note = excluded.note, edited_by = excluded.edited_by`,
  [user_id, work_date, inIso, outIso, lateMinutes(inIso, await getSettings()), note, req.user.id]);
  res.json({ ok: true });
});

router.get('/admin/export.xlsx', async (req, res) => {
  const r = parseRange(req.query);
  if (r.error) return res.status(400).json({ error: r.error });
  await sendExcel(res, r);
});

/* ---------- leave approval ---------- */

router.get('/admin/leaves', async (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status) ? req.query.status : null;
  const rows = await db.all(`
    SELECT l.*, u.full_name, u.nickname, u.emp_code FROM leaves l JOIN users u ON u.id = l.user_id
    ${status ? 'WHERE l.status = ?' : ''} ORDER BY (l.status = 'pending') DESC, l.start_date DESC, l.id DESC LIMIT 300`, status ? [status] : []);
  res.json({ leaves: rows });
});

router.put('/admin/leaves/:id', async (req, res) => {
  const status = req.body?.status;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  const note = String(req.body?.note ?? '').trim().slice(0, 300);
  const info = await db.run(`UPDATE leaves SET status = ?, admin_note = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status != 'cancelled'`,
    [status, note, req.user.id, new Date().toISOString(), req.params.id]);
  if (!info.changes) return res.status(404).json({ error: 'ไม่พบใบลา หรือถูกยกเลิกแล้ว' });
  res.json({ ok: true });
});

module.exports = router;
