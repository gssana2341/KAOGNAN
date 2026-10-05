// Starts the app as a normal long-running server (local dev, VPS, Docker). On Vercel see api/[...path].js instead.
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const { ready, MODE } = require('./db');
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const certDir = path.join(__dirname, '..', 'certs');
const useHttps = fs.existsSync(path.join(certDir, 'key.pem')) && fs.existsSync(path.join(certDir, 'cert.pem'));
const server = useHttps
  ? https.createServer({ key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }, app)
  : http.createServer(app);

ready.then(() => {
  server.listen(PORT, () => {
    const proto = useHttps ? 'https' : 'http';
    console.log(`KaoNgan พร้อมใช้งาน (${proto.toUpperCase()}, ฐานข้อมูล: ${MODE === 'turso' ? 'Turso' : 'ไฟล์ SQLite ในเครื่อง'})`);
    console.log(`  บนเครื่องนี้:   ${proto}://localhost:${PORT}`);
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) if (a.family === 'IPv4' && !a.internal) console.log(`  บนมือถือ/เครื่องอื่นในวงเดียวกัน: ${proto}://${a.address}:${PORT}`);
    }
    if (!useHttps) console.log('  หมายเหตุ: กล้องบนมือถือต้องใช้ HTTPS (ดู README) — ถ้ายังไม่ใช้ HTTPS ระบบจะให้ถ่ายรูป QR แทน');
  });
}).catch((e) => {
  console.error('เริ่มระบบไม่สำเร็จ:', e.message);
  process.exit(1);
});
