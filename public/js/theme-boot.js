// Runs before the first paint (plain blocking script in <head>) so a dark theme never flashes light.
// Same decision as js/theme.js — keep the two in sync: dark when forced, or (auto) when the device is in dark mode / the starry-night background is picked.
(function () {
  try {
    var pref = localStorage.getItem('kn_theme');
    var bg = localStorage.getItem('kn_bg') || 'sky';
    var dark = pref === 'dark' || (pref !== 'light' && ((window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) || bg === 'night'));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.bg = bg;
  } catch (e) { /* storage blocked: the stylesheet's light theme is the fallback */ }
})();
