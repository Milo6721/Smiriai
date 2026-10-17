/* Smiri — prosty service worker: sieć najpierw (zawsze świeża wersja), pamięć podręczna jako zapas offline. */
const CACHE = 'smiri-shell-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;   // API zawsze przez sieć
  e.respondWith((async () => {
    try { const res = await fetch(r); if (res.ok) (await caches.open(CACHE)).put(r, res.clone()); return res; }
    catch { const hit = await caches.match(r); if (hit) return hit; if (r.mode === 'navigate') { const idx = await caches.match('/'); if (idx) return idx; } throw new Error('offline'); }
  })());
});
