// Retirement worker for the former restaurant site. No fetch interception.
// Only caches from this application's exact legacy namespace are eligible.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const ownedCache = /^donghae-homepage-v\d+$/;
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => ownedCache.test(key)).map(key => caches.delete(key)));
  await self.registration.unregister();
})()));
