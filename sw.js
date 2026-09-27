/* Tic Tac Toe service worker: keeps the game playable offline after one
   online visit, and brings a new release to the phone by its next launch. */
'use strict';

// Bump the version with each release: the new worker then precaches fresh
// copies and deletes the old cache when it takes over.
var CACHE_PREFIX = 'ttt-';
var CACHE = CACHE_PREFIX + 'v1';

// Relative to this file, so it works under the GitHub Pages sub-path
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

/* ---------- Install: precache the game ---------- */

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 'reload' skips the browser's HTTP cache, so a release is precached
      // fresh rather than from a stale copy
      return cache.addAll(FILES.map(function (url) {
        return new Request(url, { cache: 'reload' });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ---------- Activate: drop older versions ---------- */

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      // Only our own caches: other sites on the same github.io origin share
      // this cache storage
      return Promise.all(keys.filter(function (key) {
        return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- Fetch: cached copy first, refreshed in the background ---------- */

// The cached copy opens instantly and works offline; the background refresh
// means a new release shows on the next launch even without a version bump.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(request, { ignoreSearch: true }).then(function (cached) {
      // 'no-cache' revalidates with the server instead of trusting the
      // browser's HTTP cache. A plain URL is fetched because a navigation
      // request can't be copied with new options.
      var refresh = fetch(request.url, { cache: 'no-cache' }).then(function (response) {
        // Never store a redirected response: Safari won't show a page from one
        if (!response.ok || response.redirected) return response;
        return cache.put(request, response.clone()).then(function () {
          return response;
        });
      });
      if (cached) {
        // Offline, the refresh just fails quietly; the cached copy is enough
        event.waitUntil(refresh.catch(function () {}));
        return cached;
      }
      return refresh;
    });
  }));
});
