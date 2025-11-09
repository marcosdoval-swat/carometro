// service-worker.js — Carômetro (v30)
const CACHE_NAME = 'carometro-cache-v30';

// Itens essenciais para offline (núcleo do app)
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ui.js',
  './carometro_normalizado.json',

  // Ícones
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',

  // Artes da capa (hero) – múltiplos tamanhos
  './hero/hero-1080x2340.jpg',
  './hero/hero-1170x2532.jpg',
  './hero/hero-1179x2556.jpg',
  './hero/hero-1242x2688.jpg',
  './hero/hero-1284x2778.jpg',
  './hero/hero-1290x2796.jpg',
  './hero/hero-1920x1080.jpg',
  './hero/hero-2048x2732.jpg'
];

// Instalação: pré-cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

// Estratégias de busca
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // só GET
  if (req.method !== 'GET') return;

  // CDN / terceiros (ex.: Chart.js): cache-first
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // JSON de dados: network-first (para manter atualizado)
  if (url.pathname.endsWith('/carometro_normalizado.json') ||
      url.pathname.endsWith('carometro_normalizado.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Fotos e capas: cache-first com atualização em background
  if (url.pathname.startsWith('/carometro/prefeitos/') ||
      url.pathname.startsWith('/carometro/hero/') ||
      url.pathname.startsWith('/prefeitos/') ||
      url.pathname.startsWith('/hero/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Demais estáticos do app: cache-first
  event.respondWith(cacheFirst(req));
});

// ========= Helpers =========
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) {
    // Atualiza em background (stale-while-revalidate)
    fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
    }).catch(() => {});
    return cached;
  }
  const fresh = await fetch(req);
  // Evita colocar respostas inválidas no cache
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return (
      cached ||
      new Response('[]', { headers: { 'Content-Type': 'application/json' } })
    );
  }
}
