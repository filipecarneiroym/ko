/* K.O — service worker do app instalável.
   Guarda os arquivos do jogo (js, css, ícones) para abrir rápido; as páginas sempre vêm da internet
   (sala, placar e ranking mudam o tempo todo). Sem internet, mostra a página "sem conexão". */
const CACHE = 'ko-v2';
const OFFLINE_URL = '/offline.html';
const ESTATICOS = [OFFLINE_URL, '/css/ko.css', '/icone-192.png', '/favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // js/css vêm com ?v=data-do-arquivo: a mesma URL nunca muda, então dá para servir do cache.
  if (/^\/(js|css)\//.test(url.pathname) || /\.(png|webp)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return resp;
    })));
  }
});
