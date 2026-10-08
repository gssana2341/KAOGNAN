// Lists every text that needs an English translation:
//   - client:  t('...') / t("...") calls in public/js (the Thai text is the key)
//   - server:  Thai string literals in the API routes/auth/settings/app (error messages shown to the user)
// Used by `npm run i18n:check` and by the test suite, so a missing translation fails the build.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const THAI = /[\u0E00-\u0E7F]/;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else if (f.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const unescape = (s) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');

function clientKeys() {
  const keys = new Map(); // key -> first file
  for (const file of walk(path.join(root, 'public', 'js'))) {
    if (path.basename(file) === 'icons.js') continue; // generated
    const src = fs.readFileSync(file, 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/^\s*\/\/.*$/gm, ''); // examples in comments aren't keys (only comments that start a line: "image/*" in a string must survive)
    for (const m of src.matchAll(/(?<![\w.$])t\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const key = unescape(m[2]);
      if (!keys.has(key)) keys.set(key, path.relative(root, file));
    }
  }
  return keys;
}

// Thai string literals that the server sends to users. Data/default values are listed in IGNORE.
const SERVER_FILES = ['routes/account.js', 'routes/admin.js', 'routes/attendance.js', 'routes/leaves.js', 'auth.js', 'settings.js', 'app.js'];
const IGNORE = new Set(['บริษัทของฉัน']); // default company name = data, not a message
function serverKeys() {
  const keys = new Map();
  for (const rel of SERVER_FILES) {
    const file = path.join(root, 'server', rel);
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const text = unescape(m[2]);
      if (THAI.test(text) && !text.includes('${') && !IGNORE.has(text)) if (!keys.has(text)) keys.set(text, `server/${rel}`);
    }
  }
  return keys;
}

function allKeys() {
  return new Map([...clientKeys(), ...serverKeys()]);
}

module.exports = { clientKeys, serverKeys, allKeys };

if (require.main === module) {
  const dictPath = path.join(root, 'public', 'js', 'i18n', 'en.json');
  const dict = fs.existsSync(dictPath) ? JSON.parse(fs.readFileSync(dictPath, 'utf8')) : {};
  const keys = allKeys();
  const missing = [...keys].filter(([k]) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  console.log(`${keys.size} texts, ${Object.keys(dict).length} translated`);
  if (missing.length) { console.log(`\nMISSING English (${missing.length}):`); for (const [k, f] of missing) console.log(`  ${JSON.stringify(k)}   (${f})`); }
  if (unused.length) { console.log(`\nUNUSED entries in en.json (${unused.length}):`); for (const k of unused) console.log(`  ${JSON.stringify(k)}`); }
  process.exitCode = missing.length ? 1 : 0;
}
