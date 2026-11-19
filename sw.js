// =====================================================================
//  sw.js · Service worker: guarda la app en el móvil para que funcione
//  sin conexión. Cuando publiques una versión nueva, sube VERSION aquí
//  (y en js/version.js). Los datos del comercial NO están aquí: están en
//  IndexedDB y no se tocan al actualizar.
// =====================================================================

const VERSION = '1.3.0';
const CACHE = 'llamadas-vinoliva-' + VERSION;

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/estilos.css',
  'js/app.js',
  'js/acciones.js',
  'js/datos.js',
  'js/exportar.js',
  'js/importar.js',
  'js/informes.js',
  'js/logica.js',
  'js/migraciones.js',
  'js/reloj.js',
  'js/ui.js',
  'js/version.js',
  'js/pantallas/hoy.js',
  'js/pantallas/semana.js',
  'js/pantallas/clientes.js',
  'js/pantallas/ficha.js',
  'js/pantallas/mas.js',
  'js/pantallas/oficina.js',
  'lib/xlsx.full.min.js',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'icons/icono-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  // No se activa solo: la app enseña «Hay una versión nueva · Actualizar».
});

self.addEventListener('message', (ev) => {
  if (ev.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('llamadas-vinoliva-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Primero la caché; si no está, la red. Solo archivos de la propia app.
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      return (await cache.match('index.html')) || fetch(req);
    }
    return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
