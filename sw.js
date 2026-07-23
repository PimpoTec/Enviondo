// ============================================================================
// SERVICE WORKER — cachea el "app shell" para que la app abra offline.
// Los datos (vuelos, aeronaves) los maneja js/offline.js con IndexedDB,
// no este service worker.
//
// Estrategia: "red primero, cache como respaldo" para los archivos propios
// (HTML/CSS/JS) — así, si hay señal, siempre usás la última versión
// deployada, y el cache solo entra a jugar cuando estás offline. Antes esto
// era cache-primero, lo que hacía que una config vieja (ej. la URL de
// Supabase) quedara pegada en el navegador aunque el deploy ya la hubiera
// corregido.
// ============================================================================

const CACHE = 'libro-vuelo-v48';
const ARCHIVOS_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/styles.css',
  './js/config.js', './js/icons.js', './js/ui.js',
  './js/supabaseClient.js', './js/calc.js', './js/dolar.js', './js/exportadorAnac.js', './js/cache.js', './js/offline.js',
  './js/auth.js', './js/db.js', './js/notificaciones.js', './js/recordatorios.js', './js/router.js', './js/app.js',
  './js/views/dashboard.js', './js/views/nuevoVuelo.js', './js/views/bitacora.js',
  './js/views/aeronaves.js', './js/views/totales.js', './js/views/costos.js',
  './js/views/perfil.js', './js/views/exportar.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/badge-192.png',
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
  const req = event.request;
  const url = new URL(req.url);

  // Solo interceptamos pedidos propios (mismo origen, http/https, GET).
  // Nunca cacheamos Supabase (datos siempre frescos) ni esquemas raros
  // como chrome-extension:// (no se pueden guardar en Cache Storage).
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});

// ----------------------------------------------------------------------------
// PUSH — notificaciones de Vencimientos y Vuelos programados (js/notificaciones.js
// arma la suscripción, supabase/functions/notificaciones-push las manda).
// ----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const titulo = data.title || 'Libro de Vuelo';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: data.body || '',
    icon: './icons/icon-192.png',
    // "badge" es el ícono chico de la barra de estado de Android — el SO lo
    // usa SOLO como máscara de transparencia (el color lo pinta el propio
    // Android, siempre blanco), así que tiene que ser un PNG con fondo
    // transparente y el dibujo en blanco sólido. Si le pasás el logo a
    // color entero (sin canal alfa útil), Android no tiene de dónde sacar
    // la silueta y termina mostrando un cuadrado blanco liso.
    badge: './icons/badge-192.png',
    tag: data.tag || 'libro-vuelo-notif',
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const abierta = lista.find((c) => 'focus' in c);
      if (abierta) return abierta.focus();
      return clients.openWindow(url);
    })
  );
});
