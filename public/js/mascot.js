// Little cat mascot. State changes the face so the home screen feels alive.
//   sleepy -> before check-in   happy -> at work   bye -> after check-out   oops -> something went wrong
const INK = '#5a4150';

const EYES = {
  sleepy: `<path d="M34 64 h16 M70 64 h16" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  happy: `<path d="M34 66 q8 -12 16 0 M70 66 q8 -12 16 0" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  oops: `<circle cx="42" cy="64" r="6" fill="${INK}"/><circle cx="78" cy="64" r="6" fill="${INK}"/>
         <circle cx="44" cy="62" r="2" fill="#fff"/><circle cx="80" cy="62" r="2" fill="#fff"/>`,
};
EYES.bye = EYES.happy;

const MOUTH = {
  sleepy: `<circle cx="60" cy="80" r="3.4" fill="none" stroke="${INK}" stroke-width="3"/>`,
  happy: `<path d="M50 76 q10 14 20 0 z" fill="#ff8fa8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  oops: `<path d="M52 84 q8 -8 16 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
MOUTH.bye = `<path d="M52 76 q8 9 16 0" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;

const EXTRA = {
  sleepy: `<text x="92" y="26" font-size="16" font-weight="700" fill="#9aa8ff" font-family="Mali,sans-serif">z</text>
           <text x="102" y="14" font-size="11" font-weight="700" fill="#b9c3ff" font-family="Mali,sans-serif">z</text>`,
  happy: `<path d="M16 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z M102 20 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#ffd95e"/>`,
  bye: `<g class="wave"><ellipse cx="108" cy="78" rx="9" ry="12" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
         <path d="M105 74 v6 M111 74 v6" stroke="#ffb3cf" stroke-width="2.4" stroke-linecap="round"/></g>`,
  oops: `<path d="M96 40 q5 8 0 12 q-5 -4 0 -12z" fill="#8ecbff" stroke="#5aa6e6" stroke-width="1.5"/>`,
};

export function mascot(state = 'happy', size = 120) {
  return `<svg class="mascot ${state}" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="แมวน้อย">
    <path d="M20 46 L24 10 L52 30z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M100 46 L96 10 L68 30z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M27 34 L28 20 L40 29z M93 34 L92 20 L80 29z" fill="#ffb3cf"/>
    <ellipse cx="60" cy="68" rx="46" ry="38" fill="#fff" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="29" cy="76" rx="8" ry="5" fill="#ffb3cf" opacity=".85"/><ellipse cx="91" cy="76" rx="8" ry="5" fill="#ffb3cf" opacity=".85"/>
    ${EYES[state] ?? EYES.happy}
    <path d="M57 71 h6 l-3 3.6z" fill="#ff8fa8"/>
    ${MOUTH[state] ?? MOUTH.happy}
    <path d="M8 66 l14 3 M8 78 l14 -2 M112 66 l-14 3 M112 78 l-14 -2" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    ${EXTRA[state] ?? ''}
  </svg>`;
}
