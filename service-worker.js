const CACHE_NAME = 'agenda-comunicaciones-shell-112';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=112',
  './app.js?v=112',
  './voice-create.js?v=112',
  './voice-session.js?v=112',
  './voice-press.js?v=112',
  './config.js?v=112',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/comunicaciones-symbol.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Nunca interceptar Google Sheets ni Google Apps Script.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=event.notification?.data?.url || self.registration.scope;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client)return client.focus();}
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
