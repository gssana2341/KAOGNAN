const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Used when the username doesn't exist so that response time doesn't reveal valid usernames.
const DUMMY = hashPassword('dummy-password');

function verifyPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored || DUMMY).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH: DUMMY };
