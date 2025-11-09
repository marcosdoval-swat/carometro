// service-worker.js — Carômetro
const CACHE_NAME = 'carometro-cache-v28';
// Itens essenciais para offline
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './carometro_normalizado.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Instalação: pré-cache básico
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

// Estratégias de busca
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Apenas GET
  if (req.method !== 'GET') return;

  // JSON: network-first (para sempre ter dados novos)
  if (url.pathname.endsWith('carometro_normalizado.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Fotos e fundos: cache-first com atualização em segundo plano
  if (url.pathname.startsWith('/carometro/prefeitos/') ||
      url.pathname.startsWith('/carometro/hero/') ||
      url.pathname.startsWith('/prefeitos/') ||
      url.pathname.startsWith('/hero/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Demais estáticos: cache-first
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) {
    // Atualiza em background
    fetch(req).then(r => cache.put(req, r.clone())).catch(()=>{});
    return cached;
  }
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req){
  const cache = await caches.open(CACHE_NAME);
  try{
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  }catch(e){
    const cached = await cache.match(req);
    return cached || new Response('[]', {headers:{'Content-Type':'application/json'}});
  }
}
