/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-ab535efc'], (function (workbox) { 'use strict';

  importScripts("/adhan-sw-ext.js");
  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "/index.html",
    "revision": "0.j2j5in56d28"
  }], {
    "ignoreURLParametersMatching": [/^utm_/, /^fbclid$/, /^tab$/, /^openMuezzin$/, /^playAlert$/, /^alertType$/, /^prayer$/, /^voiceId$/]
  });
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    allowlist: [/^\/$/],
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(({
    request,
    sameOrigin,
    url
  }) => sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"), new workbox.NetworkFirst({
    "cacheName": "tasbih-precache-v2",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    }), new workbox.PrecacheFallbackPlugin({
      fallbackURL: '/offline.html'
    })]
  }), 'GET');
  workbox.registerRoute(({
    url
  }) => url.pathname.startsWith("/fonts/") || /\.(?:woff|woff2|ttf|otf)$/i.test(url.pathname), new workbox.CacheFirst({
    "cacheName": "alzahabi-fonts-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 60,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    request,
    url
  }) => request.destination === "image" || /\.(?:png|jpe?g|svg|webp|ico|gif)$/i.test(url.pathname), new workbox.CacheFirst({
    "cacheName": "alzahabi-offline-images-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    sameOrigin,
    url
  }) => sameOrigin && url.pathname.startsWith("/data/"), new workbox.CacheFirst({
    "cacheName": "alzahabi-core-data-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    sameOrigin,
    url
  }) => sameOrigin && url.pathname.startsWith("/audio/"), new workbox.CacheFirst({
    "cacheName": "audio-cache-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    request,
    sameOrigin,
    url
  }) => sameOrigin && request.mode !== "navigate" && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/data/") && !url.pathname.startsWith("/audio/") && !url.pathname.startsWith("/fonts/"), new workbox.StaleWhileRevalidate({
    "cacheName": "alzahabi-app-shell-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/(everyayah\.com|server\d+\.mp3quran\.net|cdn\.mp3quran\.net|cdn\.islamic\.network|www\.hisnmuslim\.com|www\.islamcan\.com|archive\.org|cdn\.aladhan\.com)\/.*/i, new workbox.CacheFirst({
    "cacheName": "audio-cache-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 3000,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/(i\.ytimg\.com|yt3\.ggpht\.com)\/.*/i, new workbox.CacheFirst({
    "cacheName": "alzahabi-offline-images-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 400,
      maxAgeSeconds: 15552000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
