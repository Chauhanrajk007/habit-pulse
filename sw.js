const CACHE_NAME = 'habitpulse-v1';
const ASSETS = [
  './',
  './index.html',
  './css/design-system.css',
  './css/components.css',
  './css/animations.css',
  './css/pages.css',
  './js/app.js',
  './js/ui.js',
  './js/logic.js',
  './js/storage.js',
  './js/charts.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
