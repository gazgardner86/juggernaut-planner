/*
 * Offline cache for the hosted apps. Pages are network-first so an updated
 * deploy is picked up when there is signal; the cache answers when there
 * isn't (gym basements, no reception).
 */
var CACHE = 'juggernaut-202610141747';
var ASSETS = ['./', './index.html', './trainer.html', './trainer3.html', './juggernaut.html', './manifest.webmanifest', './manifest-trainer.webmanifest', './manifest-trainer3.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }

  var isPage = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isPage) {
    // Network first, fall back to whatever we cached.
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          // Fall back to the cached copy of the page that was asked for, so an
          // offline trainer.html or trainer3.html never lands on the v1 app.
          return caches.match(req, { ignoreSearch: true }).then(function (hit) {
            if (hit) { return hit; }
            var path = new URL(req.url).pathname;
            var page = /trainer3\.html$/.test(path) ? './trainer3.html' : /trainer\.html$/.test(path) ? './trainer.html' : /juggernaut\.html$/.test(path) ? './juggernaut.html' : './index.html';
            return caches.match(page);
          });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
