/* eslint-disable no-restricted-globals */

// ===== WORKBOX CONFIGURACIÓN =====
// Este archivo será procesado por Workbox en el build

const CACHE_NAME = 'fre-pos-v1';
const { clientsClaim } = self;

clientsClaim();

// Precarga de recursos
self.__WB_MANIFEST;

// Cache de recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto para Fre POS');
        // Workbox inyectará automáticamente los archivos aquí
        return cache.addAll(self.__WB_MANIFEST || []);
      })
      .catch(err => console.error('❌ Error al cachear recursos:', err))
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Stale-While-Revalidate (más eficiente)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devolverlo y actualizar en segundo plano
        const fetchPromise = fetch(event.request)
          .then(fetchResponse => {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, fetchResponse.clone());
            });
            return fetchResponse;
          })
          .catch(() => {
            // Si falla la red y no hay caché, devolver respuesta por defecto
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('Recurso no disponible', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        
        return response || fetchPromise;
      })
  );
});