// Builds the PNG icons used by the manifest, iOS home screen and the in-app logo.
// Source: public/icons/icon-source.(png|webp|jpg) if you made your own (1024x1024, full-bleed, no transparency,
// artwork inside the central 80% so it survives Android's circular mask) — otherwise public/icons/icon.svg.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'icons');
const custom = ['png', 'webp', 'jpg', 'jpeg'].map((e) => path.join(dir, `icon-source.${e}`)).find((p) => fs.existsSync(p));
const src = custom ?? path.join(dir, 'icon.svg');
const input = () => sharp(src, custom ? {} : { density: 300 });

(async () => {
  // palette PNG (quantised, dithered) keeps illustrated icons ~3x smaller with no visible loss; the 192px one is the in-app logo
  const PNG = { compressionLevel: 9, palette: true, quality: 92, effort: 8 };
  for (const size of [192, 512]) await input().resize(size, size).png(PNG).toFile(path.join(dir, `icon-${size}.png`));
  if (custom) {
    // Android may crop the icon to a circle (safe zone = middle 80%) and drawn artwork usually fills more than that, so shrink it
    // onto a gradient built from the artwork's own edge colours (median of each edge strip, so a badge or ear can't skew it),
    // with softly feathered edges so the shrunk picture melts into the background.
    const S = 512;
    const inner = Math.round(S * 0.78);
    const small = await input().resize(256, 256).removeAlpha().raw().toBuffer();
    const median = (pick) => {
      const ch = [[], [], []];
      for (const i of pick) for (let c = 0; c < 3; c++) ch[c].push(small[i * 3 + c]);
      return '#' + ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1].toString(16).padStart(2, '0')).join('');
    };
    const idx = (test) => { const out = []; for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (test(x, y)) out.push(y * 256 + x); return out; };
    const left = median(idx((x) => x < 6)), right = median(idx((x) => x >= 250)), top = median(idx((x, y) => y < 6));
    const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.18">` +
      `<stop offset="0" stop-color="${left}"/><stop offset=".55" stop-color="${top}"/><stop offset="1" stop-color="${right}"/></linearGradient></defs>` +
      `<rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
    const f = 10;
    const feather = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><rect x="${f}" y="${f}" width="${inner - 2 * f}" height="${inner - 2 * f}" rx="${f}" fill="#fff"/></svg>`)).blur(f * 0.6).png().toBuffer();
    const tile = await input().resize(inner, inner).ensureAlpha().composite([{ input: feather, blend: 'dest-in' }]).png().toBuffer();
    await sharp(Buffer.from(bg)).composite([{ input: tile, gravity: 'center' }]).png(PNG).toFile(path.join(dir, 'icon-maskable-512.png'));
  } else {
    // the built-in artwork has rounded corners, so shrink it onto a full-bleed square for the maskable variant
    const inner = await input().resize(360, 360).png().toBuffer();
    await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff8cc2' } })
      .composite([{ input: inner, gravity: 'center' }]).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  }
  console.log(`icons written from ${path.basename(src)}`);
})();
