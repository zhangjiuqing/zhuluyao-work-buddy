/* 宝工作台 · 离线缓存 Service Worker（iOS 优化版）
 * 策略：
 *  - 导航请求（打开页面）：cache-first —— 有缓存立刻用，断网也能秒开；
 *                           无缓存才联网并把结果写入缓存
 *  - 同源静态资源：cache-first，命中即用
 *  - 跨域请求（腾讯地图库/瓦片）：不缓存，直接放行（地图仍需联网）
 *  - 预缓存容错：单个资源失败不影响整体安装
 */
const VERSION = 'bao-sw-v2';
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

  // 导航请求：cache-first（最稳的离线打开方式）
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var cp = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, cp); });
          return res;
        }).catch(function () {
          return caches.match('./index.html').then(function (r) { return r || Response.error(); });
        });
      })
    );
    return;
  }

  // 同源静态资源：命中即用，未命中则联网并缓存
  e.respondWith(
    caches.match(req).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, cp); });
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
