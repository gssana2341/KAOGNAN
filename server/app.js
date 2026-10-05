// The Express application, without a listening socket: server/index.js runs it locally / on a VPS / in Docker,
// api/index.js runs it as a Vercel serverless function.
const express = require('express');
const path = require('path');

const { db, ready, MODE } = require('./db');
const { requireAuth, requirePasswordChanged, requireAdmin } = require('./auth');
const { listBackgrounds, mascotImages } = require('./assets');
const account = require('./routes/account');
const attendance = require('./routes/attendance');
const leaves = require('./routes/leaves');
const admin = require('./routes/admin');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY || process.env.VERCEL) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self'; connect-src 'self'; media-src 'self' blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});

app.get('/healthz', (req, res) => res.type('text').send('ok')); // process is up (for hosting health checks)

const api = express.Router();
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean); // e.g. the future mobile app
api.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && corsOrigins.includes(o)) {
    res.set({
      'Access-Control-Allow-Origin': o,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// public, no database needed: the login screen asks for these before anyone is signed in
api.get('/assets', (req, res) => {
  res.set('Cache-Control', 'no-cache').json({ backgrounds: listBackgrounds(), mascot: mascotImages() });
});

// deployment check: open /api/health/db — ok means the database is reachable, otherwise it says what is wrong
api.get('/health/db', async (req, res) => {
  try {
    await ready;
    await db.get('SELECT 1 AS ok');
    res.json({ ok: true, database: MODE });
  } catch (e) {
    res.status(503).json({ ok: false, database: MODE, error: e.message });
  }
});

// everything below needs the database (on serverless this waits for the one-time schema setup of a cold start)
api.use(async (req, res, next) => {
  try { await ready; } catch (e) { return res.status(503).json({ error: e.message }); }
  next();
});
api.use((req, res, next) => (req.path === '/me/bg-image' ? next() : express.json({ limit: '100kb' })(req, res, next)));
api.use(account.router);
api.use(requireAuth, requirePasswordChanged);
api.use(attendance);
api.use(leaves);
api.use('/admin', requireAdmin);
api.use(admin);
api.use((req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));
app.use('/api', api);

app.get('/sw.js', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, '..', 'public', 'sw.js')));
// No build step means no hashed filenames, so code is revalidated (ETag) on every load; fonts/art can be cached.
// (On Vercel the CDN serves public/ itself and this is never reached.)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, file) {
    if (/\.woff2$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else if (/\.(png|webp|jpe?g|avif|svg)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=3600');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'ข้อมูลใหญ่เกินไป' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
});

module.exports = app;
