// service-worker.js — Carômetro
// v6: força atualização + cache dinâmico das fotos dos prefeitos

const CACHE_NAME = 'carometro-cache-v25';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './carometro_normalizado.json',
  './icons/icon-512.png'
];

// Instalação: faz cache dos arquivos centrais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Ativação: remove versões antigas do cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isFotoPrefeito = url.pathname.includes('/prefeitos/') && url.pathname.endsWith('.jpg');

  // Fotos: rede primeiro (para pegar nova imagem), salvando no cache; se falhar, usa cache
  if (isFotoPrefeito) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais: cache-first
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
