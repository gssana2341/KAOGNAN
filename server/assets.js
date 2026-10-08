// Discovers art dropped into public/ so new backgrounds / mascot images need no code change.
//   public/bg/<id>.(svg|webp|png|jpg|avif)   + optional entry in public/bg/backgrounds.json (name, mode, tile, thumb)
//   public/img/mascot/<state>.(webp|png|svg)  states: sleepy, happy, bye, oops (all four needed to replace the built-in cat) + optional chill (on leave)
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const BG_RE = /^([A-Za-z0-9_-]{1,40})\.(svg|webp|png|jpe?g|avif)$/i;
const MASCOT_STATES = ['sleepy', 'happy', 'bye', 'oops'];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function listBackgrounds() {
  const dir = path.join(PUBLIC, 'bg');
  const meta = readJson(path.join(dir, 'backgrounds.json'));
  const found = new Map();
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const m = BG_RE.exec(f);
    if (m && !found.has(m[1])) found.set(m[1], f);
  }
  const ids = [...Object.keys(meta).filter((id) => found.has(id)), ...[...found.keys()].filter((id) => !(id in meta)).sort()];
  return ids.map((id) => {
    const m = meta[id] || {};
    return {
      id,
      name: String(m.name || id),
      name_en: String(m.name_en || m.name || id),
      file: `/bg/${found.get(id)}`,
      mode: m.mode === 'tile' ? 'tile' : 'cover',
      tile: Number(m.tile) > 0 ? Number(m.tile) : 240,
      thumb: typeof m.thumb === 'string' ? m.thumb : null,
    };
  });
}

const findMascot = (s) => ['webp', 'png', 'svg'].map((ext) => `${s}.${ext}`).find((n) => fs.existsSync(path.join(PUBLIC, 'img', 'mascot', n)));

function mascotImages() {
  const out = {};
  for (const s of MASCOT_STATES) {
    const f = findMascot(s);
    if (!f) return null; // partial sets would look inconsistent next to the built-in cat
    out[s] = `/img/mascot/${f}`;
  }
  const chill = findMascot('chill'); // optional: pose used on leave days, falls back to "happy"
  if (chill) out.chill = `/img/mascot/${chill}`;
  return out;
}

module.exports = { listBackgrounds, mascotImages };
