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
  for (const size of [192, 512]) await input().resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`));
  if (custom) {
    await input().resize(512, 512).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  } else {
    // the built-in artwork has rounded corners, so shrink it onto a full-bleed square for the maskable variant
    const inner = await input().resize(360, 360).png().toBuffer();
    await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff8cc2' } })
      .composite([{ input: inner, gravity: 'center' }]).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  }
  console.log(`icons written from ${path.basename(src)}`);
})();
