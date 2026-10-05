// Turns AI-generated mascot pictures into the transparent 512x512 WebP files the app uses.
//
//   Option A — one picture with all four poses in a 2x2 grid (easiest):
//       art-source/mascot/sheet.(png|jpg|jpeg|webp)      order: sleepy happy / bye oops
//   Option B — one picture per pose:
//       art-source/mascot/<state>.(png|jpg|jpeg|webp)    states: sleepy happy bye oops (+ chill, optional)
//
//   run     npm run mascot
//   result  public/img/mascot/<state>.webp  (the app switches from the built-in cat once all 4 exist)
//
// Background removal: the picture should have a plain light background (white is fine) and a dark outline closed all
// around the character. We flood-fill inwards from the picture edges, so white fur *inside* the outline is kept.
// Pictures that already have a transparent background are used as they are.
// Sheet mode also gives every pose the same scale and the same ground line, so the cat doesn't "jump" between poses.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = process.env.MASCOT_SRC || path.join(__dirname, '..', 'art-source', 'mascot');
const OUT = process.env.MASCOT_OUT || path.join(__dirname, '..', 'public', 'img', 'mascot');
const STATES = ['sleepy', 'happy', 'bye', 'oops', 'chill'];
const SHEET_GRID = ['sleepy', 'happy', 'bye', 'oops']; // row by row
const TOLERANCE = Number(process.env.TOLERANCE || 38); // how far a pixel may differ from the background colour (0-441)
const SIZE = 512;
const PAD = 0.05; // empty margin around the character

const dist = (d, i, [r, g, b]) => Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);
const find = (name) => ['png', 'jpg', 'jpeg', 'webp'].map((e) => path.join(SRC, `${name}.${e}`)).find((p) => fs.existsSync(p));

function backgroundColour(d, w, h) {
  const samples = [];
  for (let x = 0; x < w; x += Math.max(1, w >> 5)) samples.push(x * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += Math.max(1, h >> 5)) samples.push(y * w * 4, (y * w + w - 1) * 4);
  const med = (c) => { const v = samples.map((i) => d[i + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  return [med(0), med(1), med(2)];
}

// Makes the background transparent (in place) and returns { removed }.
function removeBackground(d, w, h) {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => d[p * 4 + 3]);
  if (corners.every((a) => a < 250)) return { removed: false }; // already transparent

  const bg = backgroundColour(d, w, h);
  const isBg = new Uint8Array(w * h);
  const queue = [];
  const push = (p) => { if (!isBg[p] && dist(d, p * 4, bg) <= TOLERANCE) { isBg[p] = 1; queue.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (queue.length) {
    const p = queue.pop();
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  // soft edge: pixels touching the background fade by how close they are to it (no hard jaggies / white halo)
  for (let p = 0; p < w * h; p++) {
    if (isBg[p]) { d[p * 4 + 3] = 0; continue; }
    const x = p % w;
    const touches = (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (p >= w && isBg[p - w]) || (p < w * (h - 1) && isBg[p + w]);
    if (touches) d[p * 4 + 3] = Math.round(255 * Math.min(1, dist(d, p * 4, bg) / (TOLERANCE * 2.2)));
  }
  return { removed: true };
}

function boundingBox(d, w, h) {
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// source (file path or Buffer, optionally a region) -> { data, w, h, box, removed }
async function cutOut(input, region) {
  let img = sharp(input).ensureAlpha();
  if (region) img = img.extract(region);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { removed } = removeBackground(data, info.width, info.height);
  const box = boundingBox(data, info.width, info.height);
  if (!box) throw new Error('ไม่เหลืออะไรหลังลบพื้นหลัง — ลองลด TOLERANCE เช่น TOLERANCE=25 npm run mascot');
  return { data, w: info.width, h: info.height, box, removed };
}

// scale: pixels of the source -> pixels of the output; align: 'center' (single pictures) or 'bottom' (sheet poses)
async function save(cut, state, scale, align) {
  const bw = Math.max(1, Math.round(cut.box.width * scale));
  const bh = Math.max(1, Math.round(cut.box.height * scale));
  const piece = await sharp(cut.data, { raw: { width: cut.w, height: cut.h, channels: 4 } })
    .extract(cut.box).resize(bw, bh, { fit: 'fill' }).png().toBuffer();
  const left = Math.round((SIZE - bw) / 2);
  const top = align === 'bottom' ? Math.round(SIZE * (1 - PAD) - bh) : Math.round((SIZE - bh) / 2);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(OUT, `${state}.webp`));
}

const fit = (box) => Math.min((SIZE * (1 - PAD * 2)) / box.width, (SIZE * (1 - PAD * 2)) / box.height);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SRC, { recursive: true });
  const done = [];

  // Option A: 2x2 sheet (fills every pose that has no picture of its own)
  const sheet = find('sheet');
  if (sheet) {
    const meta = await sharp(sheet).metadata();
    const [cw, ch] = [Math.floor(meta.width / 2), Math.floor(meta.height / 2)];
    const cuts = [];
    for (const [i, state] of SHEET_GRID.entries()) {
      if (find(state)) continue;
      const cut = await cutOut(sheet, { left: (i % 2) * cw, top: Math.floor(i / 2) * ch, width: cw, height: ch });
      cuts.push([state, cut]);
    }
    if (cuts.length) {
      const maxW = Math.max(...cuts.map(([, c]) => c.box.width));
      const maxH = Math.max(...cuts.map(([, c]) => c.box.height));
      const scale = Math.min((SIZE * (1 - PAD * 2)) / maxW, (SIZE * (1 - PAD * 2)) / maxH); // one scale for every pose
      for (const [state, cut] of cuts) {
        await save(cut, state, scale, 'bottom');
        console.log(`  ${state}: sheet ${path.basename(sheet)} -> ${state}.webp (${cut.removed ? 'background removed' : 'kept transparency'})`);
        done.push(state);
      }
    }
  }

  // Option B: one picture per pose
  for (const state of STATES) {
    const file = find(state);
    if (!file) continue;
    const cut = await cutOut(file);
    await save(cut, state, fit(cut.box), 'center');
    console.log(`  ${state}: ${path.basename(file)} -> ${state}.webp (${cut.removed ? 'background removed' : 'kept transparency'})`);
    done.push(state);
  }

  if (!done.length) {
    console.log(`ไม่พบรูปใน ${path.relative(process.cwd(), SRC)} — วาง sheet.png (รูปรวม 4 ท่า 2×2) หรือ sleepy / happy / bye / oops (.png .jpg .webp) ที่นั่นก่อน`);
    return;
  }
  const missing = STATES.slice(0, 4).filter((s) => !fs.existsSync(path.join(OUT, `${s}.webp`)));
  console.log(missing.length
    ? `\nยังไม่ครบ 4 ท่า (ขาด: ${missing.join(', ')}) — ระบบจะใช้แมวในตัวต่อไปจนกว่าจะครบ`
    : '\nครบ 4 ท่าแล้ว — รีเฟรชหน้าเว็บ แมวใหม่จะแทนตัวเดิมทั้งแอป');
})().catch((e) => { console.error(e.message); process.exit(1); });
