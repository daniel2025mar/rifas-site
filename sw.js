/* PowerApps — Service Worker (fallback offline) */
const CACHE = 'pas-offline-v6';
const OFFLINE_URL = 'offline.html';
const ASSETS = [
  OFFLINE_URL,
  'assets/Power2.png',
  'assets/logo.png'
];

function isAuthPage(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    return /(?:^|\/)(index\.html|cadastro\.html)?$/.test(path) || /\/rifas\/?$/.test(path);
  } catch {
    return false;
  }
}

function isImageRequest(req, url) {
  if (req.destination === 'image') return true;
  const accept = req.headers.get('accept') || '';
  if (accept.includes('image/') && !accept.includes('text/html')) return true;
  return /\.(png|jpe?g|gif|webp|svg|ico|avif)(\?|$)/i.test(url.pathname);
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API / CDN externos: nunca interceptar (evita devolver PNG no lugar do JSON)
  if (url.origin !== self.location.origin) return;

  // Probe de conexão: só rede, sem fallback de cache
  if (url.searchParams.has('ping')) {
    event.respondWith(fetch(req));
    return;
  }

  const accept = req.headers.get('accept') || '';
  const isNav = req.mode === 'navigate' || accept.includes('text/html');

  if (!isNav) {
    const wantImage = isImageRequest(req, url);
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Só usa PNG como fallback de imagens — nunca de JS/CSS/API
          if (wantImage) return caches.match('assets/Power2.png').then((img) => img || offlineResponse());
          return offlineResponse();
        })
      )
    );
    return;
  }

  // Login/cadastro: sempre rede (evita theme-color antigo no cache)
  if (isAuthPage(req.url)) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((page) =>
          page || new Response(
            '<!doctype html><title>Sem internet</title><h1>Sem internet</h1>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(OFFLINE_URL).then((page) =>
          page || new Response(
            '<!doctype html><title>Sem internet</title><h1>Sem internet</h1>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
  );
});
