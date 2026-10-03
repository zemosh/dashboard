/* Cache verzuj při každé změně souborů: */
const VERSION = 'v3';
const SHELL = 'shell-' + VERSION;
const RUNTIME = 'runtime-' + VERSION;

const SHELL_FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/land.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Mapové a radarové dlaždice a OAuth nikdy necachujeme: dlaždic jsou tisíce
     a mezipaměť by rostla bez omezení. */
  const NO_CACHE = ['rainviewer', 'arcgisonline', 'openstreetmap', 'cartocdn', 'accounts.google', 'googleapis.com/calendar'];
  if (NO_CACHE.some(h => (url.hostname + url.pathname).includes(h))) return;

  /* Vlastní soubory: ze sítě, ale s okamžitým fallbackem na cache.
     Ukládat jen skutečné soubory (ok + basic). Po vypršení přihlášení vrací
     server přesměrování na auth.zemosh.cz a to se do cache dostat nesmí. */
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok && res.type === 'basic' && !res.redirected) {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  /* Cizí zdroje (fonty, knihovny, počasí): cache jako záloha při výpadku. */
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || Response.error()))
  );
});
