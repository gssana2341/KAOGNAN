const express = require('express');
const { db } = require('../db');
const { getSettings, publicSettings } = require('../settings');
const { verifyPayload } = require('../qr');
const { buildReport, lateMinutes, hhmm } = require('../report');
const { localParts, isDate } = require('../time');

const router = express.Router();
const MIN_STAY_MS = Number(process.env.MIN_STAY_SEC ?? 60) * 1000; // guards against double-scans turning a check-in into a check-out

function todayState(userId) {
  const now = new Date();
  const { date } = localParts(now);
  const rec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?').get(userId, date);
  const leave = db.prepare(`SELECT type, part FROM leaves WHERE user_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`).get(userId, date, date);
  const pending = db.prepare(`SELECT COUNT(*) n FROM leaves WHERE user_id = ? AND status = 'pending'`).get(userId).n;
  const s = getSettings();
  return {
    server_time: now.toISOString(),
    date,
    record: rec && {
      check_in: hhmm(rec.check_in), check_out: hhmm(rec.check_out), check_in_at: rec.check_in, check_out_at: rec.check_out,
      late_minutes: rec.late_minutes,
    },
    leave: leave || null,
    pending_leaves: pending,
    next_action: !rec?.check_in ? 'in' : !rec.check_out ? 'out' : 'done',
    settings: publicSettings(s),
  };
}

router.get('/today', (req, res) => res.json(todayState(req.user.id)));

router.post('/checkin', (req, res) => {
  const action = req.body?.action;
  if (!['in', 'out'].includes(action)) return res.status(400).json({ error: 'คำสั่งไม่ถูกต้อง' });
  const s = getSettings();
  if (!verifyPayload(s, req.body?.code)) {
    return res.status(400).json({ error: s.qr_mode === 'rotating' ? 'QR ไม่ถูกต้องหรือหมดอายุ ลองสแกนจากหน้าจอที่ทำงานอีกครั้ง' : 'QR นี้ไม่ใช่ QR ของที่ทำงาน' });
  }

  const now = new Date();
  const { date } = localParts(now);
  const rec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?').get(req.user.id, date);

  if (action === 'in') {
    if (rec?.check_in) return res.status(409).json({ error: 'วันนี้เช็คอินไปแล้ว', state: todayState(req.user.id) });
    const iso = now.toISOString();
    db.prepare(`INSERT INTO attendance (user_id, work_date, check_in, late_minutes) VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, work_date) DO UPDATE SET check_in = excluded.check_in, late_minutes = excluded.late_minutes`)
      .run(req.user.id, date, iso, lateMinutes(iso, s));
  } else {
    if (!rec?.check_in) return res.status(409).json({ error: 'วันนี้ยังไม่ได้เช็คอิน', state: todayState(req.user.id) });
    if (rec.check_out) return res.status(409).json({ error: 'วันนี้เช็คเอาท์ไปแล้ว', state: todayState(req.user.id) });
    if (now - new Date(rec.check_in) < MIN_STAY_MS) return res.status(429).json({ error: 'เพิ่งเช็คอินไป รอสักครู่แล้วค่อยเช็คเอาท์นะ' });
    db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(now.toISOString(), rec.id);
  }
  res.json({ ok: true, action, state: todayState(req.user.id) });
});

// My own history for a month (YYYY-MM): daily rows incl. leave/absent days + totals
router.get('/attendance', (req, res) => {
  const month = String(req.query.month ?? localParts().date.slice(0, 7));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'เดือนไม่ถูกต้อง' });
  const from = `${month}-01`;
  const to = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
  if (!isDate(from)) return res.status(400).json({ error: 'เดือนไม่ถูกต้อง' });
  const { rows, summary } = buildReport({ from, to, userId: req.user.id });
  res.json({ from, to, rows: rows.reverse(), summary: summary[0] ?? null });
});

module.exports = router;
