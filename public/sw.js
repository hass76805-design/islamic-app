// Custom Offline-First Service Worker for تسبيح
// Precaches App Shell, Local Fonts, Core Audio (including /audio/azan.mp3) & /offline.html fallback

const SHELL_CACHE = 'alzahabi-app-shell-v1';
const FONT_CACHE = 'alzahabi-fonts-v1';
const IMAGE_CACHE = 'alzahabi-offline-images-v1';
const AUDIO_USER_CACHE = 'audio-cache-v1';
const AUDIO_LEGACY_CACHE = 'alzahabi-offline-audio-v1';
const CORE_DATA_CACHE = 'alzahabi-core-data-v1';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/fonts/fonts.css',
  '/audio/azan.mp3',
  '/audio/adhan-makkah.mp3',
  '/audio/post-adhan-dua.mp3',
  '/audio/pre-chime.mp3',
  '/audio/pre-istighfar.mp3',
  '/audio/pre-takbeer.mp3',
  '/data/quran.json',
  '/data/tafsir.json',
];

try {
  importScripts('/adhan-sw-ext.js');
} catch {
  // extension loaded when available
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL_ASSETS.map(async (assetUrl) => {
          try {
            const res = await fetch(assetUrl, {cache: 'reload'});
            if (res.ok) {
              await cache.put(assetUrl, res);
            }
          } catch {
            // ignore offline install failure for optional assets
          }
        }),
      );
    }),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([
    SHELL_CACHE,
    FONT_CACHE,
    IMAGE_CACHE,
    AUDIO_USER_CACHE,
    AUDIO_LEGACY_CACHE,
    CORE_DATA_CACHE,
    'al-zahabi-scheduled-alerts-v2',
  ]);
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!keep.has(key) && !key.startsWith('workbox-')) {
              return caches.delete(key);
            }
            return Promise.resolve();
          }),
        ),
      ),
      self.clients && self.clients.claim ? self.clients.claim() : Promise.resolve(),
    ]),
  );
});

async function cacheFirst(request, cacheName) {
  const cached = (await caches.open(cacheName).then((c) => c.match(request))) || (await caches.match(request));
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests -> try cache/network and never show white Oops page
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const cachedIndex =
            (await caches.match('/index.html')) ||
            (await caches.match('/')) ||
            (await caches.match(req));
          if (cachedIndex) {
            fetch(req)
              .then((fresh) => {
                if (fresh && fresh.ok) {
                  caches.open(SHELL_CACHE).then((c) => c.put('/index.html', fresh));
                }
              })
              .catch(() => {});
            return cachedIndex;
          }
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            const c = await caches.open(SHELL_CACHE);
            c.put('/index.html', networkRes.clone()).catch(() => {});
            return networkRes;
          }
        } catch {
          // offline fallback below
        }
        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) return offlinePage;
        return new Response('أنت الآن أوفلاين — أعد المحاولة', {
          status: 503,
          headers: {'Content-Type': 'text/plain; charset=utf-8'},
        });
      })(),
    );
    return;
  }

  // Fonts: CacheFirst
  if (
    url.pathname.startsWith('/fonts/') ||
    /\.(?:woff2?|ttf|otf)$/i.test(url.pathname) ||
    url.origin.includes('fonts.g')
  ) {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // Images: CacheFirst
  if (
    req.destination === 'image' ||
    /\.(?:png|jpe?g|svg|webp|ico|gif)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, IMAGE_CACHE));
    return;
  }

  // Audio: prefer audio-cache-v1 -> legacy audio cache -> network
  if (
    req.destination === 'audio' ||
    /\.(?:mp3|m4a|wav|ogg)$/i.test(url.pathname) ||
    url.pathname.startsWith('/audio/')
  ) {
    event.respondWith(
      (async () => {
        const userAudioCache = await caches.open(AUDIO_USER_CACHE);
        const userHit = await userAudioCache.match(req);
        if (userHit) return userHit;

        const legacyHit =
          (await caches.open(AUDIO_LEGACY_CACHE).then((c) => c.match(req))) ||
          (await caches.match(req));
        if (legacyHit) return legacyHit;

        return fetch(req);
      })(),
    );
    return;
  }

  // Core JSON data
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(cacheFirst(req, CORE_DATA_CACHE));
    return;
  }

  // Same-origin App Shell static resources
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        });
      }),
    );
  }
});
