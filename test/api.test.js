// Integration test: boots the real server on a temp DB and walks through the main flows.
// Run with: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const ExcelJS = require('exceljs');

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
let PORT;
let BASE;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-test-'));
let server;

async function call(method, url, { token, body, raw } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400e3).toISOString().slice(0, 10);

before(async () => {
  PORT = await freePort();
  BASE = `http://127.0.0.1:${PORT}/api`;
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT, DATA_DIR: dataDir, MIN_STAY_SEC: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => /พร้อมใช้งาน/.test(d) && resolve());
    server.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});
after(async () => {
  await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
  try { fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* temp dir, the OS cleans it up */ }
});

const ctx = {};

test('requires login and forces the default admin to change password', async () => {
  assert.equal((await call('GET', '/today')).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { username: 'admin', password: 'wrong' } })).status, 401);

  const login = await call('POST', '/auth/login', { body: { username: 'admin', password: 'admin1234' } });
  assert.equal(login.status, 200);
  assert.equal(login.user.must_change_password, true);
  ctx.admin = login.token;

  const blocked = await call('GET', '/admin/users', { token: ctx.admin });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.code, 'MUST_CHANGE_PASSWORD');

  assert.equal((await call('POST', '/me/password', { token: ctx.admin, body: { current: 'admin1234', next: '123' } })).status, 400);
  assert.equal((await call('POST', '/me/password', { token: ctx.admin, body: { current: 'admin1234', next: 'newpass99' } })).status, 200);
  assert.equal((await call('GET', '/admin/users', { token: ctx.admin })).status, 200);
});

test('admin configures the workplace and creates employees', async () => {
  const s = await call('PUT', '/admin/settings', { token: ctx.admin, body: { work_start: '00:00', work_end: '23:59', late_grace_min: 0, workdays: [0, 1, 2, 3, 4, 5, 6], company_name: 'ร้านทดสอบ' } });
  assert.equal(s.status, 200);
  assert.equal((await call('PUT', '/admin/settings', { token: ctx.admin, body: { work_start: '20:00', work_end: '08:00' } })).status, 400);

  for (const [username, name] of [['somchai', 'สมชาย ใจดี'], ['malee', 'มาลี สวยงาม']]) {
    const r = await call('POST', '/admin/users', { token: ctx.admin, body: { username, password: 'temp1234', full_name: name, emp_code: username === 'somchai' ? 'E001' : 'E002', position: 'พนักงาน' } });
    assert.equal(r.status, 200);
  }
  assert.equal((await call('POST', '/admin/users', { token: ctx.admin, body: { username: 'SomChai', password: 'temp1234', full_name: 'ซ้ำ' } })).status, 409);

  for (const u of ['somchai', 'malee']) {
    const l = await call('POST', '/auth/login', { body: { username: u, password: 'temp1234' } });
    assert.equal(l.user.must_change_password, true);
    await call('POST', '/me/password', { token: l.token, body: { current: 'temp1234', next: 'mypass123' } });
    ctx[u] = l.token;
  }
  assert.equal((await call('GET', '/admin/users', { token: ctx.somchai })).status, 403);
});

test('check-in / check-out only works with the workplace QR', async () => {
  const qr = await call('GET', '/admin/qr', { token: ctx.admin });
  assert.match(qr.payload, /^KN1:0:[0-9a-f]{24}$/);
  assert.match(qr.svg, /^<\?xml|^<svg/);
  ctx.qr = qr.payload;

  const t = ctx.somchai;
  assert.equal((await call('GET', '/today', { token: t })).next_action, 'in');
  assert.equal((await call('POST', '/checkin', { token: t, body: { action: 'in', code: 'https://example.com' } })).status, 400);
  assert.equal((await call('POST', '/checkin', { token: t, body: { action: 'in', code: qr.payload.slice(0, -1) + '0' } })).status, 400);
  assert.equal((await call('POST', '/checkin', { token: t, body: { action: 'out', code: ctx.qr } })).status, 409, 'cannot check out before checking in');

  const inn = await call('POST', '/checkin', { token: t, body: { action: 'in', code: ctx.qr } });
  assert.equal(inn.status, 200);
  assert.equal(inn.state.next_action, 'out');
  assert.ok(inn.state.record.late_minutes > 0, 'work_start is 00:00 with no grace so it must be late');
  assert.equal((await call('POST', '/checkin', { token: t, body: { action: 'in', code: ctx.qr } })).status, 409);

  const out = await call('POST', '/checkin', { token: t, body: { action: 'out', code: ctx.qr } });
  assert.equal(out.status, 200);
  assert.equal(out.state.next_action, 'done');
  assert.equal((await call('POST', '/checkin', { token: t, body: { action: 'out', code: ctx.qr } })).status, 409);
});

