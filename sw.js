/* Pocket Pong · SAMIX — Service Worker
 * Keeps the game available without internet after the first visit.
 * - index.html (the whole game): network first (new versions show up right away),
 *   falls back to the saved copy when offline or the network is slow.
 * - icons / manifest: cache first.
 * Raise VERSION whenever you publish a new build, so old copies are replaced.
 */
const VERSION = 'samix-pocketpong-v7';
const PAGE = 'index.html';
const EXTRAS = ['manifest.webmanifest', 'favicon.png', 'apple-touch-icon.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // The page is mandatory; the icons are nice-to-have (missing ones must not break the install).
    await cache.add(new Request(PAGE, { cache: 'reload' }));
    await Promise.all(EXTRAS.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('samix-pocketpong-') && k !== VERSION)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

async function pageNetworkFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(PAGE, { ignoreSearch: true });
  try {
    const response = await withTimeout(fetch(request), cached ? 4000 : 30000);
    if (response && response.ok) {
      cache.put(PAGE, response.clone());
      return response;
    }
    if (cached) return cached;
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
