// Dark theme switch. The stylesheet only looks at <html data-theme="dark">; this decides when that is set.
//   auto (default): dark when the device is in dark mode, or when the starry-night background is picked
//   light / dark:   forced from the Me page
// js/theme-boot.js makes the same decision before the first paint — keep the two in sync.
const KEY = 'kn_theme';
export const THEME_PREFS = ['auto', 'light', 'dark'];
const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

let chosen = null; // this visit's choice: keeps working when the browser blocks storage (the login token has the same fallback)

export const getThemePref = () => {
  if (chosen) return chosen;
  try { const v = localStorage.getItem(KEY); return THEME_PREFS.includes(v) ? v : 'auto'; } catch { return 'auto'; }
};

export const deviceIsDark = () => !!media?.matches;

export const isDark = (pref = getThemePref()) => (pref === 'dark' ? true : pref === 'light' ? false : deviceIsDark() || document.documentElement.dataset.bg === 'night');

export function applyTheme() {
  const dark = isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2b2140' : '#ff8cc2'); // browser bar colour on phones
}

export function setThemePref(pref) {
  if (!THEME_PREFS.includes(pref)) return;
  chosen = pref;
  try { localStorage.setItem(KEY, pref); } catch { /* storage blocked: applies for this visit only */ }
  applyTheme();
}

media?.addEventListener?.('change', applyTheme);
applyTheme();
