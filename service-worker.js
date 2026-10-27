const CACHE_NAME = 'smart-lamp-shell-v5';
const APP_SHELL = ['./', './index.html', './manifest.json', './sketch.js', './icon-192.png', './icon-512.png'];
const P5_URL = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 'reload' - обходить HTTP-кеш браузера й GitHub Pages, щоб завжди брати свіжі файли
    await Promise.all(APP_SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    try { await cache.add(P5_URL); } catch (e) {} // бібліотека кешується одразу, але без неї установка не падає
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('smart-lamp-') && k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => {
          if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)); }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Файли застосунку: спочатку мережа (завжди свіжа версія), кеш - лише без інтернету
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => {
          if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, copy)); }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return response;
      });
      if (cached) { network.catch(() => {}); return cached; }
      return network;
    })
  );
});
