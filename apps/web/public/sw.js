const CACHE = 'zync-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (
    e.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/uploads/')
  ) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Handle push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { return; }

  e.waitUntil(
    self.registration.showNotification(payload.title || 'Zync', {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-96.png',
      tag: payload.tag || 'message',
      renotify: true,
      requireInteraction: payload.requireInteraction || false,
      vibrate: payload.vibrate || [200],
      actions: payload.actions || [],
      data: payload.data || {},
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NOTIFICATION_CLICK', action: e.action, data });
      } else {
        clients.openWindow('/');
      }
    })
  );
});