test('rotating QR expires old codes; regenerating invalidates printed codes', async () => {
  await call('PUT', '/admin/settings', { token: ctx.admin, body: { qr_mode: 'rotating', qr_rotate_sec: 30 } });
  assert.equal((await call('POST', '/checkin', { token: ctx.malee, body: { action: 'in', code: ctx.qr } })).status, 400, 'old static code rejected');
  const live = await call('GET', '/admin/qr', { token: ctx.admin });
  assert.equal(live.mode, 'rotating');
  assert.ok(live.expires_in > 0 && live.expires_in <= 30);
  assert.equal((await call('POST', '/checkin', { token: ctx.malee, body: { action: 'in', code: live.payload } })).status, 200);

  await call('PUT', '/admin/settings', { token: ctx.admin, body: { qr_mode: 'static' } });
  const printed = (await call('GET', '/admin/qr', { token: ctx.admin })).payload;
  await call('POST', '/admin/qr/regenerate', { token: ctx.admin });
  assert.equal((await call('POST', '/checkin', { token: ctx.somchai, body: { action: 'in', code: printed } })).status, 400);
});

test('leave requests: validation, overlap, approval, cancellation', async () => {
  const t = ctx.somchai;
  const day = addDays(today(), 3);
  assert.equal((await call('POST', '/leaves', { token: t, body: { type: 'sick', start_date: day, end_date: addDays(day, -1) } })).status, 400);
  const mk = (body) => call('POST', '/leaves', { token: t, body: { type: 'vacation', reason: 'พักผ่อน', ...body } });

  const ok = await mk({ start_date: day, end_date: addDays(day, 1) });
  assert.equal(ok.status, 200);
  assert.equal((await mk({ start_date: addDays(day, 1), end_date: addDays(day, 2) })).status, 409, 'overlap');

  // two half days on the same date are allowed, two of the same half are not
  const d2 = addDays(day, 10);
  assert.equal((await mk({ start_date: d2, end_date: d2, part: 'am' })).status, 200);
  assert.equal((await mk({ start_date: d2, end_date: d2, part: 'am' })).status, 409);
  assert.equal((await mk({ start_date: d2, end_date: d2, part: 'pm' })).status, 200);

  const mine = await call('GET', '/leaves', { token: t });
  const first = mine.leaves.find((l) => l.start_date === day);
  assert.equal(first.days, 2);
  assert.equal(first.status, 'pending');

  assert.equal((await call('PUT', `/admin/leaves/${first.id}`, { token: ctx.somchai, body: { status: 'approved' } })).status, 403);
  const pend = await call('GET', '/admin/leaves?status=pending', { token: ctx.admin });
  assert.ok(pend.leaves.some((l) => l.id === first.id && l.full_name === 'สมชาย ใจดี'));
  assert.equal((await call('PUT', `/admin/leaves/${first.id}`, { token: ctx.admin, body: { status: 'approved', note: 'ได้เลย' } })).status, 200);

  const am = mine.leaves.find((l) => l.start_date === d2 && l.part === 'am');
  assert.equal((await call('DELETE', `/leaves/${am.id}`, { token: t })).status, 200);
  assert.equal((await call('DELETE', `/leaves/${first.id}`, { token: t })).status, 400, 'approved leave cannot be self-cancelled');

  const after = await call('GET', '/leaves', { token: t });
  assert.equal(after.leaves.find((l) => l.id === first.id).admin_note, 'ได้เลย');
  assert.equal(after.used.vacation, 2);
});

