// Cat mascot. Face + props change with the state so the home screen feels alive.
//   sleepy -> not checked in yet   happy -> at work   bye -> checked out   oops -> error   chill -> on leave
// If public/img/mascot/{sleepy,happy,bye,oops}.(webp|png|svg) all exist they replace this drawing (see docs/image-prompts.md).
import { assets } from './assets.js';

const INK = '#4a3548';
let uid = 0;

const eyesOpen = (cx) => `<ellipse cx="${cx}" cy="68" rx="6.5" ry="8.2" fill="${INK}"/><circle cx="${cx - 2}" cy="65" r="2.7" fill="#fff"/><circle cx="${cx + 2.4}" cy="71.5" r="1.4" fill="#fff"/>`;

const FACE = {
  sleepy: `<path d="M41 68 q9 8 18 0 M81 68 q9 8 18 0" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
           <circle cx="70" cy="85" r="3" fill="none" stroke="${INK}" stroke-width="2.6"/>`,
  happy: `${eyesOpen(51)}${eyesOpen(89)}
          <path d="M61 81 q9 12 18 0z" fill="#ff8fa8" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`,
  bye: `<path d="M43 71 q8 -11 16 0 M81 71 q8 -11 16 0" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
        <path d="M62 81 q8 8 16 0" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  oops: `<circle cx="51" cy="69" r="5.5" fill="${INK}"/><circle cx="89" cy="69" r="5.5" fill="${INK}"/><circle cx="49.5" cy="67" r="1.8" fill="#fff"/><circle cx="87.5" cy="67" r="1.8" fill="#fff"/>
         <path d="M42 56 l14 4 M98 56 l-14 4" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>
         <path d="M61 86 q3 -5 6 0 q3 5 6 0 q3 -5 6 0" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none" transform="translate(-4 0)"/>`,
  chill: `<rect x="37" y="60" width="28" height="17" rx="7" fill="${INK}"/><rect x="75" y="60" width="28" height="17" rx="7" fill="${INK}"/><path d="M65 66 h10" stroke="${INK}" stroke-width="3"/>
          <path d="M42 64 l6 -0.5 M80 64 l6 -0.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
          <path d="M60 83 q10 9 20 0" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
};

const EXTRA = {
  sleepy: `<text x="108" y="30" font-size="17" font-weight="700" fill="#9aa8ff" font-family="Mali,sans-serif">z</text><text x="120" y="17" font-size="12" font-weight="700" fill="#b9c3ff" font-family="Mali,sans-serif">z</text>`,
  happy: `<path d="M14 30 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4z M124 22 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8z" fill="#ffd95e"/>`,
  oops: `<path d="M112 46 q6 9 0 14 q-6 -5 0 -14z" fill="#9fd4ff" stroke="#5aa6e6" stroke-width="1.6"/>`,
};

export function mascot(state = 'happy', size = 120) {
  if (assets.mascot) {
    const src = assets.mascot[state] ?? assets.mascot.happy;
    // pictures carry empty margin (sparkles, effects), so draw them a bit larger than the built-in cat at the same "size"
    const px = Math.round(size * 1.18);
    return `<img class="mascot img ${state}" src="${src}" width="${px}" height="${px}" alt="" decoding="async">`;
  }
  const id = `m${uid++}`;
  const bye = state === 'bye';
  const arm = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="11.5" transform="rotate(${rot} ${x} ${y})" fill="#fff" stroke="${INK}" stroke-width="3.2"/>`;
  return `<svg class="mascot ${state}" viewBox="0 0 140 150" width="${size}" height="${size * 150 / 140}" role="img" aria-label="แมวน้อย">
    <defs>
      <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff0f7"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#f1ebff"/></linearGradient>
    </defs>
    <path d="M100 134 C130 136 136 108 120 100" stroke="${INK}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <path d="M100 134 C130 136 136 108 120 100" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M42 130 q0 -28 28 -28 q28 0 28 28 q0 18 -28 18 q-28 0 -28 -18z" fill="url(#${id}b)" stroke="${INK}" stroke-width="3.4"/>
    <ellipse cx="70" cy="128" rx="14" ry="12" fill="#ffeef6"/>
    <ellipse cx="55" cy="146" rx="11" ry="5.5" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="85" cy="146" rx="11" ry="5.5" fill="#fff" stroke="${INK}" stroke-width="3"/>
    ${arm(48, 120, 14)}${bye ? '' : arm(92, 120, -14)}
    <path d="M26 54 L28 14 L61 34z" fill="#fff" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M114 54 L112 14 L79 34z" fill="#fff" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M33 43 L33 24 L49 34z M107 43 L107 24 L91 34z" fill="#ffb7d1"/>
    <ellipse cx="70" cy="66" rx="50" ry="42" fill="url(#${id}h)" stroke="${INK}" stroke-width="3.4"/>
    <path d="M70 26 v9 M58 28 l2 8 M82 28 l-2 8" stroke="#cfc5f7" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="39" cy="79" rx="9" ry="5.5" fill="#ff9fc0" opacity=".55"/><ellipse cx="101" cy="79" rx="9" ry="5.5" fill="#ff9fc0" opacity=".55"/>
    ${FACE[state] ?? FACE.happy}
    <path d="M66 75 h8 l-4 4.4z" fill="#ff7ea3"/>
    <path d="M12 68 l18 4 M12 80 l18 -2 M128 68 l-18 4 M128 80 l-18 -2" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <g transform="translate(103 41)"><path d="M-12 -7 l10 7 -10 7z M12 -7 l-10 7 10 7z" fill="#ff6fae" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><circle r="4.2" fill="#ff9ac4" stroke="${INK}" stroke-width="2.6"/></g>
    ${bye ? `<g class="wave"><ellipse cx="119" cy="92" rx="8.5" ry="14" transform="rotate(-18 119 92)" fill="#fff" stroke="${INK}" stroke-width="3.2"/><path d="M116 88 v7 M122 87 v7" stroke="#ffb7d1" stroke-width="2.4" stroke-linecap="round"/></g>` : ''}
    ${EXTRA[state] ?? ''}
  </svg>`;
}
