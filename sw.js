/* 宝工作台 · 离线缓存 Service Worker（iOS 优化版 v4）
 * 策略：
 *  - 导航请求（打开页面）：network-first —— 联网时必取最新版，保证新功能同步；
 *                          断网/失败时才回退到缓存，确保离线可打开
 *  - 同源静态资源：cache-first + 后台更新（命中即用，联网后悄悄刷新缓存）
 *  - 跨域请求（腾讯地图库/瓦片）：不缓存，直接放行（地图仍需联网）
 *  - 预缓存容错：单个资源失败不影响整体安装
 */
const VERSION = 'bao-sw-v4';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.allSettled(PRECACHE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
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
  if (url.origin !== self.location.origin) return; // 跨域（地图等）不缓存，直接放行

  // 导航请求：network-first（联网取最新，断网用缓存）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var cp = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, cp); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 同源静态资源：cache-first + 后台更新
  e.respondWith(
    caches.match(req).then(function (r) {
      var f = fetch(req).then(function (res) {
        if (res && res.ok) {
          var cp = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, cp); });
        }
        return res;
      });
      return r || f;
    })
  );
});
