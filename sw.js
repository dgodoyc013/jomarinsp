// Service worker do Jomar Inspeção — permite abrir o app mesmo sem
// internet nenhuma (não só usar os dados já digitados, mas o próprio
// "esqueleto" do app: HTML, ícones, manifesto).
//
// Estratégia:
//  - index.html (o app em si): tenta a rede primeiro, pra sempre pegar a
//    versão mais nova quando há sinal; se não houver rede, usa a última
//    cópia guardada. Isso resolve as duas coisas ao mesmo tempo: abrir
//    offline E nunca deixar alguém preso numa versão antiga.
//  - Ícones e manifesto: usa o que já está guardado primeiro (raramente
//    mudam), buscando na rede só se não tiver nada guardado ainda.
//  - Qualquer coisa de fora (Firebase, Google Drive, Gemini, fontes,
//    bibliotecas de CDN): passa direto pela rede, sem mexer — o app já
//    trata sozinho o que fazer quando essas chamadas falham por estar
//    offline.
var CACHE_NAME = 'jomar-app-v1';
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS).catch(function(){ /* segue mesmo se algum item falhar */ });
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return; // nunca mexe em envios (Firebase, Drive, etc.)

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deixa tudo externo seguir normal

  var ehPaginaPrincipal = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/';

  if (ehPaginaPrincipal){
    event.respondWith(
      fetch(req).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copia); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(cached){
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached;
      return fetch(req).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copia); });
        return res;
      });
    })
  );
});
