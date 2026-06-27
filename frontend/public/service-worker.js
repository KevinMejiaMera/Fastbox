/* =====================================================
   SERVICE WORKER - Fastbox / Fre Sistema de Gestión
   ===================================================== */

const CACHE_NAME = 'fre-pos-cache-v1';

// Recursos que se guardan en caché al instalar
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/logo.png'
];

// ===== INSTALL: guarda los recursos esenciales =====
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando recursos esenciales');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE: limpia cachés viejas =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Borrando caché vieja:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH: Network-first, fallback a caché =====
self.addEventListener('fetch', (event) => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // No interceptar peticiones a la API
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, la guardamos en caché
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red: intentamos desde caché
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si no hay caché, devolvemos el index.html para SPA routing
          return caches.match('/index.html');
        });
      })
  );
});
