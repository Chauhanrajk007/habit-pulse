const CACHE_NAME = 'habitpulse-v2.0.4';
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

// CDN assets to cache-first (rarely change)
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

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
  const url = new URL(e.request.url);
  
  // CDN resources: cache-first (Chart.js, fonts — rarely change)
  if (CDN_HOSTS.some(host => url.hostname.includes(host))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // App files: network-first so updates are picked up immediately
  // Falls back to cache for offline support
  e.respondWith(
    fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
