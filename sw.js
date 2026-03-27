const CACHE = 'appjw-v1';

// Archivos estáticos que se pre-cachean al instalar
const SHELL = [
  '/',
  '/firebase.js',
  '/ui-utils.js',
  '/favicon.svg',
  '/admin.js',
  '/territorios/index.html',
  '/territorios/app.js',
  '/territorios/mapa.html',
  '/asignaciones/index.html',
  '/asignaciones/app.js',
  '/vida-ministerio/index.html',
  '/vida-ministerio/app.js',
  '/vida-ministerio/programa.html',
  '/vida-ministerio/programa.js',
];

// Instalar: pre-cachear la app shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: solo interceptamos mismo origen
// Firebase, CDN (Leaflet, Firebase SDK, PostHog) son cross-origin → pasan directo a red
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Cache first, luego red como fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
