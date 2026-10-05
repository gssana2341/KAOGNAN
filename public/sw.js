// Minimal service worker: lets the app open offline (shell only — check-in itself needs the server).
// Pages/scripts: network first, fall back to cache. Static art (fonts, backgrounds, icons): stale-while-revalidate. API: never cached.
const CACHE = 'kaongan-v2';
const SHELL = ['/', '/css/app.css', '/css/fonts.css', '/js/main.js', '/config.js', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  const staticArt = /^\/(fonts|bg|icons|vendor)\//.test(url.pathname);
  if (staticArt) {
    // stale-while-revalidate: instant from cache, refreshed in the background (so replaced art shows up next visit)
    e.respondWith(caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      });
      return hit || fresh;
    }));
    return;
  }
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
});
