// Fills the database with demo employees + ~4 weeks of attendance so you can try the dashboard and Excel export.
// Usage: npm run seed      (login as e.g. somsri / demo1234)
const { db, ready } = require('../server/db');
const { hashPassword } = require('../server/password');
const { getSettings } = require('../server/settings');
const { localParts, localToIso, addDays, dow, toMin } = require('../server/time');

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

(async () => {
  await ready;
  if (await db.get("SELECT 1 AS x FROM users WHERE username = 'somsri'")) {
    console.log('มีข้อมูลตัวอย่างอยู่แล้ว (พบผู้ใช้ somsri) — ข้าม');
    return;
  }

  const s = await getSettings();
  const today = localParts().date;
  const created = localToIso(addDays(today, -28), '00:00');
  const bgs = ['sky', 'candy', 'mint', 'paws', 'boba', 'lavender'];

  const people = [];
  for (const [username, full_name, nickname, emp_code, position] of [
    ['somsri', 'สมศรี รักงาน', 'ศรี', 'E001', 'หัวหน้าทีม'],
    ['somchai', 'สมชาย ใจดี', 'ชาย', 'E002', 'พนักงานขาย'],
    ['malee', 'มาลี สวยงาม', 'มะลิ', 'E003', 'การตลาด'],
    ['preecha', 'ปรีชา คิดเร็ว', 'ชา', 'E004', 'ช่างเทคนิค'],
    ['napa', 'นภา ฟ้าใส', 'นภา', 'E005', 'บัญชี'],
    ['tum', 'ธรรม มั่นคง', 'ตั้ม', 'E006', 'พัสดุ'],
  ]) {
    const r = await db.run(
      `INSERT INTO users (username, password_hash, full_name, nickname, emp_code, position, bg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashPassword('demo1234'), full_name, nickname, emp_code, position, bgs[Math.floor(rnd() * bgs.length)], created],
    );
    people.push({ id: r.lastInsertRowid, late: 0.08 + rnd() * 0.25 });
  }

  const stmts = [];
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
      const late = inMin - toMin(s.work_start) > s.late_grace_min ? inMin - toMin(s.work_start) : 0;
      stmts.push(['INSERT OR IGNORE INTO attendance (user_id, work_date, check_in, check_out, late_minutes) VALUES (?, ?, ?, ?, ?)',
        [p.id, date, localToIso(date, hhmm(inMin)), isToday ? null : localToIso(date, hhmm(outMin)), late]]);
    }
  }
  const leave = 'INSERT INTO leaves (user_id, type, start_date, end_date, part, days, reason, status, admin_note, decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)';
  const now = new Date().toISOString();
  stmts.push(
    [leave, [people[1].id, 'sick', addDays(today, -9), addDays(today, -8), 'full', 2, 'ไข้หวัด', 'approved', 'หายไวไว', now]],
    [leave, [people[2].id, 'vacation', addDays(today, 5), addDays(today, 7), 'full', 3, 'พาครอบครัวไปทะเล', 'pending', '', null]],
    [leave, [people[3].id, 'personal', addDays(today, 2), addDays(today, 2), 'am', 0.5, 'ไปธนาคาร', 'pending', '', null]],
    [leave, [people[4].id, 'other', addDays(today, -3), addDays(today, -3), 'full', 1, 'ทำบัตรประชาชน', 'rejected', 'ช่วงนั้นปิดงบ ขอเลื่อนได้ไหม', now]],
  );
  await db.batch(stmts);
  console.log('เพิ่มพนักงานตัวอย่าง 6 คน (รหัสผ่านทุกคน demo1234) พร้อมประวัติเข้างานย้อนหลัง');
})().catch((e) => { console.error(e); process.exit(1); });
