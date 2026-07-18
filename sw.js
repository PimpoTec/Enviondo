// ============================================================================
// SERVICE WORKER — cachea el "app shell" para que la app abra offline.
// Los datos (vuelos, aeronaves) los maneja js/offline.js con IndexedDB,
// no este service worker.
// ============================================================================

const CACHE = 'libro-vuelo-v1';
const ARCHIVOS_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css',
  './js/config.js', './js/supabaseClient.js', './js/calc.js', './js/offline.js',
  './js/auth.js', './js/db.js', './js/router.js', './js/app.js',
  './js/views/dashboard.js', './js/views/nuevoVuelo.js', './js/views/bitacora.js',
  './js/views/aeronaves.js', './js/views/totales.js', './js/views/costos.js',
  './js/views/perfil.js', './js/views/exportar.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear llamadas a Supabase: siempre red (los datos deben ser frescos;
  // si no hay red, la app ya maneja el guardado offline por su cuenta).
  if (url.hostname.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const red = fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          const copia = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        }
        return resp;
      }).catch(() => cacheado);
      return cacheado || red;
    })
  );
});
