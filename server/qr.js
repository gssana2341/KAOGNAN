const crypto = require('crypto');
const QRCode = require('qrcode');

// Payload format: KN1:<window>:<mac>
//  static   -> window is 0, the same QR forever (until the admin regenerates the secret)
//  rotating -> window = floor(unixSeconds / period); the current and previous window are accepted
const mac = (secret, label) => crypto.createHmac('sha256', secret).update(label).digest('hex').slice(0, 24);

function makePayload(s, now = Date.now()) {
  if (s.qr_mode === 'rotating') {
    const sec = Math.floor(now / 1000);
    const w = Math.floor(sec / s.qr_rotate_sec);
    return { payload: `KN1:${w}:${mac(s.qr_secret, 'r' + w)}`, expires_in: s.qr_rotate_sec - (sec % s.qr_rotate_sec) };
  }
  return { payload: `KN1:0:${mac(s.qr_secret, 'static')}`, expires_in: null };
}

function verifyPayload(s, str, now = Date.now()) {
  const m = /^KN1:(\d{1,12}):([0-9a-f]{24})$/.exec(String(str ?? '').trim());
  if (!m) return false;
  const w = Number(m[1]);
  let expected;
  if (s.qr_mode === 'rotating') {
    const cur = Math.floor(now / 1000 / s.qr_rotate_sec);
    if (w < cur - 1 || w > cur) return false;
    expected = mac(s.qr_secret, 'r' + w);
  } else {
    if (w !== 0) return false;
    expected = mac(s.qr_secret, 'static');
  }
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(expected));
}

// Draws the QR ourselves (instead of qrcode's stroke-based SVG) as filled row runs. The client scales it by a whole number
// of device pixels per module (data-modules = modules per side incl. quiet zone) so edges never come out uneven.
function renderSvg(text, margin = 2) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const total = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!modules.get(r, c)) { c++; continue; }
      const start = c;
      while (c < n && modules.get(r, c)) c++;
      d += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" data-modules="${total}" shape-rendering="crispEdges" role="img" aria-label="QR">`
    + `<rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#3b2a3f" stroke="#3b2a3f" stroke-width=".03"/></svg>`;
}

module.exports = { makePayload, verifyPayload, renderSvg };
