// Service Worker for PWA functionality
const CACHE_NAME = 'credit-tracker-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './utils.js',
  './modals.js',
  './render.js',
  './calculations.js',
  './theme-import-export.js',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/modals.css',
  './styles/utilities.css',
  './icon-home.png',
  './icon-cards.png',
  './icon-settings.png',
  './icon-add.png',
  './icon-budget.png',
  './icon-debt.png',
  './icon-available.png',
  './icon-limit.png',
  './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});