const crypto = require('crypto');

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

module.exports = { makePayload, verifyPayload };
