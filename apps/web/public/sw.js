// Minimal service worker - required for PWA install, no aggressive caching
const CACHE_NAME = 'zync-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  // Clear all old caches
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// No fetch interception - all requests go directly to network
// This prevents double requests and cache-related lag
