import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const fontsDir = path.resolve(__dirname, 'public/fonts');
  const fontIncludeAssets = fs.existsSync(fontsDir)
    ? fs
        .readdirSync(fontsDir)
        .filter((f) => f.endsWith('.woff2') || f.endsWith('.css'))
        .map((f) => `fonts/${f}`)
    : [];

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        includeAssets: [
          'manifest.webmanifest',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'icon.svg',
          'icon-maskable.svg',
          'assets/aistudio/IMG-20261120-WA4940_5880b328.jpg',
          'adhan-sw-ext.js',
          'offline.html',
          'audio/azan.mp3',
          'audio/adhan-makkah.mp3',
          'audio/adhan-madinah.mp3',
          'audio/adhan-alafasy.mp3',
          'audio/iqamah-makkah.mp3',
          'audio/iqamah-madinah.mp3',
          'audio/iqamah-haram.mp3',
          'audio/pre-chime.mp3',
          'audio/pre-istighfar.mp3',
          'audio/pre-takbeer.mp3',
          'audio/post-adhan-dua.mp3',
          'audio/tawasih-naqshabandi-1.mp3',
          'audio/tawasih-naqshabandi-2.mp3',
          'audio/tawasih-naqshabandi-3.mp3',
          'audio/salawat-1.mp3',
          'audio/salawat-2.mp3',
          'audio/salawat-3.mp3',
          'audio/salawat-4.mp3',
          'audio/eid-makkah-1.mp3',
          'audio/eid-makkah-2.mp3',
          'audio/eid-jamaa.mp3',
          'audio/kahf-abdulbasit.mp3',
          'audio/kahf-alafasy.mp3',
          'audio/kahf-muaiqly.mp3',
          'audio/sheikh-start-reading.mp3',
          'data/quran.json',
          'data/tafsir.json',
          ...fontIncludeAssets,
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: [
            '**/*.{js,css,html,ico,png,jpg,svg,woff,woff2,json,mp3,webmanifest}',
          ],
          globIgnores: ['**/sw.js', '**/workbox-*.js'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          importScripts: ['/adhan-sw-ext.js'],
          runtimeCaching: [
            {
              urlPattern: ({request, sameOrigin}) =>
                sameOrigin && request.mode === 'navigate',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alzahabi-app-shell-v1',
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({url}) =>
                url.pathname.startsWith('/fonts/') ||
                /\.(?:woff|woff2|ttf|otf)$/i.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alzahabi-fonts-v1',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({request, url}) =>
                request.destination === 'image' ||
                /\.(?:png|jpe?g|svg|webp|ico|gif)$/i.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alzahabi-offline-images-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({sameOrigin, url}) =>
                sameOrigin && url.pathname.startsWith('/data/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alzahabi-core-data-v1',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({sameOrigin, url}) =>
                sameOrigin && url.pathname.startsWith('/audio/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({sameOrigin, url}) =>
                sameOrigin &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/data/') &&
                !url.pathname.startsWith('/audio/') &&
                !url.pathname.startsWith('/fonts/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alzahabi-app-shell-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern:
                /^https:\/\/(everyayah\.com|server\d+\.mp3quran\.net|cdn\.mp3quran\.net|cdn\.islamic\.network|www\.hisnmuslim\.com|www\.islamcan\.com|archive\.org|cdn\.aladhan\.com)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache-v1',
                expiration: {
                  maxEntries: 3000,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/(i\.ytimg\.com|yt3\.ggpht\.com)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'alzahabi-offline-images-v1',
                expiration: {
                  maxEntries: 400,
                  maxAgeSeconds: 60 * 60 * 24 * 180,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    esbuild: {
      drop: ['debugger' as const],
    },
    build: {
      sourcemap: false,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
