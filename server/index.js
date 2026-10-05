const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

require('./db');
const { requireAuth, requirePasswordChanged, requireAdmin } = require('./auth');
const account = require('./routes/account');
const attendance = require('./routes/attendance');
const leaves = require('./routes/leaves');
const admin = require('./routes/admin');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

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

app.get('/healthz', (req, res) => res.type('text').send('ok')); // for hosting health checks

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

const PORT = Number(process.env.PORT) || 3000;
const certDir = path.join(__dirname, '..', 'certs');
const useHttps = fs.existsSync(path.join(certDir, 'key.pem')) && fs.existsSync(path.join(certDir, 'cert.pem'));
const server = useHttps
  ? https.createServer({ key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }, app)
  : http.createServer(app);

server.listen(PORT, () => {
  const proto = useHttps ? 'https' : 'http';
  console.log(`KaoNgan พร้อมใช้งาน (${proto.toUpperCase()})`);
  console.log(`  บนเครื่องนี้:   ${proto}://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs) if (a.family === 'IPv4' && !a.internal) console.log(`  บนมือถือ/เครื่องอื่นในวงเดียวกัน: ${proto}://${a.address}:${PORT}`);
  }
  if (!useHttps) console.log('  หมายเหตุ: กล้องบนมือถือต้องใช้ HTTPS (ดู README) — ถ้ายังไม่ใช้ HTTPS ระบบจะให้ถ่ายรูป QR แทน');
});
