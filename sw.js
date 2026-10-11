// Bocón Estudio: funciona sin internet una vez instalado
const CACHE='bocon-v9';
const ASSETS=['./','./index.html','./manifest.webmanifest','./vendor/mp4-muxer.js','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    // la página: primero internet (para recibir actualizaciones), si no hay, la copia guardada
    if(req.mode==='navigate'){e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r;}).catch(()=>caches.match('./index.html')));return;}
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));return res;})));
    return;
  }
  if(url.host==='fonts.googleapis.com'||url.host==='fonts.gstatic.com'){
    e.respondWith(caches.open(CACHE).then(c=>c.match(req).then(r=>{const net=fetch(req).then(res=>{c.put(req,res.clone());return res;}).catch(()=>r);return r||net;})));
  }
});
