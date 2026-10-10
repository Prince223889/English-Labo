/* Small, dependency-free service worker: app shell is cached; PDFs are cached on demand. */
const CACHE_NAME = 'english-arena-shell-v1';
const PDF_CACHE = 'english-arena-documents-v1';
const BASE_URL = new URL('./', self.registration.scope);
const SHELL = [
  './', './index.html', './css/styles.css', './js/config.js', './js/data.js',
  './js/boot.js', './js/cloud.js', './js/voice.js', './js/data-extra.js', './js/badges.js', './js/mascot.js', './js/simulation.js', './js/games.js', './js/duel.js', './js/app.js', './manifest.webmanifest', './assets/icons/icon.svg',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL.map(p => new URL(p, BASE_URL).href))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![CACHE_NAME, PDF_CACHE].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Never cache third-party services/resources.
  const isPDF = url.pathname.toLowerCase().endsWith('.pdf');
  if (isPDF) {
    event.respondWith(caches.open(PDF_CACHE).then(async cache => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try { const response = await fetch(req); if (response.ok) cache.put(req, response.clone()); return response; }
      catch (err) { return new Response('Ce PDF n’a pas encore été ouvert sur cet appareil. Reconnecte-toi une fois pour le télécharger.', {status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'}}); }
    }));
    return;
  }
  if (url.pathname.endsWith('/admin.html')) return; // admin page always goes to the network
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(c=>c.put(new URL('./index.html',BASE_URL).href,copy)); return response; }).catch(async () => (await caches.match(new URL('./index.html',BASE_URL).href)) || caches.match(new URL('./',BASE_URL).href)));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => { if(response.ok) caches.open(CACHE_NAME).then(cache=>cache.put(req,response.clone())); return response; })));
});

