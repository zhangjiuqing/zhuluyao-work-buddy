/* 宝工作台 · 离线缓存 Service Worker
 * 策略：
 *  - 导航请求（打开页面）：network-first，联网时用最新，断网时回退缓存
 *  - 同源静态资源：cache-first，首次加载后离线可用
 *  - 跨域请求（腾讯地图库/瓦片）：不缓存，直接放行（地图仍需联网）
 */
const VERSION = 'bao-sw-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（地图等）不缓存

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, cp); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, cp); });
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
