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
  if (new URL(event.request.url).pathname.startsWith('/__/') || ['/extension-config.json','/push-config.json'].includes(new URL(event.request.url).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation unavailable');
      // Keep each precached shell immutable: a newer HTML file may reference
      // assets the current worker has not downloaded. Activation switches versions atomically.
      return response;
    }).catch(async () => (await (await caches.open(CACHE_NAME)).match(['/about.html','/privacy.html','/terms.html','/support.html','/extension-privacy.html'].includes(new URL(event.request.url).pathname) ? new URL(event.request.url).pathname : '/index.html', { ignoreVary: true })) || Response.error()));
    return;
  }
  const pathname = new URL(event.request.url).pathname;
  if (PRECACHE.includes(pathname)) event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(pathname, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload
    try { payload = event.data.json() } catch { return }
    const cache = await caches.open('wilo-push-device')
    const owner = await cache.match('/__push_owner')
    if (!owner || await owner.text() !== payload.uid) return
    await self.registration.showNotification(payload.title, {
      body: payload.body, tag: payload.tag, icon: '/notification-empty.png', badge: '/notification-badge.png',
      lang: payload.language || undefined, dir: ['ar', 'he'].includes(payload.language) ? 'rtl' : 'auto',
      data: { url: payload.url, uid: payload.uid },
    })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const data = event.notification.data
    if (data?.uid) {
      const cache = await caches.open('wilo-push-device'), owner = await cache.match('/__push_owner')
      if (!owner || await owner.text() !== data.uid) return
    }
    const path = typeof data?.url === 'string' && /^#\/(personal\/[A-Za-z0-9]{20}|groups\/[A-Za-z0-9]{20}\/[A-Za-z0-9]{20}|settings)$/.test(data.url) ? data.url : '#/resume'
    const target = new URL('/' + path, self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const window = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (window) { await window.navigate(target); return window.focus() }
    return self.clients.openWindow(target)
  })())
})
