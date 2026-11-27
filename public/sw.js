// Custom Offline-First Service Worker for تسبيح
// Precaches App Shell, Local Fonts, Core Audio (including /audio/azan.mp3) & /offline.html fallback

const PRECACHE = 'tasbih-precache-v3';
const SHELL_CACHE = 'alzahabi-app-shell-v2';
const FONT_CACHE = 'alzahabi-fonts-v1';
const IMAGE_CACHE = 'alzahabi-offline-images-v1';
const AUDIO_USER_CACHE = 'audio-cache-v1';
const AUDIO_LEGACY_CACHE = 'alzahabi-offline-audio-v1';
const CORE_DATA_CACHE = 'alzahabi-core-data-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-1024x1024.png',
  '/pwa-maskable-512x512.png',
  '/fonts/fonts.css',
  '/audio/splash-alafasy.mp3',
  '/audio/azan.mp3',
  '/audio/post-adhan-dua.mp3',
  '/audio/pre-chime.mp3',
  '/audio/pre-beep-soft.mp3',
  '/audio/pre-beep-double.mp3',
  '/adhan.js',
  '/adhan-sounds/makkah.mp3',
  '/adhan-sounds/ahmed-naina.mp3',
  '/adhan-sounds/khalid-aljalil.mp3',
  '/adhan-sounds/mishary-alafasy.mp3',
  '/adhan-sounds/egyptian.mp3',
];

const OPTIONAL_SHELL_ASSETS = [
  '/audio/adhan-makkah.mp3',
  '/audio/iqamah-makkah.mp3',
  '/audio/iqamah-madinah.mp3',
  '/audio/iqamah-haram.mp3',
  '/data/quran.json',
  '/data/tafsir.json',
];

try {
  importScripts('/adhan-sw-ext.js', '/adhan-sw.js');
} catch {
  // extension loaded when available
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const precache = await caches.open(PRECACHE);
      const shellCache = await caches.open(SHELL_CACHE);

      // Guaranteed precache for core offline navigation routes: '/', '/index.html', '/offline.html'
      await Promise.allSettled(
        PRECACHE_URLS.map(async (assetUrl) => {
          try {
            const res = await fetch(assetUrl, {cache: 'reload'});
            if (res && res.ok) {
              await precache.put(assetUrl, res.clone());
              await shellCache.put(assetUrl, res);
            }
          } catch {
            // ignore offline fetch failure during install
          }
        }),
      );

      // Warm optional shell/audio assets in background without blocking install
      Promise.allSettled(
        OPTIONAL_SHELL_ASSETS.map(async (assetUrl) => {
          try {
            const res = await fetch(assetUrl, {cache: 'reload'});
            if (res && res.ok) {
              await shellCache.put(assetUrl, res);
            }
          } catch {
            // ignore optional asset error
          }
        }),
      ).catch(() => {});
    })(),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([
    PRECACHE,
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

  // Navigation fallback: if network fetch fails, serve '/' from cache, then '/index.html', then '/offline.html'
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            const precache = await caches.open(PRECACHE);
            if (url.pathname === '/' || url.pathname === '') {
              precache.put('/', networkRes.clone()).catch(() => {});
            }
            precache.put('/index.html', networkRes.clone()).catch(() => {});
            return networkRes;
          }
        } catch {
          // Network failed — fall back to cached '/' then '/offline.html'
        }

        const precache = await caches.open(PRECACHE);
        const cachedRoot =
          (await precache.match('/', {ignoreSearch: true})) ||
          (await caches.match('/', {ignoreSearch: true})) ||
          (await precache.match('/index.html', {ignoreSearch: true})) ||
          (await caches.match('/index.html', {ignoreSearch: true})) ||
          (await caches.match(req, {ignoreSearch: true}));
        if (cachedRoot) return cachedRoot;

        const offlinePage =
          (await precache.match('/offline.html')) ||
          (await caches.match('/offline.html'));
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

  // Audio: prefer adhan-sounds-v1 -> audio-cache-v1 -> legacy audio cache -> network
  if (
    req.destination === 'audio' ||
    /\.(?:mp3|m4a|wav|ogg)$/i.test(url.pathname) ||
    url.pathname.startsWith('/audio/') ||
    url.pathname.startsWith('/adhan-sounds/')
  ) {
    event.respondWith(
      (async () => {
        const userAudioCache = await caches.open(AUDIO_USER_CACHE);
        const userHit = await userAudioCache.match(req);
        if (userHit) return userHit;

        const muezzinHit = await caches
          .open('adhan-sounds-v1')
          .then((c) => c.match(req));
        if (muezzinHit) return muezzinHit;

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
          const ct = (res && res.headers && res.headers.get('content-type')) || '';
          const isStaticAsset = /\.(?:js|mjs|css|json|mp3|wav|ogg|png|svg|woff2?)$/i.test(url.pathname);
          if (res && res.ok && !(isStaticAsset && ct.includes('text/html'))) {
            caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        });
      }),
    );
  }
});