test('report, manual correction and Excel export', async () => {
  const from = today(), to = today();
  await call('PUT', '/admin/settings', { token: ctx.admin, body: { work_start: '09:00', work_end: '18:00', late_grace_min: 10 } });
  const rep = await call('GET', `/admin/attendance?from=${from}&to=${to}`, { token: ctx.admin });
  assert.equal(rep.status, 200);
  const row = rep.rows.find((r) => r.full_name === 'สมชาย ใจดี');
  assert.equal(row.status, 'late');
  assert.ok(row.check_in && row.check_out && row.hours >= 0);

  const fix = await call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: 1, work_date: from, check_in: '09:00', check_out: '17:30' } });
  assert.equal(fix.status, 200);
  const users = (await call('GET', '/admin/users', { token: ctx.admin })).users;
  const malee = users.find((u) => u.username === 'malee');
  const edit = await call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: malee.id, work_date: from, check_in: '08:55', check_out: '17:05', note: 'ลืมสแกนออก' } });
  assert.equal(edit.status, 200);
  assert.equal((await call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: malee.id, work_date: from, check_in: '10:00', check_out: '09:00' } })).status, 400);

  const rep2 = await call('GET', `/admin/attendance?from=${from}&to=${to}&user_id=${malee.id}`, { token: ctx.admin });
  assert.equal(rep2.rows[0].check_in, '08:55');
  assert.equal(rep2.rows[0].hours, 8.17);
  assert.equal(rep2.rows[0].status, 'present');
  assert.equal(rep2.rows[0].note, 'ลืมสแกนออก');

  const late = await call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: malee.id, work_date: from, check_in: '09:11', check_out: '18:00' } });
  assert.equal(late.status, 200);
  const rep3 = await call('GET', `/admin/attendance?from=${from}&to=${to}&user_id=${malee.id}`, { token: ctx.admin });
  assert.equal(rep3.rows[0].status, 'late');
  assert.equal(rep3.rows[0].late_minutes, 11, 'late minutes are counted from work_start once past the grace period');
  const onTime = await call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: malee.id, work_date: from, check_in: '09:10', check_out: '18:00' } });
  assert.equal(onTime.status, 200);
  assert.equal((await call('GET', `/admin/attendance?from=${from}&to=${to}&user_id=${malee.id}`, { token: ctx.admin })).rows[0].status, 'present', 'inside the 10 minute grace');
});

test('overtime: only time after work_end counts, no approval or minimum', async () => {
  const day = today();
  await call('PUT', '/admin/settings', { token: ctx.admin, body: { work_start: '09:00', work_end: '18:00', late_grace_min: 10 } });
  const malee = (await call('GET', '/admin/users', { token: ctx.admin })).users.find((u) => u.username === 'malee');
  const set = (check_in, check_out) => call('PUT', '/admin/attendance', { token: ctx.admin, body: { user_id: malee.id, work_date: day, check_in, check_out } });
  const ot = async () => (await call('GET', `/admin/attendance?from=${day}&to=${day}&user_id=${malee.id}`, { token: ctx.admin })).rows[0].ot_minutes;

  assert.equal((await set('08:00', '19:30')).status, 200);
  assert.equal(await ot(), 90, 'came at 8 and left at 19:30: the hour before the shift is not OT, the 90 minutes after it are');
  await set('08:00', '17:59');
  assert.equal(await ot(), 0, 'leaving before the end of the shift is no OT');
  await set('09:00', '18:01');
  assert.equal(await ot(), 1, 'no minimum');
  await set('08:00', null);
  assert.equal(await ot(), 0, 'no check-out yet, nothing to count');
  await set('18:30', '20:00');
  assert.equal(await ot(), 90, 'arriving after the end of the shift counts from the check-in');

  const rep = await call('GET', `/admin/attendance?from=${day}&to=${day}`, { token: ctx.admin });
  assert.equal(rep.summary.find((s) => s.user_id === malee.id).ot_minutes, 90);
  const mine = await call('GET', '/today', { token: ctx.malee });
  assert.equal(mine.record.ot_minutes, 90, 'the employee sees their own OT on the home screen');

  // Excel: OT in the summary and daily sheets, plus one sheet per person with a total row
  const res = await call('GET', `/admin/export.xlsx?from=${day}&to=${day}`, { token: ctx.admin, raw: true });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const sum = wb.getWorksheet('สรุปรายคน');
  assert.equal(sum.getRow(1).getCell(12).value, 'OT รวม (ชม.)');
  const sumRow = sum.getColumn(2).values.indexOf('มาลี สวยงาม');
  assert.equal(sum.getRow(sumRow).getCell(12).value, 1.5);
  const personal = wb.worksheets.find((w) => w.name.startsWith('E002'));
  assert.ok(personal, 'a sheet named after each person');
  const total = personal.getRow(personal.rowCount);
  assert.equal(total.getCell(1).value, 'รวม');
  assert.equal(total.getCell(4).value, 1.5, 'hours worked');
  assert.equal(total.getCell(5).value, 1.5, 'OT hours');
  assert.equal(personal.getRow(2).getCell(5).value, 1.5, 'the day row shows the same OT');
});

