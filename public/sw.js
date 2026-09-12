// Service worker mínimo — cacheia o app shell p/ abrir offline.
// Chamadas à API NÃO são cacheadas (dados sempre frescos quando há rede).
const CACHE = 'meu-treino-v1';
const APP_SHELL = ['/', '/login', '/manifest.webmanifest', '/icons/icon-192.png'];

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
