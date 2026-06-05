const CACHE_NAME = 'aerogps-webar-cache-v1';
const PRECACHE_ASSETS = [
  './index.html',
  './assets/css/style.css',
  './src/main.js',
  './src/services/gps.js',
  './src/services/telemetry.js',
  './src/services/assets.js',
  './src/services/monuments.js',
  './src/components/anchor-manager.js',
  './src/components/gestures.js',
  './src/components/ground-indicator.js',
  './src/ui/hud.js',
  './src/ui/loader.js',
  './src/ui/tutorial.js',
  './src/ui/map.js',
  './src/data/monumentos.json'
];

// Instalar y Cachear recursos principales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar y Limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones para soporte offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Estrategia Cache-First para modelos 3D pesados (.glb)
  if (requestUrl.pathname.endsWith('.glb')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Estrategia Stale-While-Revalidate para recursos estáticos comunes y CDNs
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Ejecutar fetch en segundo plano para actualizar la caché
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Silenciar errores de conexión offline */});

        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
