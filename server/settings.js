const { db } = require('./db');
const { isTime } = require('./time');

const DEFAULTS = {
  company_name: 'บริษัทของฉัน',
  work_start: '09:00',
  work_end: '18:00',
  late_grace_min: '10',
  workdays: '1,2,3,4,5', // 0 = Sunday ... 6 = Saturday
  qr_mode: 'static', // static: printed QR, rotating: QR shown on a screen that changes every N seconds
  qr_rotate_sec: '60',
};

async function getSettings() {
  const rows = Object.fromEntries((await db.all('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
  const s = { ...DEFAULTS, ...rows };
  return {
    company_name: s.company_name,
    work_start: s.work_start,
    work_end: s.work_end,
    late_grace_min: Number(s.late_grace_min),
    workdays: s.workdays.split(',').filter(Boolean).map(Number),
    qr_mode: s.qr_mode,
    qr_rotate_sec: Number(s.qr_rotate_sec),
    qr_secret: s.qr_secret,
  };
}

function publicSettings(s) {
  const { qr_secret, ...rest } = s;
  return rest;
}

const UPSERT = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
const setSetting = (key, value) => db.run(UPSERT, [key, String(value)]);

// Returns an error message or null; applies the patch when valid.
async function updateSettings(p) {
  const out = {};
  if (p.company_name !== undefined) {
    const v = String(p.company_name).trim();
    if (!v || v.length > 80) return 'ชื่อบริษัทต้องมี 1-80 ตัวอักษร';
    out.company_name = v;
  }
  for (const k of ['work_start', 'work_end']) {
    if (p[k] !== undefined) {
      if (!isTime(p[k])) return 'รูปแบบเวลาไม่ถูกต้อง';
      out[k] = p[k];
    }
  }
  if (p.late_grace_min !== undefined) {
    const n = Number(p.late_grace_min);
    if (!Number.isInteger(n) || n < 0 || n > 180) return 'เวลาผ่อนผันต้องเป็น 0-180 นาที';
    out.late_grace_min = n;
  }
  if (p.workdays !== undefined) {
    if (!Array.isArray(p.workdays) || !p.workdays.length || !p.workdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return 'เลือกวันทำงานอย่างน้อย 1 วัน';
    }
    out.workdays = [...new Set(p.workdays)].sort().join(',');
  }
  if (p.qr_mode !== undefined) {
    if (!['static', 'rotating'].includes(p.qr_mode)) return 'โหมด QR ไม่ถูกต้อง';
    out.qr_mode = p.qr_mode;
  }
  if (p.qr_rotate_sec !== undefined) {
    const n = Number(p.qr_rotate_sec);
    if (!Number.isInteger(n) || n < 15 || n > 600) return 'รอบเปลี่ยน QR ต้องอยู่ระหว่าง 15-600 วินาที';
    out.qr_rotate_sec = n;
  }
  const merged = { ...(await getSettings()), ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, k === 'workdays' ? v.split(',').map(Number) : v])) };
  if (merged.work_start >= merged.work_end) return 'เวลาเริ่มงานต้องมาก่อนเวลาเลิกงาน';
  if (Object.keys(out).length) await db.batch(Object.entries(out).map(([k, v]) => [UPSERT, [k, String(v)]]));
  return null;
}

module.exports = { getSettings, publicSettings, updateSettings, setSetting };