test('Excel export contains the three sheets with data, then one sheet per person', async () => {
  const from = addDays(today(), -2), to = addDays(today(), 12);
  const res = await call('GET', `/admin/export.xlsx?from=${from}&to=${to}`, { token: ctx.admin, raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /spreadsheetml/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const sheets = wb.worksheets.map((w) => w.name);
  assert.deepEqual(sheets.slice(0, 3), ['สรุปรายคน', 'รายวัน', 'ใบลา']);
  assert.ok(sheets.slice(3).some((n) => n.startsWith('E001')) && sheets.slice(3).some((n) => n.startsWith('E002')), `per-person sheets: ${sheets}`);
  assert.equal(new Set(sheets.map((n) => n.toLowerCase())).size, sheets.length, 'sheet names are unique');
  const names = wb.getWorksheet('สรุปรายคน').getColumn(2).values.filter(Boolean);
  assert.ok(names.includes('สมชาย ใจดี') && names.includes('มาลี สวยงาม'));
  assert.ok(wb.getWorksheet('ใบลา').rowCount >= 2);
  assert.equal((await call('GET', `/admin/export.xlsx?from=2020-01-01&to=2023-01-01`, { token: ctx.admin })).status, 400, 'range capped at 1 year');

  const users = (await call('GET', '/admin/users', { token: ctx.admin })).users;
  const one = await call('GET', `/admin/export.xlsx?from=${from}&to=${to}&user_id=${users.find((u) => u.username === 'malee').id}`, { token: ctx.admin, raw: true });
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.load(Buffer.from(await one.arrayBuffer()));
  assert.deepEqual(wb1.worksheets.map((w) => w.name), ['สรุปรายคน', 'รายวัน', 'ใบลา'], 'exporting one person needs no extra sheet');
});

test('background selection and custom upload', async () => {
  const t = ctx.somchai;
  assert.equal((await call('PUT', '/me/bg', { token: t, body: { bg: 'candy' } })).status, 200);
  assert.equal((await call('PUT', '/me/bg', { token: t, body: { bg: '../../etc/passwd' } })).status, 400);
  assert.equal((await call('PUT', '/me/bg', { token: t, body: { bg: 'custom' } })).status, 400, 'no upload yet');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]).toString('base64');
  assert.equal((await call('POST', '/me/bg-image', { token: t, body: { image: 'data:image/jpeg;base64,' + jpeg } })).status, 200);
  assert.equal((await call('GET', '/me', { token: t })).user.bg, 'custom');
  assert.equal((await call('POST', '/me/bg-image', { token: t, body: { image: 'data:image/png;base64,AAAA' } })).status, 400);
});

