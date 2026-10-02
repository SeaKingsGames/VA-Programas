/* Hace que la app se pueda instalar y que muestre los últimos programas sin internet.
   Si cambias index.html y quieres forzar la actualización, sube el número de VERSION. */
const VERSION = 'programas-v3';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/auth/v1/')) return;                       // sesiones: nunca de la caché
  const fija = url.pathname.includes('/storage/v1/object/public/')      // fotos
    || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'cdn.jsdelivr.net';
  if (fija) { e.respondWith(primeroCache(req)); return; }
  if (req.mode === 'navigate' || url.origin === self.location.origin || url.pathname.includes('/rest/v1/')) e.respondWith(primeroRed(req));
});

// Programas y la página: intenta internet; si no hay, usa lo último guardado.
async function primeroRed(req) {
  const c = await caches.open(VERSION);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const m = await c.match(req, { ignoreVary: true, ignoreSearch: req.mode === 'navigate' });
    if (m) return m;
    if (req.mode === 'navigate') { const i = await c.match('./index.html'); if (i) return i; }
    throw err;
  }
}
// Fotos, letras y librerías: casi no cambian, se sirven guardadas.
async function primeroCache(req) {
  const c = await caches.open(VERSION);
  const m = await c.match(req, { ignoreVary: true });
  if (m) return m;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone());
  return r;
}
