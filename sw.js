// sw.js — cache-first app shell so reviewing saved cards works offline.
// AI/dictionary calls go to the network (never cached). Bump CACHE to ship updates.
const CACHE = 'lexikon-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/util.js',
  './js/icons.js',
  './js/store.js',
  './js/scheduler.js',
  './js/ai.js',
  './js/audio.js',
  './js/screens/study.js',
  './js/screens/hazine.js',
  './js/screens/quiz.js',
  './js/screens/decode.js',
  './vendor/ts-fsrs.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // mutations → network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // e.g. api.anthropic.com → never intercept

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
