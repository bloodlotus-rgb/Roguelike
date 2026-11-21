/*
 * The game offline: everything it loads is kept in a cache. The page itself is always
 * asked of the network first (so a new version arrives as soon as there is signal), and
 * falls back to the cache; files with a hash in their name never change, so they come
 * from the cache first.
 */
const CACHE = 'estirpe-v1';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const store = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  };
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(store).catch(() => caches.match(request).then((hit) => hit || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then(store)));
});
