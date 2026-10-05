// Fills the database with demo employees + ~4 weeks of attendance so you can try the dashboard and Excel export.
// Usage: npm run seed      (login as e.g. somsri / demo1234)
const { db } = require('../server/db');
const { hashPassword } = require('../server/password');
const { getSettings } = require('../server/settings');
const { localParts, localToIso, addDays, dow, toMin } = require('../server/time');

if (db.prepare("SELECT 1 FROM users WHERE username = 'somsri'").get()) {
  console.log('มีข้อมูลตัวอย่างอยู่แล้ว (พบผู้ใช้ somsri) — ข้าม');
  process.exit(0);
}

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const people = [
  ['somsri', 'สมศรี รักงาน', 'ศรี', 'E001', 'หัวหน้าทีม'],
  ['somchai', 'สมชาย ใจดี', 'ชาย', 'E002', 'พนักงานขาย'],
  ['malee', 'มาลี สวยงาม', 'มะลิ', 'E003', 'การตลาด'],
  ['preecha', 'ปรีชา คิดเร็ว', 'ชา', 'E004', 'ช่างเทคนิค'],
  ['napa', 'นภา ฟ้าใส', 'นภา', 'E005', 'บัญชี'],
  ['tum', 'ธรรม มั่นคง', 'ตั้ม', 'E006', 'พัสดุ'],
].map(([username, full_name, nickname, emp_code, position]) => {
  const id = db.prepare(`INSERT INTO users (username, password_hash, full_name, nickname, emp_code, position, bg)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(username, hashPassword('demo1234'), full_name, nickname, emp_code, position, ['sky', 'candy', 'mint', 'paws', 'boba', 'lavender'][Math.floor(rnd() * 6)]).lastInsertRowid;
  return { id, late: 0.08 + rnd() * 0.25 };
});

const s = getSettings();
const today = localParts().date;
const insertRec = db.prepare('INSERT OR IGNORE INTO attendance (user_id, work_date, check_in, check_out, late_minutes) VALUES (?, ?, ?, ?, ?)');
db.prepare(`UPDATE users SET created_at = ? WHERE username != 'admin'`).run(localToIso(addDays(today, -35), '08:00'));

db.exec('BEGIN');
for (let i = 28; i >= 0; i--) {
  const date = addDays(today, -i);
  if (!s.workdays.includes(dow(date))) continue;
  for (const p of people) {
    if (rnd() < 0.05) continue; // absent
    const isLate = rnd() < p.late;
    const inMin = toMin(s.work_start) + (isLate ? 12 + Math.floor(rnd() * 40) : -25 + Math.floor(rnd() * 30));
    const outMin = toMin(s.work_end) + Math.floor(rnd() * 50) - 8;
    const isToday = date === today;
    if (isToday && inMin > localParts().minutes) continue;
    const late = Math.max(0, inMin - toMin(s.work_start) > s.late_grace_min ? inMin - toMin(s.work_start) : 0);
    insertRec.run(p.id, date, localToIso(date, hhmm(inMin)), isToday ? null : localToIso(date, hhmm(outMin)), late);
  }
}
const insLeave = db.prepare('INSERT INTO leaves (user_id, type, start_date, end_date, part, days, reason, status, admin_note, decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
insLeave.run(people[1].id, 'sick', addDays(today, -9), addDays(today, -8), 'full', 2, 'ไข้หวัด', 'approved', 'หายไวไว', new Date().toISOString());
insLeave.run(people[2].id, 'vacation', addDays(today, 5), addDays(today, 7), 'full', 3, 'พาครอบครัวไปทะเล', 'pending', '', null);
insLeave.run(people[3].id, 'personal', addDays(today, 2), addDays(today, 2), 'am', 0.5, 'ไปธนาคาร', 'pending', '', null);
insLeave.run(people[4].id, 'other', addDays(today, -3), addDays(today, -3), 'full', 1, 'ทำบัตรประชาชน', 'rejected', 'ช่วงนั้นปิดงบ ขอเลื่อนได้ไหม', new Date().toISOString());
db.exec('COMMIT');

console.log('เพิ่มพนักงานตัวอย่าง 6 คน (รหัสผ่านทุกคน demo1234) พร้อมประวัติเข้างานย้อนหลัง');
