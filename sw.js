/* Tour Empire — service worker
   Cél: az APP-HÉJ offline is elinduljon (index.html, icons.js, manifest, ikonok).
   A külső források (Leaflet, betűk, térkép-csempék, város- és előadófotók) NEM
   kerülnek gyorsítótárba: netkapcsolat nélkül a játék elindul, csak a térkép és a
   fotók hiányoznak — a kód `HAS_MAP` és a kép-fallback ezt kezeli.

   FRISSÍTÉS: a héj HÁLÓZAT-ELSŐ, ezért új verzió azonnal érkezik, ha van net;
   offline a cache-elt példány jön. A CACHE nevét minden kiadásnál emeljük, és az
   aktiválás töröl minden korábbit — így nem ragadhat be régi build. */
const CACHE = 'tm-shell-v88';
const SHELL = [
  './',
  './index.html',
  './icons.js?v=3',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './assets/logo-empire-v2.webp',
  './assets/bg-start.webp',
  './assets/concert1.mp3',
  './assets/piano1.mp3',
  './assets/lights1.mp3',
  './assets/menu1.mp3',
  './assets/hold1.mp3',
  './assets/paper1.mp3',
  './assets/glass1.mp3',
  './assets/back1.mp3'
];

self.addEventListener('install', function (e) {
  // Egyenkénti cache-elés: EGY hiányzó/404-es fájl NE buktassa az egész előtöltést
  // (az addAll atomikus — egyetlen hiba az összeset eldobná).
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        return Promise.allSettled(SHELL.map(function (u) { return c.add(u); }));
      })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.map(function (k) {
          return k === CACHE ? null : caches.delete(k);   // régi buildek takarítása
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // CDN/térkép/fotó: érintetlen

  /* Navigáció (az app indítása): hálózat-első, offline a cache-elt héj. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) {
            return r || caches.match('./');
          });
        })
    );
    return;
  }

  /* Saját statikus fájlok: cache-ből azonnal, közben csendben frissítjük. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
