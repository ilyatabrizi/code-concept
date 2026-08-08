/* sw.js — offline shell for the Code Concept PWA.
   Cache-first for the app's own assets, network-first for navigations. */
const VERSION = 'cc-06feb0b4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css?v=06feb0b4',
  './assets/js/qr.js?v=06feb0b4',
  './assets/js/data.js?v=06feb0b4',
  './assets/js/store.js?v=06feb0b4',
  './assets/js/ui.js?v=06feb0b4',
  './assets/js/views.js?v=06feb0b4',
  './assets/js/crm.js?v=06feb0b4',
  './assets/js/app.js?v=06feb0b4',
  './assets/fonts/saira-latin.woff2',
  './assets/fonts/michroma-latin.woff2',
  './assets/fonts/IRANYekanXFaNum-Regular.woff2',
  './assets/fonts/IRANYekanXFaNum-Medium.woff2',
  './assets/fonts/IRANYekanXFaNum-Bold.woff2',
  './assets/img/logo-white.png',
  './assets/img/hero.webp',
  './assets/img/room-wide.webp',
  './assets/img/sign.webp',
  './assets/img/space.webp',
  './assets/img/cold.webp',
  './assets/img/desk.webp',
  './assets/img/cup.webp',
  './assets/img/iced.webp',
  './assets/img/flatlay.webp',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: always revalidate the shell against the server, so a redeploy
  // is picked up on the next visit. `cache: 'no-cache'` still allows a cheap 304
  // — it only stops the HTTP cache answering on its own.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Everything else: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
