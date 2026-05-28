const CACHE_NAME = 'hiking-pwa-v38';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=38',
  './app.js?v=38',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './vendor/sqljs/sql-wasm.js?v=38',
  './vendor/sqljs/sql-wasm.wasm',
  './vendor/leaflet/leaflet.css?v=38',
  './vendor/leaflet/leaflet.js?v=38',
  './sample/demo-route.gpx',
  './sample/rudy-route-z12-z16.mbtiles',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
