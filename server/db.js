const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./password');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kaongan.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  work_date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  edited_by INTEGER REFERENCES users(id),
  UNIQUE (user_id, work_date)
);

CREATE TABLE IF NOT EXISTS leaves (
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
);
CREATE INDEX IF NOT EXISTS idx_leaves_user ON leaves(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

if (!db.prepare("SELECT 1 FROM settings WHERE key = 'qr_secret'").get()) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('qr_secret', ?)").run(crypto.randomBytes(32).toString('hex'));
}

// First run: create the admin. On a public server a well-known default password would let anyone who
// logs in first take over the system, so in production it comes from ADMIN_PASSWORD or is random (printed once).
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const fromEnv = process.env.ADMIN_PASSWORD;
  const production = process.env.NODE_ENV === 'production';
  const password = fromEnv || (production ? crypto.randomBytes(9).toString('base64url') : 'admin1234');
  db.prepare(`INSERT INTO users (username, password_hash, full_name, nickname, role, track, must_change_password)
              VALUES ('admin', ?, 'ผู้ดูแลระบบ', 'แอดมิน', 'admin', 0, ?)`).run(hashPassword(password), fromEnv ? 0 : 1);
  console.log(fromEnv
    ? '\n  สร้างบัญชีแอดมินแล้ว: ชื่อผู้ใช้ admin / รหัสผ่านตามที่ตั้งใน ADMIN_PASSWORD\n'
    : `\n  สร้างบัญชีแอดมินเริ่มต้นแล้ว:  ชื่อผู้ใช้ admin  /  รหัสผ่าน ${password}  (ระบบจะบังคับให้เปลี่ยนรหัสผ่านตอนเข้าครั้งแรก)\n`);
}

module.exports = { db, DATA_DIR };
