// Tiny i18n: the Thai text IS the key, so the code stays readable and Thai needs no dictionary at all.
//   t('สแกนเข้างาน')                         -> Thai as written, or the English from /js/i18n/en.json
//   t('สาย {n} นาที', { n: 5 })              -> placeholders
//   "{n} day|{n} days" in en.json            -> singular|plural, picked when params.n is given
// Add a new text: wrap it in t('...') and add "<thai>": "<english>" to public/js/i18n/en.json (npm test fails if one is missing).
const KEY = 'kn_lang';
export const LANGS = { th: 'ไทย', en: 'English' };

let lang = 'th';
let dict = {};

export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-GB' : 'th-TH');

export function t(text, params) {
  let s = lang === 'en' ? (dict[text] ?? text) : text;
  if (params) {
    if (s.includes('|') && params.n !== undefined) {
      const [one, many] = s.split('|');
      s = Number(params.n) === 1 ? one : many;
    }
    s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  }
  return s;
}

async function loadDict() {
  if (lang !== 'en' || Object.keys(dict).length) return;
  try { dict = await (await fetch('/js/i18n/en.json')).json(); } catch { dict = {}; }
}

function apply() {
  document.documentElement.lang = lang;
  document.title = t('KaoNgan · เช็คอินเข้างาน');
}

export async function initLang() {
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'th'; } catch { lang = 'th'; }
  await loadDict();
  apply();
}

export async function setLang(next) {
  if (!LANGS[next] || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  await loadDict();
  apply();
  window.dispatchEvent(new Event('langchange'));
}
