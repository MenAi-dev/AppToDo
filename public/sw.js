// Pense à changer ce numéro à chaque modification des fichiers,
// sinon les anciens fichiers restent servis depuis le cache.
const CACHE_NAME = 'momo-taches-cache-v21';
const URLS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './css/base.css',
  './css/components.css',
  './css/modals.css',
  './css/oneui.css',
  './fonts/inter-latin.woff2',
  './js/precoce.js',
  './js/helpers.js',
  './js/parser.js',
  './js/journal.js',
  './js/storage.js',
  './js/rappels.js',
  './js/render.js',
  './js/recurrentes.js',
  './js/events.js',
  './js/gestes.js',
  './js/reglages.js',
  './js/securite.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(noms =>
      Promise.all(noms.filter(n => n.startsWith('momo-taches-') && n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(rep => {
      if (rep) return rep;
      return fetch(event.request).catch(() =>
        event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()
      );
    })
  );
});

// Toucher une notification de rappel : on ramène l'app au premier plan
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(liste => {
      for(const c of liste){ if('focus' in c) return c.focus(); }
      return self.clients.openWindow('./index.html');
    })
  );
});
