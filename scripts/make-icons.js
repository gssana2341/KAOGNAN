// Renders public/icons/icon.svg to the PNG sizes needed by the manifest / iOS home screen.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'));

(async () => {
  for (const size of [192, 512]) await sharp(svg, { density: 300 }).resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`));
  // maskable: artwork must sit inside the central 80% safe zone, so shrink it onto a full-bleed pink square
  const inner = await sharp(svg, { density: 300 }).resize(360, 360).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff8cc2' } })
    .composite([{ input: inner, gravity: 'center' }]).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  console.log('icons written');
})();
