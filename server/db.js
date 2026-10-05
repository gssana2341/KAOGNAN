// Database access (libSQL = SQLite protocol). One code path, two storage modes:
//   TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) set -> hosted Turso database (needed on Vercel, whose disk isn't persistent)
//   otherwise                                    -> local SQLite file in DATA_DIR (development, tests, VPS/Docker)
const { createClient } = require('@libsql/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./password');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const REMOTE_URL = process.env.TURSO_DATABASE_URL;
const MODE = REMOTE_URL ? 'turso' : 'file';

let client = null;
function connect() {
  if (REMOTE_URL) return createClient({ url: REMOTE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.env.VERCEL) {
    throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล: ใส่ TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN ใน Environment Variables ของ Vercel แล้ว Redeploy');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: 'file:' + path.join(DATA_DIR, 'kaongan.db').replace(/\\/g, '/') });
}

const plain = (columns, row) => Object.fromEntries(columns.map((c, i) => [c, row[i]]));

// Small promise-based helpers: positional `?` params, rows come back as plain objects.
const db = {
  async all(sql, args = []) {
    const r = await client.execute({ sql, args });
    return r.rows.map((row) => plain(r.columns, row));
  },
  async get(sql, args = []) {
    const r = await client.execute({ sql, args });
    return r.rows[0] ? plain(r.columns, r.rows[0]) : undefined;
  },
  async run(sql, args = []) {
    const r = await client.execute({ sql, args });
    return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
  },
  // several writes in one round trip and one transaction: [[sql, args], ...]
  async batch(list) {
    return client.batch(list.map(([sql, args = []]) => ({ sql, args })), 'write');
  },
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    nickname TEXT NOT NULL DEFAULT '',
    emp_code TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
    active INTEGER NOT NULL DEFAULT 1,
    track INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    bg TEXT NOT NULL DEFAULT 'sky',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    work_date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    edited_by INTEGER REFERENCES users(id),
    UNIQUE (user_id, work_date)
  )`,
  `CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('sick','personal','vacation','other')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    part TEXT NOT NULL DEFAULT 'full' CHECK (part IN ('full','am','pm')),
    days REAL NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    admin_note TEXT NOT NULL DEFAULT '',
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_leaves_user ON leaves(user_id, start_date)',
  'CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status)',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  // custom background photos live in the DB (serverless hosts have no persistent disk)
  `CREATE TABLE IF NOT EXISTS user_files (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  // login rate limiting must be shared between serverless instances, so it is stored too
  'CREATE TABLE IF NOT EXISTS login_fails (key TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_login_fails ON login_fails(key, at)',
];

async function init() {
  client = connect();
  if (MODE === 'file') {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
  }
  await db.batch(SCHEMA.map((sql) => [sql]));
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('qr_secret', ?)", [crypto.randomBytes(32).toString('hex')]);

  // First run: create the admin. A well-known default password on a public server would let whoever logs in
  // first take over the system, so in production it comes from ADMIN_PASSWORD or is random (printed once).
  if (!(await db.get('SELECT 1 AS x FROM users LIMIT 1'))) {
    const fromEnv = process.env.ADMIN_PASSWORD;
    const production = process.env.NODE_ENV === 'production';
    const password = fromEnv || (production ? crypto.randomBytes(9).toString('base64url') : 'admin1234');
    const r = await db.run(
      `INSERT OR IGNORE INTO users (username, password_hash, full_name, nickname, role, track, must_change_password)
       VALUES ('admin', ?, 'ผู้ดูแลระบบ', 'แอดมิน', 'admin', 0, ?)`,
      [hashPassword(password), fromEnv ? 0 : 1],
    );
    if (r.changes) {
      console.log(fromEnv
        ? '\n  สร้างบัญชีแอดมินแล้ว: ชื่อผู้ใช้ admin / รหัสผ่านตามที่ตั้งใน ADMIN_PASSWORD\n'
        : `\n  สร้างบัญชีแอดมินเริ่มต้นแล้ว:  ชื่อผู้ใช้ admin  /  รหัสผ่าน ${password}  (ระบบจะบังคับให้เปลี่ยนรหัสผ่านตอนเข้าครั้งแรก)\n`);
    }
  }
}

// Awaited by the request pipeline; on serverless hosts this runs once per cold start.
const ready = init();
ready.catch(() => {}); // the error is reported to the caller by the request middleware / startup code

module.exports = { db, ready, DATA_DIR, MODE };
