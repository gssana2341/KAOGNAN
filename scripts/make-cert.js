// Creates a self-signed HTTPS certificate in ./certs so phones on the same Wi-Fi can use the live camera.
// (Browsers only allow camera access on HTTPS or localhost.) Needs `openssl` on PATH — it ships with Git for Windows.
// For real deployment use a proper certificate (Cloudflare Tunnel, Caddy, nginx + Let's Encrypt, ...).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = path.join(__dirname, '..', 'certs');
fs.mkdirSync(dir, { recursive: true });

const ips = Object.values(os.networkInterfaces()).flat().filter((a) => a.family === 'IPv4' && !a.internal).map((a) => `IP:${a.address}`);
const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips].join(',');
const cfg = path.join(dir, 'openssl.cnf');
fs.writeFileSync(cfg, `[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=KaoNgan\n[ext]\nsubjectAltName=${san}\n`);

execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem'), '-config', cfg], { stdio: 'inherit' });
fs.rmSync(cfg);
console.log(`\nสร้างใบรับรองแล้ว (ครอบคลุม ${san})\nรันเซิร์ฟเวอร์ใหม่ (npm start) แล้วเปิด https://<ไอพีเครื่องนี้>:3000 บนมือถือ — ครั้งแรกให้กด “ขั้นสูง → ดำเนินการต่อ”`);
