const express = require('express');
const { db } = require('../db');
const { getSettings } = require('../settings');
const { isDate, dow, eachDate, localParts, addDays, daysBetween } = require('../time');

const router = express.Router();
const TYPES = ['sick', 'personal', 'vacation', 'other'];

// Working days covered by the leave (half day = 0.5), based on the company workdays.
function countLeaveDays(start, end, part, workdays) {
  let n = 0;
  for (const d of eachDate(start, end)) if (workdays.includes(dow(d))) n++;
  return part === 'full' ? n : n * 0.5;
}

router.get('/leaves', (req, res) => {
  const leaves = db.prepare('SELECT * FROM leaves WHERE user_id = ? ORDER BY start_date DESC, id DESC LIMIT 200').all(req.user.id);
  const year = localParts().date.slice(0, 4);
  const used = db.prepare(`SELECT type, SUM(days) days FROM leaves WHERE user_id = ? AND status = 'approved' AND start_date LIKE ? GROUP BY type`)
    .all(req.user.id, `${year}-%`);
  res.json({ leaves, used: Object.fromEntries(used.map((u) => [u.type, u.days])), year });
});

router.post('/leaves', (req, res) => {
  const { type, start_date, end_date } = req.body ?? {};
  const reason = String(req.body?.reason ?? '').trim();
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'เลือกประเภทการลา' });
  if (!isDate(start_date) || !isDate(end_date)) return res.status(400).json({ error: 'กรุณาเลือกวันที่ให้ถูกต้อง' });
  if (end_date < start_date) return res.status(400).json({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา' });
  if (daysBetween(start_date, end_date) > 60) return res.status(400).json({ error: 'ลาได้ครั้งละไม่เกิน 60 วัน' });
  if (start_date < addDays(localParts().date, -60)) return res.status(400).json({ error: 'ย้อนหลังได้ไม่เกิน 60 วัน' });
  if (reason.length > 500) return res.status(400).json({ error: 'เหตุผลยาวเกินไป' });
  const part = start_date === end_date && ['am', 'pm'].includes(req.body?.part) ? req.body.part : 'full';

  const days = countLeaveDays(start_date, end_date, part, getSettings().workdays);
  if (days === 0) return res.status(400).json({ error: 'ช่วงวันที่ที่เลือกไม่มีวันทำงาน' });

  const clash = db.prepare(`SELECT 1 FROM leaves WHERE user_id = ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ?
                            AND NOT (start_date = end_date AND ? = start_date AND part != 'full' AND ? != 'full' AND part != ?)`)
    .get(req.user.id, end_date, start_date, start_date, part, part);
  if (clash) return res.status(409).json({ error: 'ช่วงวันที่นี้มีใบลาอยู่แล้ว' });

  const info = db.prepare('INSERT INTO leaves (user_id, type, start_date, end_date, part, days, reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, type, start_date, end_date, part, days, reason);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.delete('/leaves/:id', (req, res) => {
  const info = db.prepare(`UPDATE leaves SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'`).run(req.params.id, req.user.id);
  if (!info.changes) return res.status(400).json({ error: 'ยกเลิกได้เฉพาะใบลาที่ยังรออนุมัติ' });
  res.json({ ok: true });
});

module.exports = router;
