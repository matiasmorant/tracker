const CACHE_NAME = 'chronos-v2';
const DATA_CACHE_NAME = 'chronos-data-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './analytics.js',
  './duration-picker-modal.js',
  './series-chart.js',
  './calendar.js',
  './group-manager.js',
  './series-history.js',
  './chart-utils.js',
  './groupcard.js',
  './seriesConfig.js',
  './chronos-chart.js',
  './multiselect.js',
  './db.js',
  './seriecard.js',
  './utils.js',
  './dborm.js',
  './series-chart-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/alpinejs@3.x.x/dist/module.esm.js',
  // 'https://cdn.jsdelivr.net/npm/chart.js',
  // 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns',
  'https://unpkg.com/papaparse@latest/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://unpkg.com/tabulator-tables@5.6.1/dist/css/tabulator_modern.min.css',
  'https://unpkg.com/tabulator-tables@5.6.1/dist/js/tabulator.min.js',
  'https://cdn.jsdelivr.net/npm/date-fns@4.1.0/+esm'
];

// Chronos doesn't use external data files like the example, 
// but we keep the logic for future scalability.
const DATA_ASSETS = [];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Cache-First Strategy for CDN Assets
  const isCDNAsset = CDN_ASSETS.some(asset => event.request.url.includes(asset));
  if (isCDNAsset) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 2. Stale-While-Revalidate Strategy for Core Assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      });
    })
  );
});