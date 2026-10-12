const CACHE_NAME = 'where-i-left-off-shell-dev';
const PRECACHE = [];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('where-i-left-off-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (new URL(event.request.url).pathname.startsWith('/__/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable');
      // Keep each precached shell immutable: a newer HTML file may reference
      // assets the current worker has not downloaded. Activation switches versions atomically.
      return response;
    }).catch(async () => (await (await caches.open(CACHE_NAME)).match('/index.html', { ignoreVary: true })) || Response.error()));
    return;
  }
  const pathname = new URL(event.request.url).pathname;
  if (PRECACHE.includes(pathname)) event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(pathname, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
});
