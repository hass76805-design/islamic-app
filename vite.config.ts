import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'assets/aistudio/IMG-20261120-WA4940_5880b328.jpg',
          'adhan-sw-ext.js',
          'offline.html',
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
        ],
        manifest: {
          id: '/',
          name: 'البرنامج الإسلامي الذهبي',
          short_name: 'الذهبي',
          description:
            'البرنامج الإسلامي الذهبي: القرآن الكريم، اختبر حفظك بالميكروفون، المؤذن الإلكتروني المتكامل، محاضرات 30 شيخًا، الأذكار، الفقه والمسابقة، وقصص الأنبياء والصحابة.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          lang: 'ar',
          dir: 'rtl',
          categories: ['lifestyle', 'books', 'education'],
          prefer_related_applications: false,
          shortcuts: [
            {
              name: 'القرآن الكريم',
              short_name: 'القرآن',
              url: '/?tab=quran',
              icons: [{src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'}],
            },
            {
              name: 'المؤذن الإلكتروني',
              short_name: 'المؤذن',
              url: '/?openMuezzin=1',
              icons: [{src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'}],
            },
            {
              name: 'الأذكار اليومية',
              short_name: 'الأذكار',
              url: '/?tab=azkar',
              icons: [{src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'}],
            },
          ],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2,json,mp3}'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          importScripts: ['/adhan-sw-ext.js'],
          runtimeCaching: [
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
                cacheName: 'alzahabi-offline-audio-v1',
                expiration: {
                  maxEntries: 120,
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
                !url.pathname.startsWith('/@vite') &&
                !url.pathname.startsWith('/data/') &&
                !url.pathname.startsWith('/audio/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alzahabi-app-shell-v1',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/(everyayah\.com|server\d+\.mp3quran\.net|cdn\.mp3quran\.net|cdn\.islamic\.network|www\.hisnmuslim\.com|www\.islamcan\.com|archive\.org|cdn\.aladhan\.com)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'alzahabi-offline-audio-v1',
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
