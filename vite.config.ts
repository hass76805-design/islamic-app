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
        manifest: false,
        includeAssets: [
          'pwa-1024x1024.png',
          'audio/splash-alafasy.mp3',
          'audio/azan.mp3',
          'audio/pre-adhan/illa-salati.mp3',
          'audio/pre-adhan/alafasy-general.mp3',
          'audio/pre-adhan/ghamdi-general.mp3',
          'audio/pre-adhan/abdulbasit-general.mp3',
          'audio/post-adhan-dua.mp3',
          'audio/iqamah-makkah.mp3',
          'audio/iqamah-madinah.mp3',
          'audio/iqamah-haram.mp3',
          'adhan.js',
          'adhan-sw.js',
          'adhan-sounds/makkah.mp3',
          'adhan-sounds/ahmed-naina.mp3',
          'adhan-sounds/khalid-aljalil.mp3',
          'adhan-sounds/mishary-alafasy.mp3',
          'adhan-sounds/egyptian.mp3',
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/assets\//,
            /\.(?:js|mjs|css|map|json|png|jpe?g|svg|webp|ico|woff2?|ttf|otf|mp3|wav|ogg)$/i,
          ],
          ignoreURLParametersMatching: [
            /^utm_/,
            /^fbclid$/,
            /^tab$/,
            /^openMuezzin$/,
            /^playAlert$/,
            /^alertType$/,
            /^prayer$/,
            /^voiceId$/,
          ],
          globPatterns: [
            '**/*.{js,css,html,ico,png,jpg,svg,woff,woff2,webmanifest}',
          ],
          globIgnores: [
            '**/sw.js',
            '**/workbox-*.js',
            'src/assets/**',
            'audio/**',
            'data/**',
          ],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          importScripts: ['/adhan-sw-ext.js', '/adhan-sw.js'],
          runtimeCaching: [
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
                sameOrigin &&
                (url.pathname.startsWith('/audio/') ||
                  url.pathname.startsWith('/adhan-sounds/')),
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
              urlPattern: ({request, sameOrigin, url}) =>
                sameOrigin &&
                request.mode !== 'navigate' &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/assets/') &&
                !url.pathname.startsWith('/data/') &&
                !url.pathname.startsWith('/audio/') &&
                !url.pathname.startsWith('/adhan-sounds/') &&
                !url.pathname.startsWith('/fonts/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alzahabi-app-shell-v2',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                plugins: [
                  {
                    cacheWillUpdate: async ({request, response}) => {
                      if (!response) return null;
                      const contentType =
                        response.headers.get('content-type') || '';
                      const pathname = new URL(request.url).pathname;
                      if (
                        /\.(?:js|mjs|css|json|mp3|wav|ogg|png|svg|woff2?)$/i.test(
                          pathname,
                        ) &&
                        contentType.includes('text/html')
                      ) {
                        return null;
                      }
                      return response;
                    },
                  },
                ],
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