test('assets: backgrounds are discovered from public/bg, mascot pictures are all-or-nothing', async () => {
  const a = await call('GET', '/assets');
  assert.equal(a.status, 200, 'public: needed by the login screen');
  const ids = a.backgrounds.map((b) => b.id);
  assert.ok(ids.includes('sky') && ids.includes('night'));
  assert.ok(a.backgrounds.every((b) => /^\/bg\/[\w-]+\.(svg|webp|png|jpe?g|avif)$/i.test(b.file)));
  // either the built-in cat (null) or a complete set of pictures that exist on disk
  if (a.mascot !== null) {
    for (const s of ['sleepy', 'happy', 'bye', 'oops']) {
      assert.match(a.mascot[s], /^\/img\/mascot\/\w+\.(webp|png|svg)$/);
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', a.mascot[s])), `${s} picture exists`);
    }
  }
  assert.equal((await call('PUT', '/me/bg', { token: ctx.malee, body: { bg: ids[3] } })).status, 200);
});

test('my attendance accepts a custom range (home screen week strip)', async () => {
  const to = today();
  const week = await call('GET', `/attendance?from=${addDays(to, -6)}&to=${to}`, { token: ctx.somchai });
  assert.equal(week.status, 200);
  assert.ok(week.rows.every((r) => r.date >= addDays(to, -6) && r.date <= to));
  assert.equal((await call('GET', `/attendance?from=${addDays(to, -100)}&to=${to}`, { token: ctx.somchai })).status, 400, 'max 62 days');
  assert.equal((await call('GET', `/attendance?from=${to}&to=${addDays(to, -1)}`, { token: ctx.somchai })).status, 400);
});

test('custom background photo is stored in the database and served back byte-for-byte', async () => {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('kaongan-test-image')]);
  const up = await call('POST', '/me/bg-image', { token: ctx.malee, body: { image: 'data:image/jpeg;base64,' + bytes.toString('base64') } });
  assert.equal(up.status, 200);
  const res = await call('GET', '/me/bg-image', { token: ctx.malee, raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/jpeg/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  assert.equal((await call('GET', '/me', { token: ctx.malee })).has_custom_bg, true);
});

test('failed logins are rate limited (shared through the database)', async () => {
  for (let i = 0; i < 8; i++) {
    assert.equal((await call('POST', '/auth/login', { body: { username: 'nobody-here', password: 'x' + i } })).status, 401);
  }
  const blocked = await call('POST', '/auth/login', { body: { username: 'nobody-here', password: 'again' } });
  assert.equal(blocked.status, 429);
  // other accounts are not affected by that username's counter
  assert.equal((await call('POST', '/auth/login', { body: { username: 'somchai', password: 'mypass123' } })).status, 200);
});

test('health endpoints', async () => {
  const root = BASE.replace(/\/api$/, '');
  assert.equal(await (await fetch(root + '/healthz')).text(), 'ok');
  const h = await (await fetch(BASE + '/health/db')).json();
  assert.deepEqual(h, { ok: true, database: 'file' });
});

