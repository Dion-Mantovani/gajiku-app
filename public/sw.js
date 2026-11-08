// Service worker Gajiku
// Cache app shell + aset statis agar aplikasi tetap bisa dibuka saat offline.

const CACHE_NAME = 'gajiku-v1';

const PRECACHE_URLS = [
  '/',
  '/calendar/',
  '/settings/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // allSettled: satu URL gagal tidak membatalkan seluruh instalasi
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function normalizePath(pathname) {
  if (pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

async function matchNavigation(request) {
  const direct = await caches.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  const normalized = await caches.match(normalizePath(url.pathname));
  if (normalized) return normalized;

  return (await caches.match('/')) || (await caches.match('/offline.html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigasi: selalu coba jaringan dulu agar data terbaru, fallback ke cache
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        } catch {
          return matchNavigation(request);
        }
      })()
    );
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isFont) return;

  // Aset: cache dulu, lalu perbarui di belakang
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      const network = fetch(request)
        .then(async (response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })()
  );
});
