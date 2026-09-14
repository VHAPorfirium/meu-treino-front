// Service worker — cacheia o app shell p/ abrir offline + recebe Web Push (E6).
// Chamadas à API NÃO são cacheadas nem interceptadas: a fila offline (E5) vive na página
// (lib/offline/queue.ts), porque Safari/iOS não tem Background Sync.
const CACHE = 'meu-treino-v2';
const APP_SHELL = ['/', '/login', '/treino', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // não intercepta a API
  if (url.pathname.startsWith('/api')) return;

  // navegação: network-first, cai pro cache offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // estáticos: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

// ── Web Push (E6) ─────────────────────────────────────────────────────────────
// payload: { title, body, url }
self.addEventListener('push', (event) => {
  let data = { title: 'Ritmo', body: '', url: '/treino' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* payload vazio/inválido → usa defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
      vibrate: [120, 60, 120],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/treino';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