test('admin password recovery through environment variables', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-admin-'));
  const port = await freePort();
  const login = async (pw) => (await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: pw }),
  })).json();

  async function boot(env) {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
      env: { ...process.env, PORT: port, DATA_DIR: dir, NODE_ENV: 'production', ADMIN_PASSWORD: '', RESET_ADMIN: '', ...env }, stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    await new Promise((resolve, reject) => {
      child.stdout.on('data', (d) => { out += d; if (/พร้อมใช้งาน/.test(out)) resolve(); });
      child.on('exit', (c) => reject(new Error('server exited ' + c)));
    });
    return { out, stop: () => new Promise((r) => { child.removeAllListeners('exit'); child.once('exit', r); child.kill(); }) };
  }

  // 1) first start WITHOUT ADMIN_PASSWORD in production: a random password is generated and printed once
  let s = await boot({});
  const generated = /รหัสผ่าน (\S+)\s+\(/.exec(s.out)?.[1];
  assert.ok(generated && generated !== 'admin1234', 'random password, never the well-known default');
  assert.equal((await login('admin1234')).error, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  assert.equal((await login(generated)).user.must_change_password, true);
  await s.stop();

  // 2) the owner sets ADMIN_PASSWORD later: applies because the admin never chose a password
  s = await boot({ ADMIN_PASSWORD: 'owner-pass-1' });
  const after = await login('owner-pass-1');
  assert.equal(after.user.must_change_password, false);
  assert.ok((await login(generated)).error, 'old generated password no longer works');

  // 3) once the admin changes the password, a different ADMIN_PASSWORD no longer overrides it ...
  const changed = await fetch(`http://127.0.0.1:${port}/api/me/password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + after.token }, body: JSON.stringify({ current: 'owner-pass-1', next: 'my-own-pass-2' }),
  });
  assert.equal(changed.status, 200);
  await s.stop();
  s = await boot({ ADMIN_PASSWORD: 'someone-else-3' });
  assert.ok((await login('someone-else-3')).error);
  assert.ok((await login('my-own-pass-2')).token);
  await s.stop();

  // 4) ... unless RESET_ADMIN=1 is set explicitly
  s = await boot({ ADMIN_PASSWORD: 'recovered-pass-4', RESET_ADMIN: '1' });
  assert.ok((await login('recovered-pass-4')).token);
  assert.ok((await login('my-own-pass-2')).error);
  await s.stop();
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* temp dir */ }
});

test('the QR drawn by the server decodes back to the exact payload (scannable)', async () => {
  const jsQR = require('jsqr');
  const qr = await call('GET', '/admin/qr', { token: ctx.admin });
  const total = Number(/data-modules="(\d+)"/.exec(qr.svg)[1]);
  assert.ok(total >= 25 && total <= 45);
  const SCALE = 8;
  const size = total * SCALE;
  const px = new Uint8ClampedArray(size * size * 4).fill(255); // white, opaque
  const d = /<path d="([^"]+)"/.exec(qr.svg)[1];
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let yy = y * SCALE; yy < (y + 1) * SCALE; yy++) {
      for (let xx = x * SCALE; xx < (x + w) * SCALE; xx++) { const i = (yy * size + xx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    }
  }
  assert.equal(jsQR(px, size, size)?.data, qr.payload);
});

test('every UI text and server message has an English translation (npm run i18n:check)', () => {
  const { allKeys } = require('../scripts/i18n-keys');
  const dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'i18n', 'en.json'), 'utf8'));
  const keys = allKeys();
  const missing = [...keys].filter(([k]) => !(k in dict)).map(([k, f]) => `${k}  (${f})`);
  assert.deepEqual(missing, [], 'missing English for:\n' + missing.join('\n'));
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  assert.deepEqual(unused, [], 'en.json has entries nothing uses:\n' + unused.join('\n'));

  const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const [th, en] of Object.entries(dict)) {
    assert.ok(en.trim(), `empty translation for ${th}`);
    assert.doesNotMatch(en, /[฀-๿]/, `Thai text left in the English translation of "${th}"`);
    const parts = en.split('|');
    assert.ok(parts.length <= 2, `at most one "|" (singular|plural): ${th}`);
    for (const part of parts) assert.equal(placeholders(part), placeholders(th), `placeholders differ for "${th}" -> "${part}"`);
    if (parts.length === 2) assert.match(th, /\{n\}/, `plural entries need {n}: ${th}`);
  }
});

test('Excel export can be requested in English', async () => {
  const from = addDays(today(), -2), to = addDays(today(), 1);
  const res = await call('GET', `/admin/export.xlsx?from=${from}&to=${to}&lang=en`, { token: ctx.admin, raw: true });
  assert.equal(res.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual(wb.worksheets.map((w) => w.name).slice(0, 3), ['Summary', 'Daily', 'Leaves']);
  assert.equal(wb.getWorksheet('Daily').getRow(1).getCell(4).value, 'Check in');
  assert.equal(wb.getWorksheet('Daily').getRow(1).getCell(7).value, 'OT (h)');
  const statuses = wb.getWorksheet('Daily').getColumn(9).values.filter((v) => typeof v === 'string');
  assert.ok(statuses.some((s) => /Present|Late|Leave|Absent/.test(s)), 'statuses are in English');
  assert.ok(statuses.every((s) => !/[฀-๿]/.test(s)), 'no Thai in the English workbook');
  const personal = wb.worksheets.find((w) => w.name.startsWith('E002'));
  assert.equal(personal.getRow(personal.rowCount).getCell(1).value, 'Total');
});
